import { beforeEach, describe, expect, it } from "vitest";
import { createApp, createMemoryStore, inject } from "../api/server.mjs";

type TestApi = {
  app: ReturnType<typeof createApp>;
  store: ReturnType<typeof createMemoryStore>;
};

let api: TestApi;

function startTestApi(): TestApi {
  const store = createMemoryStore();
  const app = createApp({
    store,
    allowedOrigin: "*",
  });

  return { app, store };
}

async function requestJson(path: string, init: RequestInit = {}) {
  return await inject(api.app, {
    path,
    method: init.method,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.body?.toString(),
  });
}

beforeEach(() => {
  api = startTestApi();
});

describe("Kano Mart API auth boundary", () => {
  it("responds to health checks", async () => {
    const response = await requestJson("/health");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", service: "kano-mart-api" });
  });

  it("registers a customer, creates a session, and hides password hashes", async () => {
    const signup = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "08012345678",
        email: "aisha@example.com",
        password: "password123",
        firstName: "Aisha",
        lastName: "Bello",
        role: "customer",
        deliveryAddress: "Tarauni, Kano",
      }),
    });

    expect(signup.status).toBe(201);
    expect(signup.headers["set-cookie"]).toContain("kano_session=");
    expect(signup.body.user).toMatchObject({
      phone: "+2348012345678",
      email: "aisha@example.com",
      name: "Aisha Bello",
      role: "customer",
    });
    expect(signup.body.user.passwordHash).toBeUndefined();

    const me = await requestJson("/me", {
      headers: {
        authorization: `Bearer ${signup.body.token}`,
      },
    });

    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ name: "Aisha Bello", role: "customer" });
  });

  it("rejects duplicate phone numbers", async () => {
    const body = {
      phone: "08012345678",
      password: "password123",
      firstName: "Aisha",
      lastName: "Bello",
      role: "customer",
    };

    expect((await requestJson("/auth/register", { method: "POST", body: JSON.stringify(body) })).status).toBe(201);
    const duplicate = await requestJson("/auth/register", { method: "POST", body: JSON.stringify(body) });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("user_exists");
  });

  it("creates a pending vendor application during vendor registration", async () => {
    const signup = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "08098765432",
        password: "password123",
        firstName: "Musa",
        lastName: "Garba",
        role: "vendor",
        businessName: "Musa Wears",
        area: "Fagge",
        category: "fashion",
      }),
    });

    expect(signup.status).toBe(201);
    expect(signup.body.user).toMatchObject({ role: "vendor", vendorStatus: "pending" });
    expect(Array.from(api.store.vendorApplications.values())).toContainEqual(
      expect.objectContaining({
        businessName: "Musa Wears",
        area: "Fagge",
        category: "fashion",
        status: "pending",
      }),
    );
  });

  it("protects admin-only routes", async () => {
    const customerSignup = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "08012345678",
        password: "password123",
        firstName: "Aisha",
        lastName: "Bello",
        role: "customer",
      }),
    });

    const forbidden = await requestJson("/admin/users", {
      headers: {
        authorization: `Bearer ${customerSignup.body.token}`,
      },
    });

    expect(forbidden.status).toBe(403);

    const adminSignup = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "08000000000",
        password: "password123",
        firstName: "Ignored",
        lastName: "Admin",
        role: "customer",
      }),
    });

    const adminUsers = await requestJson("/admin/users", {
      headers: {
        authorization: `Bearer ${adminSignup.body.token}`,
      },
    });

    expect(adminUsers.status).toBe(200);
    expect(adminUsers.body.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: "customer", phone: "+2348012345678" }),
        expect.objectContaining({ role: "admin", phone: "+2348000000000" }),
      ]),
    );
  });
});
