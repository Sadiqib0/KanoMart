import type { Order, ProductMetric, SearchRecord, UserProfile, VendorRequest } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList } from "./storage";
import { getAllProducts } from "./products";
import { getPlatformRevenueTotal } from "./wallet";

export function recordProductView(productId: string): ProductMetric {
  const metrics = getStoredList<ProductMetric>(storageKeys.productMetrics);
  const existing = metrics.find((metric) => metric.productId === productId);
  if (existing) {
    existing.views += 1;
    existing.lastViewedAt = new Date().toISOString();
    setStoredList(storageKeys.productMetrics, metrics);
    return existing;
  }
  const metric: ProductMetric = {
    productId,
    views: 1,
    lastViewedAt: new Date().toISOString(),
  };
  setStoredList(storageKeys.productMetrics, [metric, ...metrics]);
  return metric;
}

export function getProductMetrics(): ProductMetric[] {
  return getStoredList<ProductMetric>(storageKeys.productMetrics);
}

export function getMarketplaceAnalytics(): {
  totalSales: number;
  platformRevenue: number;
  totalOrders: number;
  cancelledOrders: number;
  customerGrowth: number;
  vendorGrowth: number;
  mostViewedProducts: Array<{ label: string; value: number }>;
  mostSearchedItems: Array<{ label: string; value: number }>;
  bestSellingProducts: Array<{ label: string; value: number }>;
  bestPerformingVendors: Array<{ label: string; value: number }>;
} {
  const orders = getStoredList<Order>(storageKeys.orders);
  const searches = getStoredList<SearchRecord>(storageKeys.searches);
  const customers = getStoredList<UserProfile>(storageKeys.users).filter((user) => user.role === "customer");
  const vendors = getStoredList<VendorRequest>(storageKeys.vendors);
  const products = getAllProducts();

  const productName = (productId: string) => products.find((product) => product.id === productId)?.name.en ?? productId;
  const sortMap = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([label, value]) => ({ label, value }));

  const sold = new Map<string, number>();
  const vendorSales = new Map<string, number>();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      sold.set(productName(item.productId), (sold.get(productName(item.productId)) ?? 0) + item.quantity);
      vendorSales.set(item.vendor, (vendorSales.get(item.vendor) ?? 0) + item.lineTotal);
    });
  });

  const searchCounts = new Map<string, number>();
  searches.forEach((search) => searchCounts.set(search.query.toLowerCase(), (searchCounts.get(search.query.toLowerCase()) ?? 0) + 1));

  const viewed = new Map<string, number>();
  getProductMetrics().forEach((metric) => viewed.set(productName(metric.productId), metric.views));

  return {
    totalSales: orders.reduce((total, order) => total + order.subtotal, 0),
    platformRevenue: getPlatformRevenueTotal(),
    totalOrders: orders.length,
    cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
    customerGrowth: customers.length,
    vendorGrowth: vendors.length,
    mostViewedProducts: sortMap(viewed),
    mostSearchedItems: sortMap(searchCounts),
    bestSellingProducts: sortMap(sold),
    bestPerformingVendors: sortMap(vendorSales),
  };
}
