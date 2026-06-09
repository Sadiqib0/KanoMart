import { beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { createApp, createMemoryStore, inject } from "../backend/server.mjs";

const PAYSTACK_SECRET = "sk_test_webhook_secret";

let app: ReturnType<typeof createApp>;

async function requestJson(path: string, init: RequestInit = {}) {
  return await inject(app, {
    path,
    method: init.method,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.body?.toString(),
  });
}

async function registerUser(input: Record<string, unknown>) {
  return await requestJson("/auth/register", {
    method: "POST",
    body: JSON.stringify({ password: "password123", ...input }),
  });
}

async function registerAdmin() {
  const signup = await registerUser({ phone: "08000000000", firstName: "Admin", lastName: "User", role: "customer" });
  if (signup.status === 201) return signup;
  return await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "08000000000", password: "password123" }),
  });
}

async function placePendingOrder() {
  const vendor = await registerUser({
    phone: "08098765432", firstName: "Musa", lastName: "Garba", role: "vendor", businessName: "Musa Wears",
  });
  const admin = await registerAdmin();
  const vendorUserId = app.store.sessions.get(vendor.body.token)?.userId;
  const list = await requestJson("/admin/vendor-applications", {
    headers: { authorization: `Bearer ${admin.body.token}` },
  });
  const application = list.body.applications.find((item: { user: { id: string } }) => item.user.id === vendorUserId);
  await requestJson(`/admin/vendor-applications/${application.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${admin.body.token}` },
    body: JSON.stringify({ status: "approved" }),
  });

  const product = await requestJson("/vendor/products", {
    method: "POST",
    headers: { authorization: `Bearer ${vendor.body.token}` },
    body: JSON.stringify({
      name: { en: "Black Jallabiya", ha: "Jallabiya Baki" },
      category: "fashion", price: 15000, quantityAvailable: 4, area: "Fagge", tags: ["jallabiya"],
    }),
  });
  await requestJson(`/admin/products/${product.body.product.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${admin.body.token}` },
    body: JSON.stringify({ status: "approved" }),
  });

  const customer = await registerUser({
    phone: "08012345678", firstName: "Aisha", lastName: "Bello", role: "customer", deliveryAddress: "Tarauni, Kano",
  });
  await requestJson("/cart/items", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
  });
  // bank_transfer → "pending"/manual: settled only by webhook or admin review.
  const checkout = await requestJson("/checkout", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({ deliveryOption: "pickup", paymentMethod: "bank_transfer" }),
  });
  expect(checkout.status).toBe(201);
  expect(checkout.body.order.paymentStatus).toBe("pending");
  return { order: checkout.body.order, customer, admin };
}

function sign(rawBody: string, secret = PAYSTACK_SECRET) {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

async function postWebhook(payload: Record<string, unknown>, signature?: string) {
  const raw = JSON.stringify(payload);
  return await requestJson("/payments/webhook/paystack", {
    method: "POST",
    headers: { "x-paystack-signature": signature ?? sign(raw) },
    body: raw,
  });
}

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*", paystackSecretKey: PAYSTACK_SECRET });
});

describe("Paystack webhook", () => {
  it("rejects an invalid signature", async () => {
    const response = await postWebhook({ event: "charge.success" }, sign("{}", "wrong_secret"));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("invalid_signature");
  });

  it("marks a pending payment paid on a signed charge.success with the full amount", async () => {
    const { order, customer } = await placePendingOrder();
    const response = await postWebhook({
      event: "charge.success",
      data: { reference: order.paymentReference, amount: order.subtotal * 100 },
    });
    expect(response.status).toBe(200);

    const orders = await requestJson("/orders", { headers: { authorization: `Bearer ${customer.body.token}` } });
    expect(orders.body.orders[0].paymentStatus).toBe("paid");
  });

  it("keeps the payment pending when the charged amount is short", async () => {
    const { order, customer } = await placePendingOrder();
    const response = await postWebhook({
      event: "charge.success",
      data: { reference: order.paymentReference, amount: order.subtotal * 100 - 1 },
    });
    expect(response.status).toBe(200); // acknowledged so Paystack stops retrying

    const orders = await requestJson("/orders", { headers: { authorization: `Bearer ${customer.body.token}` } });
    expect(orders.body.orders[0].paymentStatus).toBe("pending");
  });

  it("ignores webhooks for unknown references", async () => {
    const response = await postWebhook({
      event: "charge.success",
      data: { reference: "KM-PAY-DOES-NOT-EXIST", amount: 100000 },
    });
    expect(response.status).toBe(200);
  });
});
