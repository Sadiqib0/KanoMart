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
  reviewNote?: string;
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

export type ApiCartItem = {
  productId: string;
  quantity: number;
  product?: ApiProduct;
  lineTotal?: number;
  addedAt?: string;
  updatedAt?: string;
};

export type ApiCart = {
  items: ApiCartItem[];
  subtotal: number;
};

export type ApiOrderItem = {
  productId: string;
  vendorUserId?: string;
  vendorName?: string;
  name?: { en?: string; ha?: string };
  unitPrice?: number;
  quantity: number;
  lineTotal?: number;
};

export type ApiOrder = {
  id: string;
  customerUserId?: string;
  customerName?: string;
  customerPhone?: string;
  items: ApiOrderItem[];
  deliveryOption?: "delivery" | "pickup";
  deliveryAddress?: string;
  deliveryArea?: string;
  deliveryFee?: number;
  deliveryPerson?: string;
  paymentMethod?: string;
  paymentReference?: string;
  paymentStatus?: string;
  subtotal?: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
};

export type ApiPayment = {
  id: string;
  orderId: string;
  reference?: string;
  method?: string;
  gateway?: string;
  amount: number;
  currency?: string;
  status: string;
  adminNote?: string;
  createdAt: string;
  verifiedAt?: string;
  failedAt?: string;
  refundedAt?: string;
};

export type ApiNotification = {
  id: string;
  audience?: string;
  recipientUserId?: string;
  title: string;
  message: string;
  type?: string;
  orderId?: string;
  productId?: string;
  readAt?: string;
  createdAt: string;
};

