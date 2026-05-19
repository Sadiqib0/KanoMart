export type Language = "en" | "ha";
export type LocalizedString = Record<Language, string>;

export type OrderStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface Product {
  id: string;
  name: LocalizedString;
  category: LocalizedString;
  subcategory: LocalizedString;
  price: string;
  vendor: string;
  area: string;
  availability: LocalizedString;
  accent: string;
  tags: string[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: string;
}

export interface Order {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    name: string;
    price: string;
    priceValue: number;
  }>;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  paymentMethod: string;
  subtotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  productId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface UserSession {
  phone: string;
  name: string;
  createdAt: string;
}

export interface VendorProfile {
  name: string;
  area: string;
  rating: number;
  totalOrders: number;
  fulfillmentRate: number;
  responseTime: LocalizedString;
  since: string;
}

export interface SearchRecord {
  id: string;
  query: string;
  language: Language;
  resultCount: number;
  category: string;
  status: "matched" | "saved demand";
  createdAt: string;
}

export interface VendorRequest {
  id: string;
  businessName: string;
  phone: string;
  area: string;
  category: string;
  createdAt: string;
}

export interface AppState {
  language: Language;
  cartCount: number;
  lastQuery: string;
  lastResults: Product[];
  currentUser: UserSession | null;
  adminAuthenticated: boolean;
}

export interface DemoOrder {
  id: string;
  item: LocalizedString;
  status: LocalizedString;
}

export interface DemoPayment {
  label: LocalizedString;
  value: LocalizedString;
}

export interface RecordRow {
  label: string;
  value: LocalizedString | string;
}

export interface ToastOptions {
  message: string;
  type?: "success" | "info" | "error";
  duration?: number;
}
