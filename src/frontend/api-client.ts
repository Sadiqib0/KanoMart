const DEFAULT_API_BASE_URL = "/api";
const API_TOKEN_KEY = "kanoMart.apiToken";

type RequestOptions = {
  token?: string;
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
};

export type ApiUser = {
  id: string;
  phone: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  role: "customer" | "vendor" | "admin";
  deliveryAddress?: string;
  preferredLanguage?: "en" | "ha";
  vendorStatus?: "pending" | "approved" | "rejected";
  createdAt?: string;
};

export type ApiAuthResponse = {
  user: ApiUser;
  token: string;
  expiresAt?: string;
};

export type ApiProduct = {
  id: string;
  vendorUserId?: string;
  vendorName?: string;
  vendorPhone?: string;
  name: { en?: string; ha?: string };
  description?: { en?: string; ha?: string };
  category: string;
  price: number;
  currency?: "NGN";
  quantityAvailable?: number;
  area?: string;
  imageUrl?: string;
  tags?: string[];
  listingStatus?: "active" | "out_of_stock" | "taken_down";
  moderationStatus?: "pending" | "approved" | "hidden" | "rejected";
};

export type ApiVendorApplication = {
  id: string;
  userId: string;
  user?: ApiUser;
  businessName: string;
  phone: string;
  area: string;
  category: string;
  status: "pending" | "approved" | "rejected";
  adminNote?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ApiUpload = {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
};

function getApiBaseUrl(): string {
  const configured = globalThis.localStorage?.getItem("kanoMart.apiBaseUrl")?.trim();
  return configured || DEFAULT_API_BASE_URL;
}

export function getApiToken(): string {
  return globalThis.localStorage?.getItem(API_TOKEN_KEY) ?? "";
}

export function saveApiToken(token: string): void {
  if (token) globalThis.localStorage?.setItem(API_TOKEN_KEY, token);
}

export function clearApiToken(): void {
  globalThis.localStorage?.removeItem(API_TOKEN_KEY);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = options.token ?? getApiToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "API request failed");
  }

  return payload;
}

export const api = {
  health: () => apiRequest<{ status: string }>("/health"),
  me: () => apiRequest<{ user: ApiUser }>("/me"),
  products: (query = "") => apiRequest<{ products: ApiProduct[] }>(`/products${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  login: (identifier: string, password: string) =>
    apiRequest<ApiAuthResponse>("/auth/login", {
      body: { identifier, password },
    }),
  register: (body: unknown) => apiRequest<ApiAuthResponse>("/auth/register", { body }),
  logout: () => apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  uploadVendorImage: (body: unknown) => apiRequest<{ upload: ApiUpload }>("/vendor/uploads", { body }),
  createVendorProduct: (body: unknown) => apiRequest<{ product: ApiProduct }>("/vendor/products", { body }),
  adminVendorApplications: () => apiRequest<{ applications: ApiVendorApplication[] }>("/admin/vendor-applications"),
  updateVendorApplication: (id: string, body: unknown) =>
    apiRequest<{ application: ApiVendorApplication }>(`/admin/vendor-applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),
  adminProducts: () => apiRequest<{ products: ApiProduct[] }>("/admin/products"),
  updateAdminProduct: (id: string, body: unknown) =>
    apiRequest<{ product: ApiProduct }>(`/admin/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),
  cart: () => apiRequest<{ cart: unknown }>("/cart"),
  addCartItem: (productId: string, quantity: number) =>
    apiRequest<{ cart: unknown }>("/cart/items", {
      body: { productId, quantity },
    }),
  checkout: (body: unknown) => apiRequest<{ order: unknown; cart: unknown }>("/checkout", { body }),
};
