import { beforeEach, describe, expect, it } from "vitest";
import { createApp, createMemoryStore, inject } from "../api/server.mjs";

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
    body: JSON.stringify({
      password: "password123",
      ...input,
    }),
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

  return await requestJson(`/admin/vendor-applications/${application.id}`, {
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
      price: 15000,
      quantityAvailable: 4,
      area: "Fagge",
      tags: ["jallabiya"],
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
    deliveryAddress: "Tarauni, Kano",
  });
}

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });
});

describe("Kano Mart API cart and checkout", () => {
  it("adds approved products to a customer cart with server-side totals", async () => {
    const { product } = await createApprovedProduct();
    const customer = await createCustomer();

    const cart = await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 2 }),
    });

    expect(cart.status).toBe(200);
    expect(cart.body.cart).toMatchObject({
      subtotal: 30000,
      items: [
        expect.objectContaining({
          productId: product.body.product.id,
          quantity: 2,
          lineTotal: 30000,
        }),
      ],
    });
  });

  it("creates a pending manual-transfer order from cart and clears the cart", async () => {
    const { vendor, product } = await createApprovedProduct();
    const customer = await createCustomer();
    await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 2 }),
    });

    const checkout = await requestJson("/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({
        deliveryOption: "delivery",
        deliveryAddress: "Tarauni, Kano",
        deliveryArea: "Tarauni",
        paymentMethod: "manual_transfer",
        subtotal: 1,
        deliveryFee: 999999,
      }),
    });

    expect(checkout.status).toBe(201);
    expect(checkout.body.order).toMatchObject({
      customerName: "Aisha Bello",
      paymentMethod: "manual_transfer",
      paymentStatus: "pending",
      itemsSubtotal: 30000,
      deliveryFee: 1200,
      subtotal: 31200,
      commissionTotal: 3000,
      vendorPayoutTotal: 27000,
      status: "awaiting_confirmation",
      payment: expect.objectContaining({
        amount: 31200,
        status: "pending",
        gateway: "manual",
      }),
    });
    expect(checkout.body.cart.items).toEqual([]);

    const storedProduct = app.store.products.get(product.body.product.id);
    expect(storedProduct.quantityAvailable).toBe(2);

    const vendorOrders = await requestJson("/vendor/orders", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });
    expect(vendorOrders.body.orders).toHaveLength(1);
    expect(vendorOrders.body.orders[0].items).toEqual([
      expect.objectContaining({ vendorUserId: vendor.body.user.id, quantity: 2 }),
    ]);
  });

  it("creates paid prototype-card orders and wallet ledger records", async () => {
    const { product } = await createApprovedProduct({ price: 10000, quantityAvailable: 1 });
    const customer = await createCustomer();
    await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
    });

    const checkout = await requestJson("/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({
        deliveryOption: "pickup",
        deliveryArea: "Fagge",
        paymentMethod: "card",
      }),
    });

    expect(checkout.status).toBe(201);
    expect(checkout.body.order).toMatchObject({
      paymentStatus: "paid",
      deliveryFee: 0,
      subtotal: 10000,
      commissionTotal: 1000,
      vendorPayoutTotal: 9000,
      payment: expect.objectContaining({
        status: "paid",
        gateway: "prototype",
        verifiedAt: expect.any(String),
      }),
    });
    expect(Array.from(app.store.walletLedger.values())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "vendor_pending_credit", amount: 9000, status: "pending" }),
        expect.objectContaining({ type: "platform_commission", amount: 1000, status: "available" }),
      ]),
    );
    expect(app.store.products.get(product.body.product.id).listingStatus).toBe("out_of_stock");
  });

  it("blocks checkout when stock is no longer available", async () => {
    const { product } = await createApprovedProduct({ quantityAvailable: 1 });
    const customer = await createCustomer();
    await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
    });
    app.store.products.set(product.body.product.id, {
      ...app.store.products.get(product.body.product.id),
      quantityAvailable: 0,
    });

    const checkout = await requestJson("/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({
        deliveryOption: "pickup",
        deliveryArea: "Fagge",
        paymentMethod: "card",
      }),
    });

    expect(checkout.status).toBe(409);
    expect(checkout.body.error.code).toBe("insufficient_stock");
  });

  it("lets admins view all orders and payments", async () => {
    const { product } = await createApprovedProduct();
    const customer = await createCustomer();
    await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
    });
    await requestJson("/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({
        deliveryOption: "pickup",
        deliveryArea: "Fagge",
        paymentMethod: "pay_on_delivery",
      }),
    });
    const admin = await registerAdmin();

    const orders = await requestJson("/admin/orders", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });
    const payments = await requestJson("/admin/payments", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });

    expect(orders.body.orders).toHaveLength(1);
    expect(payments.body.payments).toHaveLength(1);
    expect(payments.body.payments[0]).toMatchObject({
      method: "pay_on_delivery",
      status: "pending",
    });
  });
});
