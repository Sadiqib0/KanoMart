import type { Product } from "../backend/types";
import { moderateProduct, setLiveProducts, setLiveVendorProducts } from "../backend/products";
import { setLiveVendorRequests } from "../backend/vendors";
import {
  api,
  type ApiProduct,
  type ApiVendorApplication,
  type ApiOrder,
  type ApiPayment,
  type ApiReview,
  type ApiPromotion,
  type ApiPayoutRequest,
  type ApiAnalytics,
  type ApiWallet,
  type ApiNotification,
  type ApiUser,
  type ApiCategory,
} from "./api-client";

let liveProducts: Product[] = [];

export function getLiveProducts(): Product[] {
  return liveProducts;
}

/** Merge products into the live cache without replacing it — used when the
 * server cart returns product objects the catalog hasn't fetched yet, so
 * cart rows can always resolve a product for display. */
export function mergeLiveProducts(products: Product[]): void {
  if (!products.length) return;
  const byId = new Map(liveProducts.map((p) => [p.id, p]));
  for (const product of products) byId.set(product.id, product);
  liveProducts = [...byId.values()];
  setLiveProducts(liveProducts);
}

const categoryLabels: Record<string, Product["category"]> = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" },
};

function formatApiPrice(amount: number): string {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString("en-NG")}`;
}

export function mapApiProduct(product: ApiProduct): Product {
  const nameEn = product.name?.en || product.name?.ha || "Product";
  const nameHa = product.name?.ha || product.name?.en || nameEn;
  const category = categoryLabels[product.category] ?? {
    en: product.category || "Essentials",
    ha: product.category || "Kayan yau da kullum",
  };

  return {
    id: product.id,
    name: { en: nameEn, ha: nameHa },
    description: {
      en: product.description?.en || "",
      ha: product.description?.ha || product.description?.en || "",
    },
    category,
    subcategory: { en: "Live vendor product", ha: "Kayan dillali live" },
    price: formatApiPrice(product.price),
    quantityAvailable: product.quantityAvailable ?? 0,
    imageDataUrl: product.imageUrl,
    vendor: product.vendorName || "Kano Mart vendor",
    vendorPhone: product.vendorPhone,
    area: product.area || "Kano",
    availability:
      (product.quantityAvailable ?? 0) > 0
        ? { en: "Available now", ha: "Akwai yanzu" }
        : { en: "Out of stock", ha: "Ya kare" },
    listingStatus: product.listingStatus ?? "active",
    moderationStatus: product.moderationStatus,
    accent: "#176b4d",
    tags: [nameEn, nameHa, product.category, product.vendorName, product.area, ...(product.tags ?? [])]
      .filter(Boolean)
      .map((item) => String(item).toLowerCase()),
    createdAt: product.createdAt,
  };
}

function mapApiVendorApplication(application: ApiVendorApplication) {
  return {
    id: application.id,
    businessName: application.businessName,
    phone: application.phone,
    area: application.area,
    category: application.category,
    status: application.status,
    reviewedAt: application.reviewedAt,
    reviewNote: application.adminNote,
    createdAt: application.createdAt,
  };
}

export async function refreshLiveProducts(params: { q?: string; category?: string } = {}): Promise<Product[]> {
  const response = await api.products(params);
  const products = response.products.map(mapApiProduct);
  liveProducts = products;
  setLiveProducts(products);
  return products;
}

export async function refreshLiveVendorProducts(): Promise<Product[]> {
  const response = await api.vendorProducts();
  const products = response.products.map(mapApiProduct);
  setLiveVendorProducts(products);
  return products;
}

export async function refreshLiveAdminQueues(): Promise<void> {
  const [vendors, products] = await Promise.all([
    api.adminVendorApplications().catch(() => ({ applications: [] as ApiVendorApplication[] })),
    api.adminProducts().catch(() => ({ products: [] as ApiProduct[] })),
  ]);
  if (vendors.applications.length) setLiveVendorRequests(vendors.applications.map(mapApiVendorApplication));
  if (products.products.length) {
    setLiveProducts(products.products.map(mapApiProduct));
    for (const product of products.products) {
      if (product.moderationStatus) {
        moderateProduct(product.id, product.moderationStatus, "Synced from live admin API");
      }
    }
  }
}

// Live admin data fetched for the admin dashboard, keyed by last-fetch results
export type LiveAdminData = {
  orders: ApiOrder[];
  payments: ApiPayment[];
  reviews: ApiReview[];
  promotions: ApiPromotion[];
  payouts: ApiPayoutRequest[];
  analytics: ApiAnalytics | null;
  users: ApiUser[];
};

let liveAdminData: LiveAdminData | null = null;

export function getLiveAdminData(): LiveAdminData | null {
  return liveAdminData;
}

export async function fetchLiveAdminData(): Promise<LiveAdminData> {
  const [ordersRes, paymentsRes, reviewsRes, promotionsRes, payoutsRes, analyticsRes, usersRes] = await Promise.all([
    api.adminOrders().catch(() => ({ orders: [] as ApiOrder[] })),
    api.adminPayments().catch(() => ({ payments: [] as ApiPayment[] })),
    api.adminReviews().catch(() => ({ reviews: [] as ApiReview[] })),
    api.adminPromotions().catch(() => ({ promotions: [] as ApiPromotion[] })),
    api.adminPayouts().catch(() => ({ payouts: [] as ApiPayoutRequest[] })),
    api.adminAnalytics().catch(() => ({ analytics: null as ApiAnalytics | null })),
    api.adminUsers().catch(() => ({ users: [] as ApiUser[] })),
  ]);

  liveAdminData = {
    orders: ordersRes.orders,
    payments: paymentsRes.payments,
    reviews: reviewsRes.reviews,
    promotions: promotionsRes.promotions,
    payouts: payoutsRes.payouts,
    analytics: analyticsRes.analytics,
    users: usersRes.users,
  };
  return liveAdminData;
}

// Live vendor data keyed by last-fetch results
export type LiveVendorData = {
  orders: ApiOrder[];
  reviews: ApiReview[];
  wallet: ApiWallet | null;
  payouts: ApiPayoutRequest[];
};

let liveVendorData: LiveVendorData | null = null;

export function getLiveVendorData(): LiveVendorData | null {
  return liveVendorData;
}

export async function fetchLiveVendorData(): Promise<LiveVendorData> {
  const [ordersRes, reviewsRes, walletRes] = await Promise.all([
    api.vendorOrders().catch(() => ({ orders: [] as ApiOrder[] })),
    api.vendorReviews().catch(() => ({ reviews: [] as ApiReview[] })),
    api.vendorWallet().catch(() => ({ wallet: null as ApiWallet | null, payouts: [] as ApiPayoutRequest[] })),
  ]);

  liveVendorData = {
    orders: ordersRes.orders,
    reviews: reviewsRes.reviews,
    wallet: walletRes.wallet,
    payouts: walletRes.payouts,
  };
  return liveVendorData;
}

// Live notifications
let liveNotifications: ApiNotification[] = [];

export function getLiveNotifications(): ApiNotification[] {
  return liveNotifications;
}

export async function fetchLiveNotifications(): Promise<ApiNotification[]> {
  const res = await api.notifications().catch(() => ({ notifications: [] as ApiNotification[] }));
  liveNotifications = res.notifications;
  return liveNotifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.markNotificationRead(id).catch(() => undefined);
  const notification = liveNotifications.find((n) => n.id === id);
  if (notification) notification.readAt = new Date().toISOString();
}

// Live categories
let liveCategories: ApiCategory[] = [];

export function getLiveCategories(): ApiCategory[] {
  return liveCategories;
}

export async function fetchLiveCategories(): Promise<ApiCategory[]> {
  const res = await api.categories().catch(() => ({ categories: [] as ApiCategory[] }));
  liveCategories = res.categories;
  return liveCategories;
}

// Validate existing session token and return refreshed user data
export async function refreshSession(): Promise<ApiUser | null> {
  const res = await api.me().catch(() => null);
  return res?.user ?? null;
}

// Live vendor application status
let liveVendorApplication: ApiVendorApplication | null = null;

export function getLiveVendorApplication(): ApiVendorApplication | null {
  return liveVendorApplication;
}

export async function fetchLiveVendorApplication(): Promise<ApiVendorApplication | null> {
  const res = await api.vendorApplication().catch(() => null);
  liveVendorApplication = res?.application ?? null;
  return liveVendorApplication;
}
