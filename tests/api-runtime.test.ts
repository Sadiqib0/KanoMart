import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, createMemoryStore, createRemoteStoreApp, inject } from "../api/server.mjs";

let app: ReturnType<typeof createApp>;
let originalBodyLimit: string | undefined;
let originalBlobToken: string | undefined;
let originalPublicApiBasePath: string | undefined;

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

beforeEach(() => {
  originalBodyLimit = process.env.API_BODY_LIMIT_BYTES;
  originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
  originalPublicApiBasePath = process.env.API_PUBLIC_BASE_PATH;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.API_PUBLIC_BASE_PATH;
  app = createApp({ store: createMemoryStore(), allowedOrigin: "*" });
});

afterEach(() => {
  if (originalBodyLimit === undefined) delete process.env.API_BODY_LIMIT_BYTES;
  else process.env.API_BODY_LIMIT_BYTES = originalBodyLimit;
  if (originalBlobToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  if (originalPublicApiBasePath === undefined) delete process.env.API_PUBLIC_BASE_PATH;
  else process.env.API_PUBLIC_BASE_PATH = originalPublicApiBasePath;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Kano Mart API runtime readiness", () => {
  it("persists API data to disk and reloads it", async () => {
    const dataFile = join(mkdtempSync(join(tmpdir(), "kano-api-")), "data.json");
    app = createApp({ dataFile, allowedOrigin: "*" });

    await registerUser({
      phone: "08012345678",
      firstName: "Aisha",
      lastName: "Bello",
      role: "customer",
    });

    const persisted = JSON.parse(readFileSync(dataFile, "utf8"));
    expect(persisted.data.users).toHaveLength(1);

    app = createApp({ dataFile, allowedOrigin: "*" });
    const login = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "08012345678", password: "password123" }),
    });

    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ name: "Aisha Bello", role: "customer" });
  });

  it("persists API data to a remote snapshot store and reloads it", async () => {
    let storedSnapshot = "";
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.includes("/get/")) {
        return new Response(JSON.stringify({ result: storedSnapshot || null }), { status: 200 });
      }
      if (requestUrl.includes("/set/")) {
        storedSnapshot = String(init?.body ?? "");
        return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
      }
      if (requestUrl.includes("/incr/")) {
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      if (requestUrl.includes("/expire/")) {
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const remoteStoreConfig = {
      url: "https://store.kano.test",
      token: "test-token",
      key: "kano:test",
    };

    app = await createRemoteStoreApp({ allowedOrigin: "*", remoteStoreConfig });
    await registerUser({
      phone: "08012345679",
      firstName: "Maryam",
      lastName: "Sani",
      role: "customer",
    });

    expect(JSON.parse(storedSnapshot).data.users).toHaveLength(1);

    app = await createRemoteStoreApp({ allowedOrigin: "*", remoteStoreConfig });
    const login = await requestJson("/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier: "08012345679", password: "password123" }),
    });

    expect(login.status).toBe(200);
    expect(login.body.user).toMatchObject({ name: "Maryam Sani", role: "customer" });
  });

  it("rate-limits excessive requests", async () => {
    app = createApp({
      store: createMemoryStore(),
      allowedOrigin: "*",
      rateLimit: { maxRequests: 1, windowMs: 60_000 },
    });

    expect((await requestJson("/health")).status).toBe(200);
    const limited = await requestJson("/health");

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limited");
  });

  it("rejects oversized request bodies", async () => {
    process.env.API_BODY_LIMIT_BYTES = "20";

    const response = await requestJson("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        phone: "08012345678",
        password: "password123",
        firstName: "Aisha",
        lastName: "Bello",
        role: "customer",
      }),
    });

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe("body_too_large");
  });

  it("lets approved vendors upload product images without changing payment behavior", async () => {
    const vendor = await registerUser({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      role: "vendor",
      businessName: "Musa Wears",
    });
    await approveVendor(vendor.body.token);

    const upload = await requestJson("/vendor/uploads", {
      method: "POST",
      headers: { authorization: `Bearer ${vendor.body.token}` },
      body: JSON.stringify({
        fileName: "jallabiya.png",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,aGVsbG8=",
      }),
    });

    expect(upload.status).toBe(201);
    expect(upload.body.upload).toMatchObject({
      fileName: "jallabiya.png",
      mimeType: "image/png",
    });
    expect(upload.body.upload.url).toMatch(/^\/uploads\//);
  });
});
