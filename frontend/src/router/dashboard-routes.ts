export type DashboardRole = "customer" | "vendor" | "admin";

export type DashboardRoute = {
  path: string;
  page: string;
  label: string;
  labelHa: string;
  description: string;
  descriptionHa: string;
  role: DashboardRole;
};

export const dashboardRoutes: DashboardRoute[] = [
  { role: "customer", path: "customer/overview", page: "customer", label: "Overview", labelHa: "Takaitawa", description: "Orders, saved products, cart, support", descriptionHa: "Ododi, kayan ajiya, kwando, tallafi" },
  { role: "customer", path: "customer/orders", page: "orders", label: "Orders", labelHa: "Ododi", description: "Track purchases and receipts", descriptionHa: "Bi sayayya da rasit" },
  { role: "customer", path: "customer/wishlist", page: "customer", label: "Wishlist", labelHa: "Jerin so", description: "Saved products and reorder ideas", descriptionHa: "Kayan ajiya da sake oda" },
  { role: "customer", path: "customer/cart", page: "customer", label: "Cart", labelHa: "Kwando", description: "Checkout-ready basket", descriptionHa: "Kwandon da ya shirya biya" },
  { role: "customer", path: "customer/profile", page: "customer", label: "Profile", labelHa: "Bayanan sirri", description: "Delivery, language, account", descriptionHa: "Isarwa, yare, asusu" },
  { role: "customer", path: "customer/notifications", page: "customer", label: "Notifications", labelHa: "Sanarwa", description: "Order and support updates", descriptionHa: "Sabuntawar oda da tallafi" },

  { role: "vendor", path: "vendor/overview", page: "vendor", label: "Overview", labelHa: "Takaitawa", description: "Sales, orders, inventory, payouts", descriptionHa: "Siyarwa, ododi, ajiya, biya" },
  { role: "vendor", path: "vendor/products", page: "vendor", label: "Products", labelHa: "Kaya", description: "Catalog and moderation state", descriptionHa: "Jeri da matsayin duba kaya" },
  { role: "vendor", path: "vendor/inventory", page: "vendor", label: "Inventory", labelHa: "Ajiya", description: "Stock health and alerts", descriptionHa: "Lafiyar kaya da gargadi" },
  { role: "vendor", path: "vendor/orders", page: "vendor", label: "Orders", labelHa: "Ododi", description: "Fulfillment queue", descriptionHa: "Layin cika oda" },
  { role: "vendor", path: "vendor/revenue", page: "vendor", label: "Revenue", labelHa: "Kudin shiga", description: "Sales and payout performance", descriptionHa: "Siyarwa da aikin biya" },
  { role: "vendor", path: "vendor/payouts", page: "vendor", label: "Payouts", labelHa: "Biyan kudi", description: "Wallet and settlement requests", descriptionHa: "Wallet da bukatun biya" },
  { role: "vendor", path: "vendor/reviews", page: "vendor", label: "Reviews", labelHa: "Ra'ayoyi", description: "Customer feedback", descriptionHa: "Ra'ayin kwastomomi" },

  { role: "admin", path: "admin/overview", page: "admin", label: "Overview", labelHa: "Takaitawa", description: "Platform control room", descriptionHa: "Dakin sarrafa dandali" },
  { role: "admin", path: "admin/users", page: "admin", label: "Users", labelHa: "Masu amfani", description: "Customers, vendors, admins", descriptionHa: "Kwastomomi, dillalai, admin" },
  { role: "admin", path: "admin/vendors", page: "admin", label: "Vendors", labelHa: "Dillalai", description: "Applications and seller health", descriptionHa: "Bukatu da lafiyar masu sayarwa" },
  { role: "admin", path: "admin/products", page: "admin", label: "Products", labelHa: "Kaya", description: "Catalog and moderation", descriptionHa: "Jeri da duba kaya" },
  { role: "admin", path: "admin/orders", page: "admin", label: "Orders", labelHa: "Ododi", description: "Fulfillment operations", descriptionHa: "Ayyukan cika oda" },
  { role: "admin", path: "admin/payments", page: "admin", label: "Payments", labelHa: "Biyan kudi", description: "Payment exceptions and refunds", descriptionHa: "Matsalolin biya da mayarwa" },
  { role: "admin", path: "admin/payouts", page: "admin", label: "Payouts", labelHa: "Biyan dillalai", description: "Vendor settlements", descriptionHa: "Tantance kudin dillalai" },
  { role: "admin", path: "admin/reviews", page: "admin", label: "Reviews", labelHa: "Ra'ayoyi", description: "Review moderation", descriptionHa: "Duba ra'ayoyi" },
  { role: "admin", path: "admin/promotions", page: "admin", label: "Promotions", labelHa: "Tallace-tallace", description: "Campaigns and discounts", descriptionHa: "Kamfen da rangwame" },
  { role: "admin", path: "admin/reports", page: "admin", label: "Reports", labelHa: "Rahotanni", description: "Growth and revenue analysis", descriptionHa: "Nazarin girma da kudin shiga" },
  { role: "admin", path: "admin/system-health", page: "admin", label: "System health", labelHa: "Lafiyar tsarin", description: "API, DB, storage, email", descriptionHa: "API, bayanai, ajiya, imel" },
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
  if (path.startsWith("p/")) return "product";       // product detail page
  if (path.startsWith("v/")) return "vendorpage";    // vendor storefront
  if (path === "sell") return "sell";
  return getDashboardRoute(path)?.page ?? (path.split("/")[0] || "home");
}
