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
  const list = await requestJson("/admin/vendor-applications", {
    headers: { authorization: `Bearer ${admin.body.token}` },
  });
  const application = list.body.applications.find((item: { user: { id: string } }) => {
    const sessionUser = app.store.sessions.get(vendorToken)?.userId;
    return item.user.id === sessionUser;
  });

  return await requestJson(`/admin/vendor-applications/${application.id}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${admin.body.token}` },
    body: JSON.stringify({ status: "approved" }),
  });
}

async function createApprovedVendor() {
  const vendor = await registerUser({
    phone: "08098765432",
    firstName: "Musa",
    lastName: "Garba",
    role: "vendor",
    businessName: "Musa Wears",
    area: "Fagge",
    category: "fashion",
  });
  await approveVendor(vendor.body.token);
  return vendor;
}

async function createProduct(vendorToken: string, input: Record<string, unknown> = {}) {
  return await requestJson("/vendor/products", {
    method: "POST",
    headers: { authorization: `Bearer ${vendorToken}` },
    body: JSON.stringify({
      name: { en: "Black Jallabiya", ha: "Jallabiya Baki" },
      description: { en: "Plain black jallabiya", ha: "Jallabiya baki mai kyau" },
      category: "fashion",
      price: 15000,
      quantityAvailable: 8,
      area: "Fagge",
      tags: ["jallabiya", "clothes"],
      ...input,
    }),
  });
}

async function uploadVendorImage(vendorToken: string, dataUrl: string) {
  return await requestJson("/vendor/uploads", {
    method: "POST",
    headers: { authorization: `Bearer ${vendorToken}` },
    body: JSON.stringify({
      fileName: "product.jpg",
      mimeType: "image/jpeg",
      dataUrl,
    }),
  });
}

beforeEach(() => {
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });
});

describe("Kano Mart API products and catalog", () => {
  it("blocks pending vendors from creating products", async () => {
    const vendor = await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
    });

    const response = await createProduct(vendor.body.token);

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("vendor_not_approved");
  });

  it("blocks pending vendors from uploading product images", async () => {
    const vendor = await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
    });

    const response = await uploadVendorImage(vendor.body.token, "data:image/jpeg;base64,abcd");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("vendor_not_approved");
  });

  it("accepts approved vendor uploads below the server data-url limit", async () => {
    const vendor = await createApprovedVendor();

    const response = await uploadVendorImage(vendor.body.token, `data:image/jpeg;base64,${"a".repeat(2_000)}`);

    expect(response.status).toBe(201);
    expect(response.body.upload).toMatchObject({
      fileName: "product.jpg",
      mimeType: "image/jpeg",
    });
    expect(response.body.upload.url).toEqual(expect.any(String));
  });

  it("rejects approved vendor uploads above the server data-url limit", async () => {
    const vendor = await createApprovedVendor();

    const response = await uploadVendorImage(vendor.body.token, `data:image/jpeg;base64,${"a".repeat(750_001)}`);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe("validation_failed");
    expect(response.body.error.details.dataUrl).toBe("Image upload is too large.");
  });

  it("lets approved vendors create pending products", async () => {
    const vendor = await createApprovedVendor();

    const response = await createProduct(vendor.body.token);

    expect(response.status).toBe(201);
    expect(response.body.product).toMatchObject({
      vendorName: "Musa Garba",
      name: { en: "Black Jallabiya", ha: "Jallabiya Baki" },
      category: "fashion",
      price: 15000,
      currency: "NGN",
      quantityAvailable: 8,
      listingStatus: "active",
      moderationStatus: "pending",
    });
  });

  it("keeps pending products out of the public catalog until admin approval", async () => {
    const vendor = await createApprovedVendor();
    const product = await createProduct(vendor.body.token);

    expect((await requestJson("/products")).body.products).toHaveLength(0);

    const adminLogin = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "08000000000", password: "password123" }),
    });
    const approval = await requestJson(`/admin/products/${product.body.product.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
      body: JSON.stringify({ status: "approved", reviewNote: "Image and price verified." }),
    });

    expect(approval.status).toBe(200);
    expect(approval.body.product).toMatchObject({
      moderationStatus: "approved",
      reviewNote: "Image and price verified.",
    });

    const catalog = await requestJson("/products?q=jallabiya&category=fashion");
    expect(catalog.body.products).toEqual([
      expect.objectContaining({
        id: product.body.product.id,
        moderationStatus: "approved",
      }),
    ]);
    expect(catalog.body.products[0]).not.toHaveProperty("reviewNote");
  });

  it("lets admins list products by moderation status", async () => {
    const vendor = await createApprovedVendor();
    await createProduct(vendor.body.token);
    const adminLogin = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "08000000000", password: "password123" }),
    });

    const pendingProducts = await requestJson("/admin/products?status=pending", {
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
    });

    expect(pendingProducts.status).toBe(200);
    expect(pendingProducts.body.products).toHaveLength(1);
    expect(pendingProducts.body.products[0]).toMatchObject({ moderationStatus: "pending" });
  });

  it("lets vendors take their approved products out of the public catalog", async () => {
    const vendor = await createApprovedVendor();
    const product = await createProduct(vendor.body.token);
    const adminLogin = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "08000000000", password: "password123" }),
    });
    await requestJson(`/admin/products/${product.body.product.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${adminLogin.body.token}` },
      body: JSON.stringify({ status: "approved" }),
    });

    expect((await requestJson("/products")).body.products).toHaveLength(1);

    const update = await requestJson(`/vendor/products/${product.body.product.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${vendor.body.token}` },
      body: JSON.stringify({ listingStatus: "out_of_stock" }),
    });

    expect(update.status).toBe(200);
    expect(update.body.product).toMatchObject({ listingStatus: "out_of_stock" });
    expect((await requestJson("/products")).body.products).toHaveLength(0);
  });

  it("prevents vendors from updating another vendor's product", async () => {
    const firstVendor = await createApprovedVendor();
    const product = await createProduct(firstVendor.body.token);

    const secondVendor = await registerUser({
      phone: "08055555555",
      firstName: "Sadiya",
      lastName: "Bello",
      role: "vendor",
      businessName: "Sadiya Stores",
    });
    await approveVendor(secondVendor.body.token);

    const response = await requestJson(`/vendor/products/${product.body.product.id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${secondVendor.body.token}` },
      body: JSON.stringify({ listingStatus: "taken_down" }),
    });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("product_not_found");
  });

  it("validates product creation input", async () => {
    const vendor = await createApprovedVendor();

    const response = await createProduct(vendor.body.token, {
      name: "",
      price: -1,
      quantityAvailable: 1.5,
    });

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({
      name: "Product name is required.",
      price: "Price must be greater than zero.",
      quantityAvailable: "Quantity must be a whole number greater than or equal to zero.",
    });
  });
});
