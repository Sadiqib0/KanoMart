const DEFAULT_API_BASE_URL = "/api";

type RequestOptions = {
  token?: string;
  body?: unknown;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
};

function getApiBaseUrl(): string {
  const configured = globalThis.localStorage?.getItem("kanoMart.apiBaseUrl")?.trim();
  return configured || DEFAULT_API_BASE_URL;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
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
  products: (query = "") => apiRequest<{ products: unknown[] }>(`/products${query ? `?q=${encodeURIComponent(query)}` : ""}`),
  login: (identifier: string, password: string) =>
    apiRequest<{ user: unknown; token: string }>("/auth/login", {
      body: { identifier, password },
    }),
  register: (body: unknown) => apiRequest<{ user: unknown; token: string }>("/auth/register", { body }),
  cart: () => apiRequest<{ cart: unknown }>("/cart"),
  addCartItem: (productId: string, quantity: number) =>
    apiRequest<{ cart: unknown }>("/cart/items", {
      body: { productId, quantity },
    }),
  checkout: (body: unknown) => apiRequest<{ order: unknown; cart: unknown }>("/checkout", { body }),
};
