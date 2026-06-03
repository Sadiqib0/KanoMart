import type { Product, UserSession } from "../../backend/types";
import { getCatalogProducts, getProductsForVendor } from "../../backend/products";
import { getUserProfiles, findVendorByPhone } from "../../backend/users";
import { getVendorRequests, getVendorStatusCounts } from "../../backend/vendors";
import { getProductStatusCounts, getAllProducts } from "../../backend/products";
import { getPayments, getPaymentSummary } from "../../backend/payments";
import { getVendorWalletSummaries, getPlatformCommissionTotal } from "../../backend/wallet";
import { getOrders, getLiveOrders } from "../orders";
import { getWishlist } from "../wishlist";
import { getCartItems, getCartSubtotal } from "../cart";
import { getAllReviews } from "../reviews";
import { getLiveAdminData, getLiveNotifications, getLiveVendorData, getLiveVendorApplication } from "../live-api";
import { formatPrice, parsePrice } from "../utils";

export function getCustomerDashboardData(user: UserSession) {
  const liveOrders = getLiveOrders();
  const orders = liveOrders?.length
    ? liveOrders
        .filter((order) => order.customerUserId === user.id || order.customerPhone === user.phone)
        .map((order) => ({
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus ?? "pending",
          total: order.subtotal ?? 0,
          createdAt: order.createdAt,
          items: order.items?.map((item) => item.name?.en ?? item.productId).filter(Boolean) ?? [],
        }))
    : getOrders()
        .filter((order) => order.customerPhone === user.phone)
        .map((order) => ({
          id: order.id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: order.subtotal,
          createdAt: order.createdAt,
          items: order.items.map((item) => item.name),
        }));

  const wishlistIds = getWishlist();
  const recommended = getCatalogProducts()
    .filter((product) => !wishlistIds.includes(product.id))
    .sort((a, b) => (b.quantityAvailable ?? 0) - (a.quantityAvailable ?? 0))
    .slice(0, 4);
  const notifications = getLiveNotifications().filter((item) => item.audience === "customer").slice(0, 5);

  return {
    orders,
    activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).slice(0, 3),
    recentPurchases: orders.slice(0, 4),
    wishlistCount: wishlistIds.length,
    cartCount: getCartItems().reduce((total, item) => total + item.quantity, 0),
    cartSubtotal: getCartSubtotal(),
    recommended,
    notifications,
  };
}

export function getVendorDashboardData(user: UserSession) {
  const live = getLiveVendorData();
  const app = getLiveVendorApplication();
  const vendor = findVendorByPhone(user.phone);
  const businessName = app?.businessName || vendor?.businessName || user.name;
  const liveOrders = live?.orders ?? [];
  const localOrders = getOrders().filter((order) => order.items.some((item) => item.vendor === businessName));
  const orders = liveOrders.length
    ? liveOrders.map((order) => ({
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus ?? "pending",
        total: order.subtotal ?? 0,
        createdAt: order.createdAt,
      }))
    : localOrders.map((order) => ({
        id: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.items
          .filter((item) => item.vendor === businessName)
          .reduce((sum, item) => sum + item.lineTotal, 0),
        createdAt: order.createdAt,
      }));

  const products = getProductsForVendor(user.phone);
  const wallet = live?.wallet ?? getVendorWalletSummaries().find((summary) => summary.vendor === businessName) ?? null;
  const reviews = live?.reviews ?? getAllReviews().filter((review) => review.vendor === businessName);
  const lowStock = products.filter((product) => (product.quantityAvailable ?? 0) <= 3);
  const paidSales = orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);

  return {
    businessName,
    approvalStatus: app?.status ?? user.vendorStatus ?? vendor?.status ?? "pending",
    approvalNote: app?.adminNote ?? vendor?.reviewNote,
    products,
    orders,
    pendingOrders: orders.filter((order) => ["awaiting_confirmation", "preparing_order"].includes(order.status)),
    lowStock,
    topProducts: [...products]
      .sort((a, b) => parsePrice(b.price) - parsePrice(a.price))
      .slice(0, 5),
    wallet,
    payouts: live?.payouts ?? [],
    reviews: reviews.slice(0, 5),
    paidSales,
  };
}

export function getAdminDashboardData() {
  const live = getLiveAdminData();
  const localUsers = getUserProfiles();
  const localVendors = getVendorRequests();
  const vendorCounts = getVendorStatusCounts(localVendors);
  const productCounts = getProductStatusCounts();
  const orders = live?.orders ?? getOrders();
  const payments = live?.payments ?? getPayments();
  const users = live?.users ?? localUsers;
  const vendors = live ? [] : localVendors;
  const analytics = live?.analytics ?? null;
  const paymentSummary = getPaymentSummary();
  const activeVendors = live
    ? live.users.filter((user) => user.role === "vendor" && user.vendorStatus === "approved").length
    : vendorCounts.approved;
  const pendingVendorApprovals = live
    ? live.users.filter((user) => user.role === "vendor" && user.vendorStatus === "pending").length
    : vendorCounts.pending;
  const totalRevenue = analytics?.totalSales ?? orders.reduce((sum, order) => sum + (order.subtotal ?? 0), 0);

  return {
    users,
    vendors,
    orders,
    payments,
    payouts: live?.payouts ?? [],
    reviews: live?.reviews ?? getAllReviews(),
    promotions: live?.promotions ?? [],
    analytics,
    counts: {
      totalUsers: users.length,
      activeVendors,
      pendingVendorApprovals,
      pendingProductApprovals: productCounts.pending,
      totalOrders: orders.length,
      failedPayments: payments.filter((payment) => payment.status === "failed").length,
      disputes: 0,
      systemAlerts: 0,
      products: getAllProducts().length,
    },
    revenue: {
      total: totalRevenue,
      paid: analytics?.totalSales ?? paymentSummary.paidAmount,
      pending: paymentSummary.pendingAmount,
      refunded: paymentSummary.refundedAmount,
      commission: getPlatformCommissionTotal(),
    },
  };
}

export function productToMiniMeta(product: Product): string {
  return `${product.vendor} - ${product.price} - ${(product.quantityAvailable ?? 0).toLocaleString()} in stock`;
}

export function moneyOrDash(amount: number | undefined): string {
  return amount ? formatPrice(amount) : "NGN 0";
}
