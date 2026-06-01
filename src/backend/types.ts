export type Language = "en" | "ha";
export type LocalizedString = Record<Language, string>;

export type OrderStatus =
  | "awaiting_confirmation"
  | "preparing_order"
  | "ready_for_pickup"
  | "assigned_to_rider"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type DeliveryOption = "delivery" | "pickup";

export interface Product {
  id: string;
  name: LocalizedString;
  description?: LocalizedString;
  category: LocalizedString;
  subcategory: LocalizedString;
  price: string;
  quantityAvailable?: number;
  imageDataUrl?: string;
  vendor: string;
  vendorPhone?: string;
  area: string;
  availability: LocalizedString;
  listingStatus?: "active" | "out_of_stock" | "taken_down";
  accent: string;
  tags: string[];
}

export type VendorPlanId = "free" | "standard" | "premium";

export interface VendorSubscriptionPlan {
  id: VendorPlanId;
  name: string;
  monthlyFee: number;
  productLimit: number;
  featuredPlacement: boolean;
  commissionRate: number;
}

export interface VendorSubscription {
  vendor: string;
  planId: VendorPlanId;
  status: "active" | "past_due" | "cancelled";
  paidThrough?: string;
  updatedAt: string;
}

export interface CommissionSettings {
  defaultRate: number;
  perVendorRates: Record<string, number>;
  updatedAt: string;
}

export type PromotionType = "discount_code" | "flash_sale" | "featured_product" | "featured_vendor" | "seasonal_campaign";

export interface PromotionCampaign {
  id: string;
  title: LocalizedString;
  type: PromotionType;
  discountPercent?: number;
  code?: string;
  productId?: string;
  vendor?: string;
  category?: string;
  active: boolean;
  startsAt: string;
  endsAt?: string;
  createdAt: string;
}

export interface ProductMetric {
  productId: string;
  views: number;
  lastViewedAt: string;
}

export type ProductModerationStatus = "pending" | "approved" | "hidden" | "rejected";

export interface ProductModerationRecord {
  productId: string;
  status: ProductModerationStatus;
  reviewedAt: string;
  reviewNote?: string;
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
    vendor: string;
    lineTotal: number;
    commissionRate: number;
    commissionAmount: number;
    vendorPayout: number;
  }>;
  customerName: string;
  customerPhone: string;
  deliveryOption?: DeliveryOption;
  deliveryAddress?: string;
  deliveryArea: string;
  deliveryFee?: number;
  deliveryPerson?: string;
  paymentMethod: string;
  paymentReference: string;
  paymentStatus: PaymentStatus;
  subtotal: number;
  commissionTotal: number;
  vendorPayoutTotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type PaymentGateway = "manual" | "paystack" | "monnify" | "flutterwave" | "prototype";

export interface PaymentRecord {
  id: string;
  orderId: string;
  reference: string;
  method: string;
  amount: number;
  currency: "NGN";
  status: PaymentStatus;
  gateway: PaymentGateway;
  createdAt: string;
  verifiedAt?: string;
  failedAt?: string;
  refundedAt?: string;
  adminNote?: string;
}

export type WalletLedgerType = "vendor_pending_credit" | "platform_commission" | "vendor_withdrawal_debit";
export type WalletLedgerStatus = "pending" | "available";

export interface WalletLedgerEntry {
  id: string;
  orderId: string;
  productId: string;
  vendor: string;
  type: WalletLedgerType;
  status: WalletLedgerStatus;
  amount: number;
  createdAt: string;
  availableAt?: string;
}

export interface VendorWalletSummary {
  vendor: string;
  pendingBalance: number;
  availableBalance: number;
  totalCommission: number;
}

export type WithdrawalStatus = "pending" | "approved" | "rejected";

export interface WithdrawalRequest {
  id: string;
  vendor: string;
  amount: number;
  status: WithdrawalStatus;
  requestedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface Review {
  id: string;
  productId: string;
  vendor?: string;
  reviewerName: string;
  rating: number;
  comment: string;
  hidden?: boolean;
  adminNote?: string;
  createdAt: string;
}

export type NotificationAudience = "customer" | "vendor" | "admin";

export interface NotificationRecord {
  id: string;
  audience: NotificationAudience;
  recipient?: string;
  title: string;
  message: string;
  createdAt: string;
  readAt?: string;
  orderId?: string;
  type:
    | "order"
    | "payment"
    | "delivery"
    | "vendor"
    | "product"
    | "stock"
    | "review"
    | "search"
    | "complaint";
}

export type UserRole = "customer" | "vendor" | "admin";

export interface UserProfile {
  phone: string;
  email?: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  name: string;
  role: Exclude<UserRole, "admin">;
  deliveryAddress?: string;
  preferredLanguage?: Language;
  disabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id?: string;
  token?: string;
  phone: string;
  email?: string;
  firstName: string;
  lastName: string;
  name: string;
  role: UserRole;
  vendorStatus?: VendorApprovalStatus;
  deliveryAddress?: string;
  preferredLanguage?: Language;
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

export type VendorApprovalStatus = "pending" | "approved" | "rejected";

export interface VendorRequest {
  id: string;
  businessName: string;
  phone: string;
  area: string;
  category: string;
  logoDataUrl?: string;
  status?: VendorApprovalStatus;
  suspended?: boolean;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: LocalizedString;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppState {
  language: Language;
  cartCount: number;
  lastQuery: string;
  lastResults: Product[];
  visibleProductCount: number;
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
