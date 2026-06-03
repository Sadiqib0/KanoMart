export type DashboardRole = "customer" | "vendor" | "admin";

export type DashboardRoute = {
  path: string;
  page: string;
  label: string;
  description: string;
  role: DashboardRole;
};

export const dashboardRoutes: DashboardRoute[] = [
  { role: "customer", path: "customer/overview", page: "customer", label: "Overview", description: "Orders, saved products, cart, support" },
  { role: "customer", path: "customer/orders", page: "orders", label: "Orders", description: "Track purchases and receipts" },
  { role: "customer", path: "customer/wishlist", page: "customer", label: "Wishlist", description: "Saved products and reorder ideas" },
  { role: "customer", path: "customer/cart", page: "customer", label: "Cart", description: "Checkout-ready basket" },
  { role: "customer", path: "customer/profile", page: "customer", label: "Profile", description: "Delivery, language, account" },
  { role: "customer", path: "customer/notifications", page: "customer", label: "Notifications", description: "Order and support updates" },

  { role: "vendor", path: "vendor/overview", page: "vendor", label: "Overview", description: "Sales, orders, inventory, payouts" },
  { role: "vendor", path: "vendor/products", page: "vendor", label: "Products", description: "Catalog and moderation state" },
  { role: "vendor", path: "vendor/inventory", page: "vendor", label: "Inventory", description: "Stock health and alerts" },
  { role: "vendor", path: "vendor/orders", page: "vendor", label: "Orders", description: "Fulfillment queue" },
  { role: "vendor", path: "vendor/revenue", page: "vendor", label: "Revenue", description: "Sales and payout performance" },
  { role: "vendor", path: "vendor/payouts", page: "vendor", label: "Payouts", description: "Wallet and settlement requests" },
  { role: "vendor", path: "vendor/reviews", page: "vendor", label: "Reviews", description: "Customer feedback" },
  { role: "vendor", path: "vendor/analytics", page: "vendor", label: "Analytics", description: "Views and top products" },
  { role: "vendor", path: "vendor/store", page: "vendor", label: "Store", description: "Profile and approval state" },

  { role: "admin", path: "admin/overview", page: "admin", label: "Overview", description: "Platform control room" },
  { role: "admin", path: "admin/users", page: "admin", label: "Users", description: "Customers, vendors, admins" },
  { role: "admin", path: "admin/vendors", page: "admin", label: "Vendors", description: "Applications and seller health" },
  { role: "admin", path: "admin/products", page: "admin", label: "Products", description: "Catalog and moderation" },
  { role: "admin", path: "admin/orders", page: "admin", label: "Orders", description: "Fulfillment operations" },
  { role: "admin", path: "admin/payments", page: "admin", label: "Payments", description: "Payment exceptions and refunds" },
  { role: "admin", path: "admin/payouts", page: "admin", label: "Payouts", description: "Vendor settlements" },
  { role: "admin", path: "admin/categories", page: "admin", label: "Categories", description: "Catalog taxonomy" },
  { role: "admin", path: "admin/reports", page: "admin", label: "Reports", description: "Growth and revenue analysis" },
  { role: "admin", path: "admin/audit-logs", page: "admin", label: "Audit logs", description: "Admin activity trail" },
  { role: "admin", path: "admin/system-health", page: "admin", label: "System health", description: "API, DB, storage, email" },
];

export function getDashboardRoute(path: string): DashboardRoute | undefined {
  return dashboardRoutes.find((route) => route.path === path);
}

export function getDashboardRoutesForRole(role: DashboardRole): DashboardRoute[] {
  return dashboardRoutes.filter((route) => route.role === role);
}

export function getDefaultDashboardRoute(role: string): string {
  if (role === "admin") return "admin/overview";
  if (role === "vendor") return "vendor/overview";
  if (role === "customer") return "customer/overview";
  return "home";
}

export function getRoutePage(path: string): string {
  if (path === "my-orders") return "orders";
  if (path === "results" || path === "categories") return "catalog";
  return getDashboardRoute(path)?.page ?? (path.split("/")[0] || "home");
}