export type ApiReview = {
  id: string;
  productId: string;
  productName?: string;
  vendorUserId?: string;
  customerUserId?: string;
  reviewerName?: string;
  rating: number;
  comment: string;
  hidden?: boolean;
  adminNote?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ApiPromotion = {
  id: string;
  title: { en?: string; ha?: string };
  type: string;
  discountPercent?: number;
  code?: string;
  productId?: string;
  vendorUserId?: string;
  category?: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ApiPayoutRequest = {
  id: string;
  vendorUserId?: string;
  amount: number;
  status: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  adminNote?: string;
  requestedAt?: string;
  reviewedAt?: string;
};

export type ApiWallet = {
  vendorUserId: string;
  pendingBalance: number;
  availableBalance: number;
  totalCommission: number;
};

export type ApiCategory = {
  key: string;
  name: { en?: string; ha?: string };
  searchTerms?: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type ApiAnalytics = {
  totalSales: number;
  totalOrders: number;
  cancelledOrders: number;
  customerGrowth: number;
  vendorGrowth: number;
  productViews: Array<{ productId: string; views: number }>;
  popularSearches: Array<{ query: string; count: number }>;
  bestSellingProducts: Array<{ productId: string; quantity: number; sales: number }>;
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
  // Health
  health: () => apiRequest<{ status: string }>("/health"),

  // Auth
  me: () => apiRequest<{ user: ApiUser }>("/me"),
  updateMe: (body: { name?: string; email?: string; deliveryAddress?: string; preferredLanguage?: string }) =>
    apiRequest<{ user: ApiUser }>("/me", { method: "PATCH", body }),
  login: (identifier: string, password: string) =>
    apiRequest<ApiAuthResponse>("/auth/login", { body: { identifier, password } }),
  register: (body: unknown) => apiRequest<ApiAuthResponse>("/auth/register", { body }),
  logout: () => apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" }),

  // Catalog
  categories: () => apiRequest<{ categories: ApiCategory[] }>("/categories"),
  products: (params: { q?: string; category?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    const query = qs.toString();
    return apiRequest<{ products: ApiProduct[] }>(`/products${query ? `?${query}` : ""}`);
  },
  product: (id: string) => apiRequest<{ product: ApiProduct }>(`/products/${encodeURIComponent(id)}`),
  productReviews: (productId: string) =>
    apiRequest<{ reviews: ApiReview[] }>(`/products/${encodeURIComponent(productId)}/reviews`),

  // Notifications
  notifications: () => apiRequest<{ notifications: ApiNotification[] }>("/notifications"),
  markNotificationRead: (id: string) =>
    apiRequest<{ notification: ApiNotification }>(`/notifications/${encodeURIComponent(id)}`, { method: "PATCH", body: {} }),

  // Wishlist
  wishlist: () => apiRequest<{ products: ApiProduct[] }>("/wishlist"),
  addToWishlist: (productId: string) => apiRequest<{ products: ApiProduct[] }>("/wishlist", { body: { productId } }),
  removeFromWishlist: (productId: string) =>
    apiRequest<{ products: ApiProduct[] }>(`/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" }),

  // Cart
  cart: () => apiRequest<{ cart: ApiCart }>("/cart"),
  addCartItem: (productId: string, quantity: number) =>
    apiRequest<{ cart: ApiCart }>("/cart/items", { body: { productId, quantity } }),
  updateCartItem: (productId: string, quantity: number) =>
    apiRequest<{ cart: ApiCart }>(`/cart/items/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      body: { quantity },
    }),
  removeCartItem: (productId: string) =>
    apiRequest<{ cart: ApiCart }>(`/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),

  // Checkout & Orders
  checkout: (body: unknown) => apiRequest<{ order: ApiOrder; cart: ApiCart }>("/checkout", { body }),
  orders: () => apiRequest<{ orders: ApiOrder[] }>("/orders"),

  // Reviews
  createReview: (body: { productId: string; rating: number; comment: string }) =>
    apiRequest<{ review: ApiReview }>("/reviews", { body }),

  // Vendor
  vendorApplication: () => apiRequest<{ application: ApiVendorApplication }>("/vendor/application"),
  vendorProducts: () => apiRequest<{ products: ApiProduct[] }>("/vendor/products"),
  createVendorProduct: (body: unknown) => apiRequest<{ product: ApiProduct }>("/vendor/products", { body }),
  updateVendorProduct: (id: string, listingStatus: "active" | "out_of_stock" | "taken_down") =>
    apiRequest<{ product: ApiProduct }>(`/vendor/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { listingStatus },
    }),
  uploadVendorImage: (body: unknown) => apiRequest<{ upload: ApiUpload }>("/vendor/uploads", { body }),
  vendorOrders: () => apiRequest<{ orders: ApiOrder[] }>("/vendor/orders"),
  vendorReviews: () => apiRequest<{ reviews: ApiReview[] }>("/vendor/reviews"),
  vendorWallet: () => apiRequest<{ wallet: ApiWallet; payouts: ApiPayoutRequest[] }>("/vendor/wallet"),
  requestPayout: (body: { amount: number; bankName: string; accountNumber: string; accountName: string }) =>
    apiRequest<{ payout: ApiPayoutRequest }>("/vendor/payouts", { body }),

  // Admin — Users
  adminUsers: () => apiRequest<{ users: ApiUser[] }>("/admin/users"),

  // Admin — Categories
  adminCreateCategory: (body: unknown) => apiRequest<{ category: ApiCategory }>("/admin/categories", { body }),

  // Admin — Vendor applications
  adminVendorApplications: (status?: string) =>
    apiRequest<{ applications: ApiVendorApplication[] }>(
      `/admin/vendor-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`
    ),
  updateVendorApplication: (id: string, body: unknown) =>
    apiRequest<{ application: ApiVendorApplication }>(`/admin/vendor-applications/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),

  // Admin — Products
  adminProducts: (status?: string) =>
    apiRequest<{ products: ApiProduct[] }>(`/admin/products${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateAdminProduct: (id: string, body: unknown) =>
    apiRequest<{ product: ApiProduct }>(`/admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  // Admin — Orders
  adminOrders: () => apiRequest<{ orders: ApiOrder[] }>("/admin/orders"),
  updateAdminOrder: (id: string, body: { status: string; deliveryPerson?: string }) =>
    apiRequest<{ order: ApiOrder }>(`/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  // Admin — Payments
  adminPayments: () => apiRequest<{ payments: ApiPayment[] }>("/admin/payments"),
  updateAdminPayment: (id: string, body: { status: "paid" | "failed" | "refunded"; adminNote?: string }) =>
    apiRequest<{ payment: ApiPayment; order: ApiOrder }>(`/admin/payments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body,
    }),

  // Admin — Reviews
  adminReviews: () => apiRequest<{ reviews: ApiReview[] }>("/admin/reviews"),
  updateAdminReview: (id: string, body: { hidden: boolean; adminNote?: string }) =>
    apiRequest<{ review: ApiReview }>(`/admin/reviews/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  // Admin — Promotions
  adminPromotions: () => apiRequest<{ promotions: ApiPromotion[] }>("/admin/promotions"),
  createAdminPromotion: (body: unknown) => apiRequest<{ promotion: ApiPromotion }>("/admin/promotions", { body }),
  updateAdminPromotion: (id: string, body: { active: boolean }) =>
    apiRequest<{ promotion: ApiPromotion }>(`/admin/promotions/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  // Admin — Payouts
  adminPayouts: () => apiRequest<{ payouts: ApiPayoutRequest[] }>("/admin/payouts"),
  updateAdminPayout: (id: string, body: { status: "approved" | "rejected"; adminNote?: string }) =>
    apiRequest<{ payout: ApiPayoutRequest }>(`/admin/payouts/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  // Admin — Analytics
  adminAnalytics: () => apiRequest<{ analytics: ApiAnalytics }>("/admin/analytics"),
};
