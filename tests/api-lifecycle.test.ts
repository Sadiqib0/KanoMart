import { beforeEach, describe, expect, it } from "vitest";
import { createApp, createMemoryStore, inject } from "../backend/server.mjs";

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
  const signup = await registerUser({
    phone: "08000000000",
    firstName: "Admin",
    lastName: "User",
    role: "customer",
  });
  if (signup.status === 201) return signup;

  return await requestJson("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier: "08000000000", password: "password123" }),
  });
}

async function approveVendor(vendorToken: string) {
  const admin = await registerAdmin();
  const userId = app.store.sessions.get(vendorToken)?.userId;
  const list = await requestJson("/admin/vendor-applications", {
    headers: { authorization: `Bearer ${admin.body.token}` },
  });
  const application = list.body.applications.find((item: { user: { id: string } }) => item.user.id === userId);

  await requestJson(`/admin/vendor-applications/${application.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${admin.body.token}` },
    body: JSON.stringify({ status: "approved" }),
  });
}

async function createApprovedProduct(input: Record<string, unknown> = {}) {
  const vendor = await registerUser({
    phone: "08098765432",
    firstName: "Musa",
    lastName: "Garba",
    role: "vendor",
    businessName: "Musa Wears",
  });
  await approveVendor(vendor.body.token);
  const product = await requestJson("/vendor/products", {
    method: "POST",
    headers: { authorization: `Bearer ${vendor.body.token}` },
    body: JSON.stringify({
      name: { en: "Black Jallabiya", ha: "Jallabiya Baki" },
      category: "fashion",
      price: 10000,
      quantityAvailable: 4,
      area: "Fagge",
      ...input,
    }),
  });
  const admin = await registerAdmin();
  await requestJson(`/admin/products/${product.body.product.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${admin.body.token}` },
    body: JSON.stringify({ status: "approved" }),
  });
  return { vendor, product };
}

async function createCustomer() {
  return await registerUser({
    phone: "08012345678",
    firstName: "Aisha",
    lastName: "Bello",
    role: "customer",
  });
}

async function checkoutOrder(paymentMethod = "manual_transfer", deliveryOption = "delivery") {
  const { product } = await createApprovedProduct();
  const customer = await createCustomer();
  await requestJson("/cart/items", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
  });

  return await requestJson("/checkout", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({
      deliveryOption,
      deliveryAddress: deliveryOption === "delivery" ? "Tarauni, Kano" : undefined,
      deliveryArea: "Tarauni",
      paymentMethod,
    }),
  });
}

async function advanceOrder(adminToken: string, orderId: string, statuses: string[]) {
  let response!: Awaited<ReturnType<typeof requestJson>>;
  for (const status of statuses) {
    response = await requestJson(`/admin/orders/${orderId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status, deliveryPerson: "Kano Mart Rider" }),
    });
  }
  return response;
}

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });
});

describe("Kano Mart API payment and fulfillment lifecycle", () => {
  it("lets admins confirm manual payments and creates ledger entries once", async () => {
    const checkout = await checkoutOrder("manual_transfer");
    const admin = await registerAdmin();
    const paymentId = checkout.body.order.payment.id;

    const confirmed = await requestJson(`/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "paid", adminNote: "Transfer confirmed." }),
    });
    const confirmedAgain = await requestJson(`/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "paid", adminNote: "Duplicate confirmation." }),
    });

    expect(confirmed.status).toBe(200);
    expect(confirmed.body.payment).toMatchObject({
      status: "paid",
      adminNote: "Transfer confirmed.",
      verifiedAt: expect.any(String),
    });
    expect(confirmed.body.order).toMatchObject({ paymentStatus: "paid" });
    expect(confirmedAgain.status).toBe(200);
    expect(Array.from(app.store.walletLedger.values())).toHaveLength(2);
  });

  it("marks payments failed and refunded while syncing order payment status", async () => {
    const checkout = await checkoutOrder("manual_transfer");
    const admin = await registerAdmin();
    const paymentId = checkout.body.order.payment.id;

    const failed = await requestJson(`/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "failed", adminNote: "No matching transfer." }),
    });
    const refunded = await requestJson(`/admin/payments/${paymentId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "refunded", adminNote: "Customer refunded." }),
    });

    expect(failed.body).toMatchObject({
      payment: { status: "failed", failedAt: expect.any(String) },
      order: { paymentStatus: "failed" },
    });
    expect(refunded.body).toMatchObject({
      payment: { status: "refunded", refundedAt: expect.any(String) },
      order: { paymentStatus: "refunded" },
    });
  });

  it("advances delivery orders in sequence and releases vendor payout on paid delivery", async () => {
    const checkout = await checkoutOrder("card");
    const admin = await registerAdmin();
    const orderId = checkout.body.order.id;

    const delivered = await advanceOrder(admin.body.token, orderId, [
      "preparing_order",
      "ready_for_pickup",
      "assigned_to_rider",
      "out_for_delivery",
      "delivered",
    ]);

    expect(delivered.status).toBe(200);
    expect(delivered.body.order).toMatchObject({
      status: "delivered",
      deliveryPerson: "Kano Mart Rider",
      paymentStatus: "paid",
    });
    expect(Array.from(app.store.walletLedger.values())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "vendor_pending_credit", status: "available", availableAt: expect.any(String) }),
        expect.objectContaining({ type: "platform_commission", status: "available" }),
      ]),
    );
  });

  it("does not release vendor payout for delivered unpaid orders", async () => {
    const checkout = await checkoutOrder("pay_on_delivery", "pickup");
    const admin = await registerAdmin();

    await advanceOrder(admin.body.token, checkout.body.order.id, ["preparing_order", "ready_for_pickup", "delivered"]);

    expect(Array.from(app.store.walletLedger.values())).toEqual([]);
  });

  it("rejects invalid order status jumps", async () => {
    const checkout = await checkoutOrder("card");
    const admin = await registerAdmin();

    const response = await requestJson(`/admin/orders/${checkout.body.order.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "delivered" }),
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("invalid_order_transition");
  });

  it("protects payment and order lifecycle routes from customers", async () => {
    const checkout = await checkoutOrder("manual_transfer");
    const customer = await registerUser({
      phone: "08055555555",
      firstName: "Maryam",
      lastName: "Sani",
      role: "customer",
    });

    const payment = await requestJson(`/admin/payments/${checkout.body.order.payment.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ status: "paid" }),
    });
    const order = await requestJson(`/admin/orders/${checkout.body.order.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ status: "preparing_order" }),
    });

    expect(payment.status).toBe(403);
    expect(order.status).toBe(403);
  });
});
