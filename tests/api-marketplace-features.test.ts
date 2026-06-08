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
      quantityAvailable: 5,
      area: "Fagge",
      tags: ["jallabiya", "kaya"],
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

async function createCustomer(phone = "08012345678") {
  return await registerUser({
    phone,
    firstName: "Aisha",
    lastName: "Bello",
    role: "customer",
  });
}

async function checkoutDeliveredPaidOrder() {
  const { vendor, product } = await createApprovedProduct();
  const customer = await createCustomer();
  await requestJson("/cart/items", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
  });
  const checkout = await requestJson("/checkout", {
    method: "POST",
    headers: { authorization: `Bearer ${customer.body.token}` },
    body: JSON.stringify({ deliveryOption: "pickup", deliveryArea: "Fagge", paymentMethod: "card" }),
  });
  const admin = await registerAdmin();
  for (const status of ["preparing_order", "ready_for_pickup", "delivered"]) {
    await requestJson(`/admin/orders/${checkout.body.order.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status }),
    });
  }
  return { vendor, product, customer, admin, order: checkout.body.order };
}

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });
});

describe("remaining Kano Mart marketplace API features", () => {
  it("supports wishlist save and remove for customers", async () => {
    const { product } = await createApprovedProduct();
    const customer = await createCustomer();

    const saved = await requestJson("/wishlist", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id }),
    });
    const removed = await requestJson(`/wishlist/${product.body.product.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${customer.body.token}` },
    });

    expect(saved.body.products).toEqual([expect.objectContaining({ id: product.body.product.id })]);
    expect(removed.body.products).toEqual([]);
  });

  it("supports delivered-order reviews, vendor review visibility, and admin moderation", async () => {
    const { vendor, product, customer } = await checkoutDeliveredPaidOrder();

    const review = await requestJson("/reviews", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, rating: 5, comment: "Excellent quality." }),
    });
    const vendorReviews = await requestJson("/vendor/reviews", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });
    const admin = await registerAdmin();
    const hidden = await requestJson(`/admin/reviews/${review.body.review.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ hidden: true, adminNote: "Removed from public page." }),
    });
    const publicReviews = await requestJson(`/products/${product.body.product.id}/reviews`);

    expect(review.status).toBe(201);
    expect(vendorReviews.body.reviews).toEqual([expect.objectContaining({ rating: 5 })]);
    expect(hidden.body.review).toMatchObject({ hidden: true, adminNote: "Removed from public page." });
    expect(publicReviews.body.reviews).toEqual([]);
  });

  it("applies admin promotions during checkout server-side", async () => {
    const { product } = await createApprovedProduct({ price: 10000 });
    const admin = await registerAdmin();
    await requestJson("/admin/promotions", {
      method: "POST",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({
        title: { en: "Eid fashion sale", ha: "Rangwamen Eid" },
        type: "discount_code",
        discountPercent: 20,
        code: "EID20",
        category: "fashion",
      }),
    });
    const customer = await createCustomer();
    await requestJson("/cart/items", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ productId: product.body.product.id, quantity: 1 }),
    });

    const checkout = await requestJson("/checkout", {
      method: "POST",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ deliveryOption: "pickup", deliveryArea: "Fagge", paymentMethod: "card", promotionCode: "EID20" }),
    });

    expect(checkout.body.order).toMatchObject({
      subtotal: 8000,
      commissionTotal: 800,
      vendorPayoutTotal: 7200,
      items: [expect.objectContaining({ unitPrice: 8000, originalUnitPrice: 10000, discountAmount: 2000 })],
    });
  });

  it("supports vendor wallet summaries and payout approval", async () => {
    const { vendor, admin } = await checkoutDeliveredPaidOrder();

    const wallet = await requestJson("/vendor/wallet", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });
    const payout = await requestJson("/vendor/payouts", {
      method: "POST",
      headers: { authorization: `Bearer ${vendor.body.token}` },
      body: JSON.stringify({
        amount: 5000,
        bankName: "Kano Bank",
        accountNumber: "0123456789",
        accountName: "Musa Garba",
      }),
    });
    const approved = await requestJson(`/admin/payouts/${payout.body.payout.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "approved", adminNote: "Paid manually." }),
    });
    const nextWallet = await requestJson("/vendor/wallet", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });

    expect(wallet.body.wallet).toMatchObject({ availableBalance: 9000, pendingBalance: 0 });
    expect(approved.body.payout).toMatchObject({ status: "approved", adminNote: "Paid manually." });
    expect(nextWallet.body.wallet.availableBalance).toBe(4000);
  });

  it("tracks notifications and lets users mark them read", async () => {
    const { vendor } = await createApprovedProduct();

    const notifications = await requestJson("/notifications", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });
    const read = await requestJson(`/notifications/${notifications.body.notifications[0].id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });

    expect(notifications.body.notifications.length).toBeGreaterThan(0);
    expect(read.body.notification.readAt).toEqual(expect.any(String));
  });

  it("manages bilingual categories and returns analytics", async () => {
    const { product } = await createApprovedProduct();
    const admin = await registerAdmin();
    await requestJson("/admin/categories", {
      method: "POST",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({
        key: "wedding",
        name: { en: "Wedding", ha: "Biki" },
        searchTerms: ["wedding", "biki", "fabric"],
      }),
    });
    await requestJson(`/products/${product.body.product.id}`);
    await requestJson("/products?q=jallabiya");
    await requestJson("/products?q=jallabiya");

    const categories = await requestJson("/categories");
    const analytics = await requestJson("/admin/analytics", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });

    expect(categories.body.categories).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "wedding", name: { en: "Wedding", ha: "Biki" } })]),
    );
    expect(analytics.body.analytics).toMatchObject({
      productViews: [expect.objectContaining({ productId: product.body.product.id, views: 1 })],
      popularSearches: [expect.objectContaining({ query: "jallabiya", count: 2 })],
    });
  });
});
