import { beforeEach, describe, expect, it } from "vitest";
import { createApp, createMemoryStore, inject } from "../backend/server.mjs";

type TestApi = {
  app: ReturnType<typeof createApp>;
};

let api: TestApi;

function startTestApi(): TestApi {
  const store = createMemoryStore();
  const app = createApp({ store, allowedOrigin: "*" });
  return { app };
}

async function requestJson(path: string, init: RequestInit = {}) {
  return await inject(api.app, {
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

beforeEach(() => {
  api = startTestApi();
});

describe("Kano Mart API vendor applications", () => {
  it("lets vendors view their own application", async () => {
    const vendor = await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
      area: "Fagge",
      category: "fashion",
    });

    const application = await requestJson("/vendor/application", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });

    expect(application.status).toBe(200);
    expect(application.body.application).toMatchObject({
      businessName: "Musa Wears",
      phone: "+2348098765432",
      area: "Fagge",
      category: "fashion",
      status: "pending",
      user: {
        role: "vendor",
        vendorStatus: "pending",
      },
    });
  });

  it("blocks customers from vendor application access", async () => {
    const customer = await registerUser({
      phone: "08012345678",
      firstName: "Aisha",
      lastName: "Bello",
      role: "customer",
    });

    const response = await requestJson("/vendor/application", {
      headers: { authorization: `Bearer ${customer.body.token}` },
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("forbidden");
  });

  it("lets admins list and filter vendor applications", async () => {
    await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
      area: "Fagge",
      category: "fashion",
    });
    const admin = await registerUser({
      phone: "08000000000",
      firstName: "Admin",
      lastName: "User",
      role: "customer",
    });

    const applications = await requestJson("/admin/vendor-applications?status=pending", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });

    expect(applications.status).toBe(200);
    expect(applications.body.applications).toHaveLength(1);
    expect(applications.body.applications[0]).toMatchObject({
      businessName: "Musa Wears",
      status: "pending",
    });
  });

  it("lets admins approve applications and updates the vendor session profile", async () => {
    const vendor = await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
      area: "Fagge",
      category: "fashion",
    });
    const admin = await registerUser({
      phone: "08000000000",
      firstName: "Admin",
      lastName: "User",
      role: "customer",
    });

    const list = await requestJson("/admin/vendor-applications", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });
    const applicationId = list.body.applications[0].id;

    const approval = await requestJson(`/admin/vendor-applications/${applicationId}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({
        status: "approved",
        adminNote: "Business details verified.",
      }),
    });

    expect(approval.status).toBe(200);
    expect(approval.body.application).toMatchObject({
      status: "approved",
      adminNote: "Business details verified.",
    });
    expect(approval.body.application.reviewedAt).toEqual(expect.any(String));

    const me = await requestJson("/me", {
      headers: { authorization: `Bearer ${vendor.body.token}` },
    });

    expect(me.body.user).toMatchObject({
      role: "vendor",
      vendorStatus: "approved",
    });
  });

  it("blocks customers from approving vendor applications", async () => {
    await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
    });
    const customer = await registerUser({
      phone: "08012345678",
      firstName: "Aisha",
      lastName: "Bello",
      role: "customer",
    });
    const admin = await registerUser({
      phone: "08000000000",
      firstName: "Admin",
      lastName: "User",
      role: "customer",
    });
    const list = await requestJson("/admin/vendor-applications", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });

    const response = await requestJson(`/admin/vendor-applications/${list.body.applications[0].id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${customer.body.token}` },
      body: JSON.stringify({ status: "approved" }),
    });

    expect(response.status).toBe(403);
  });

  it("validates vendor approval decisions", async () => {
    await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
    });
    const admin = await registerUser({
      phone: "08000000000",
      firstName: "Admin",
      lastName: "User",
      role: "customer",
    });
    const list = await requestJson("/admin/vendor-applications", {
      headers: { authorization: `Bearer ${admin.body.token}` },
    });

    const response = await requestJson(`/admin/vendor-applications/${list.body.applications[0].id}`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${admin.body.token}` },
      body: JSON.stringify({ status: "maybe" }),
    });

    expect(response.status).toBe(422);
    expect(response.body.error.details).toMatchObject({
      status: "Status must be approved or rejected.",
    });
  });
});
