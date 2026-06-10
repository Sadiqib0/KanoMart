import type { Language } from "../backend/types";
import { storageKeys } from "../backend/data";
import { state, elements } from "./state";
import { escapeHtml, formatDate, formatPrice, getCopy, localizeStatus, sanitizePlainText, setActiveLanguageButtons } from "./utils";
import { getSearchResults, saveSearch } from "./search";
import { renderProductCard, updateResultCopy, renderAdminDashboard } from "./render";
import { exportSearchHistory, clearPrototypeData } from "./admin";
import { renderCustomerOverview } from "./pages/customer/overview";
import { renderVendorOverview } from "./pages/vendor/overview";
import { renderAdminOverview } from "./pages/admin/overview";
import {
  addToCart,
  openCart,
  closeCart,
  syncCart,
  renderCartPanel,
  updateQuantity,
  removeFromCart,
} from "./cart";
import { openCheckoutModal } from "./checkout";
import { openProductModal, refreshActiveProductModal } from "./product-modal";
import { openWishlistPanel, toggleWishlist, syncWishlistCount, syncAllWishlistButtons } from "./wishlist";
import { openAuthModal, openUserPanel, refreshUserPanelLanguage, saveSession, signOut, syncUserButton } from "./auth";
import { renderAdminGate } from "./admin-gate";
import { reviewVendorRequest, saveVendorRequest as persistVendorRequest } from "../backend/vendors";
import { showToast } from "./toast";
import {
  getCatalogProducts,
  getProductsForVendor,
  moderateProduct,
  saveVendorProduct,
  setSeedCatalogEnabled,
  setVendorProductListingStatus,
} from "../backend/products";
import { getCachedSearchResults, paginateProducts, PRODUCT_PAGE_SIZE, renderProductSkeletons } from "./frontend-data";
import { advanceOrderStatus, fetchLiveOrders, getOrders, renderOrdersPanel } from "./orders";
import { approveWithdrawal, rejectWithdrawal, requestWithdrawal } from "../backend/withdrawals";
import { getVendorWalletSummaries } from "../backend/wallet";
import { findVendorByPhone } from "../backend/users";
import { normalizePhone } from "../backend/phone";
import { confirmPayment, failPayment, refundPayment } from "../backend/payments";
import { createNotification, getNotificationsFor } from "../backend/notifications";
import { hideReview } from "./reviews";
import { recordProductView } from "../backend/analytics";
import { createPromotion } from "../backend/promotions";
import { saveCommissionSettings, setVendorSubscription } from "../backend/marketplace-settings";
import type { PromotionType, VendorPlanId } from "../backend/types";
import {
  refreshLiveAdminQueues,
  refreshLiveProducts,
  refreshLiveVendorProducts,
  fetchLiveAdminData,
  fetchLiveVendorData,
  fetchLiveNotifications,
  getLiveNotifications,
  markNotificationRead,
  fetchLiveCategories,
  fetchLiveVendorApplication,
  refreshSession,
} from "./live-api";
import { api } from "./api-client";
import { initLoginPage, initSignupPage, syncAuthPagesLanguage } from "./auth-pages";

const routes = new Set([
  // Public
  "home", "catalog", "payments", "login", "signup",
  // Customer sub-routes
  "customer", "customer/overview", "customer/orders", "customer/profile", "customer/cart", "customer/wishlist", "customer/notifications",
  // Vendor sub-routes (top-level #vendor is semi-public marketing; sub-routes require vendor auth)
  "vendor", "vendor/overview", "vendor/products", "vendor/inventory", "vendor/orders", "vendor/revenue", "vendor/payouts", "vendor/reviews",
  // Admin sub-routes
  "admin", "admin/overview", "admin/users", "admin/vendors", "admin/products", "admin/orders", "admin/payments", "admin/reviews", "admin/promotions", "admin/payouts", "admin/reports", "admin/system-health",
  // Legacy alias
  "orders",
]);
const AUTH_ROUTES = new Set(["login", "signup"]);
const SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";
const THEME_STORAGE_KEY = "kanoMart.theme";
type ThemeMode = "light" | "dark";

function getCurrentRoute(): string {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  if (routes.has(raw)) return raw;
  // Attempt partial sub-route match (e.g. "vendor/products/new" → "vendor/products")
  const parts = raw.split("/");
  if (parts.length >= 2) {
    const sub = `${parts[0]}/${parts[1]}`;
    if (routes.has(sub)) return sub;
  }
  return "home";
}

function getVisitorRole(): string {
  return state.currentUser?.role ?? "guest";
}

function getDefaultRouteForRole(role = getVisitorRole()): string {
  if (role === "admin") return "admin";
  if (role === "vendor") return "vendor";
  if (role === "customer") return "customer";
  return "home";
}

function canAccessRoute(route: string): boolean {
  const role = getVisitorRole();
  const base = route.split("/")[0];
  // Admin: all admin routes require admin role
  if (base === "admin") return role === "admin";
  // Customer: all customer routes + legacy orders require customer role
  if (base === "customer" || route === "orders") return role === "customer";
  // Vendor: sub-routes require vendor role; top-level #vendor is public marketing page
  if (route !== "vendor" && base === "vendor") return role === "vendor";
  // Auth pages: only for guests — redirect authenticated users to their dashboard
  if (AUTH_ROUTES.has(route)) return role === "guest";
  return true;
}

// ── Order auto-refresh (customer) ────────────────────────────────────────────
// Start a 15s polling loop when the customer is on the orders page.
// Cancelled when they navigate away.

let _orderPollTimer: ReturnType<typeof setInterval> | null = null;

function startOrderPolling(): void {
  if (_orderPollTimer !== null) return;
  const poll = () => {
    if (state.currentUser?.role !== "customer" || !state.currentUser.token) return;
    fetchLiveOrders().then(() => renderOrdersPage()).catch(() => undefined);
  };
  poll();
  _orderPollTimer = setInterval(poll, 15_000);
}

function stopOrderPolling(): void {
  if (_orderPollTimer !== null) {
    clearInterval(_orderPollTimer);
    _orderPollTimer = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function setRoute(route = getCurrentRoute()): void {
  let nextRoute = routes.has(route) ? route : "home";
  if (!canAccessRoute(nextRoute)) {
    nextRoute = getDefaultRouteForRole();
    if (window.location.hash.replace("#", "") !== nextRoute) {
      window.history.replaceState(null, "", `#${nextRoute}`);
    }
  }

  // For sub-routes (e.g. "vendor/products"), show the base section
  const baseRoute = nextRoute.split("/")[0];
  const pageSectionKey = baseRoute === "orders" ? "orders" : baseRoute;

  document.querySelectorAll<HTMLElement>("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === pageSectionKey;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll<HTMLElement>("[data-route]").forEach((link) => {
    // Highlight exact match OR parent base match for sub-routes
    const linkRoute = link.dataset.route ?? "";
    const isActive = linkRoute === nextRoute || (nextRoute.startsWith(linkRoute + "/") && linkRoute !== "home");
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
  // Toggle full-page auth layout (hides sidebar + header)
  document.body.classList.toggle("is-auth-route", AUTH_ROUTES.has(nextRoute));
  // Toggle transparent hero header vs solid sticky header
  document.body.classList.toggle("on-home", nextRoute === "home");
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();

  // Start/stop order polling based on active route
  if ((nextRoute === "orders" || nextRoute === "customer/orders") && state.currentUser?.role === "customer") {
    startOrderPolling();
  } else {
    stopOrderPolling();
  }

  // Inject new dashboard content for role-specific routes
  renderDashboardPage(nextRoute);

  // Refresh live data when navigating to role dashboards
  if (baseRoute === "vendor" && state.currentUser?.role === "vendor") {
    void refreshLiveVendorDashboard();
  }
  if (baseRoute === "admin" && state.currentUser?.role === "admin") {
    void refreshLiveAdminDashboard();
  }
}

function syncRoleNavigation(): void {
  const role = getVisitorRole();
  const user = state.currentUser;
  const roleLabel = document.querySelector<HTMLElement>("#sidebarRoleName");
  const workspaceTitle = document.querySelector<HTMLElement>("#sidebarWorkspaceTitle");
  const roleHint = document.querySelector<HTMLElement>("#sidebarRoleHint");
  const accountName = document.querySelector<HTMLElement>("#sidebarAccountName");
  const accountMeta = document.querySelector<HTMLElement>("#sidebarAccountMeta");
  const accountAvatar = document.querySelector<HTMLElement>("#sidebarAccountAvatar");
  const sidebarCartCount = document.querySelector<HTMLElement>("#sidebarCartCount");
  const sidebarWishlistCount = document.querySelector<HTMLElement>("#sidebarWishlistCount");
  const profile = {
    guest: {
      label: getCopy("Guest", "Bako"),
      title: getCopy("Marketplace", "Kasuwa"),
      hint: getCopy("Sign in to unlock your dashboard.", "Shiga don bude allon aikinka."),
      meta: getCopy("Sign in with mobile number", "Shiga da lambar waya"),
      avatar: "?",
    },
    customer: {
      label: getCopy("Customer", "Kwastoma"),
      title: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
      hint: getCopy("Orders, cart, wishlist, and checkout.", "Ododi, kwando, jerin so, da biyan kudi."),
      meta: user?.phone ?? getCopy("Customer account", "Asusun kwastoma"),
      avatar: user?.name?.slice(0, 1).toUpperCase() || "C",
    },
    vendor: {
      label: getCopy("Vendor", "Dillali"),
      title: getCopy("Seller workspace", "Wurin aiki na mai sayarwa"),
      hint: user?.vendorStatus === "approved" ? getCopy("Store approved and ready.", "An amince da shago kuma ya shirya.") : getCopy("Approval status is pending.", "Matsayin amincewa yana jira."),
      meta: user?.vendorStatus ? `${getCopy("Vendor", "Dillali")}: ${localizeStatus(user.vendorStatus)}` : getCopy("Vendor account", "Asusun dillali"),
      avatar: user?.name?.slice(0, 1).toUpperCase() || "V",
    },
    admin: {
      label: getCopy("Admin", "Admin"),
      title: getCopy("Operations control", "Sarrafa ayyuka"),
      hint: getCopy("Approvals, finance, orders, and risk.", "Amincewa, kudi, ododi, da hadari."),
      meta: getCopy("Verified admin number", "Lambar admin da aka tabbatar"),
      avatar: "A",
    },
  }[role] ?? {
    label: getCopy("Guest", "Bako"),
    title: getCopy("Marketplace", "Kasuwa"),
    hint: getCopy("Sign in to unlock your dashboard.", "Shiga don bude allon aikinka."),
    meta: getCopy("Sign in with mobile number", "Shiga da lambar waya"),
    avatar: "?",
  };

  if (roleLabel) {
    roleLabel.textContent = profile.label;
    roleLabel.dataset.role = role;
    roleLabel.dataset.short = profile.avatar;
  }
  if (workspaceTitle) workspaceTitle.textContent = profile.title;
  if (roleHint) roleHint.textContent = profile.hint;
  if (accountName) accountName.textContent = user?.name || "Guest";
  if (accountMeta) accountMeta.textContent = profile.meta;
  if (accountAvatar) accountAvatar.textContent = profile.avatar;
  if (sidebarCartCount) sidebarCartCount.textContent = String(state.cartCount);
  if (sidebarWishlistCount) sidebarWishlistCount.textContent = elements.wishlistCountEl.textContent || "0";

  document.querySelectorAll<HTMLElement>("[data-roles]").forEach((node) => {
    const allowed = (node.dataset.roles || "").split(/\s+/).filter(Boolean);
    node.hidden = !allowed.includes(role);
  });
  // Guests browse a clean public storefront — the dashboard sidebar only
  // exists for signed-in users (every role, on every page).
  document.body.classList.toggle("is-guest", role === "guest");
  if (role === "guest") closeSidebar();
  if (!canAccessRoute(getCurrentRoute())) {
    setRoute(getDefaultRouteForRole(role));
  }
}

function getPreferredTheme(): ThemeMode {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  const activeTheme = document.documentElement.dataset.theme;
  if (activeTheme === "dark" || activeTheme === "light") return activeTheme;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getCurrentTheme(): ThemeMode {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function syncThemeToggles(theme = getCurrentTheme()): void {
  const isDark = theme === "dark";
  const label = isDark
    ? getCopy("Switch to normal mode", "Canza zuwa yanayin haske")
    : getCopy("Switch to dark mode", "Canza zuwa yanayin duhu");

  document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  });
}

function setTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("color-scheme", theme);
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0c1f18" : "#176b4d"
  );
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  syncThemeToggles(theme);
}

function openSidebar(): void {
  elements.appSidebar.classList.add("is-open");
  elements.sidebarOverlay.hidden = false;
  document.body.classList.add("sidebar-open");
  elements.sidebarClose.focus();
}

function closeSidebar(): void {
  elements.appSidebar.classList.remove("is-open");
  elements.sidebarOverlay.hidden = true;
  document.body.classList.remove("sidebar-open");
}

function setSidebarCollapsed(collapsed: boolean): void {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  elements.sidebarCollapse.setAttribute("aria-pressed", String(collapsed));
  elements.sidebarCollapse.setAttribute(
    "aria-label",
    collapsed ? getCopy("Expand sidebar", "Bude gefen menu") : getCopy("Collapse sidebar", "Takaita gefen menu")
  );
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
}

function syncSidebarLabels(): void {
  document.querySelectorAll<HTMLElement>(".sidebar-nav a[data-en][data-ha]").forEach((link) => {
    const label = link.dataset[state.language] || "";
    const text = link.querySelector<HTMLElement>(".sidebar-title");
    if (text) text.textContent = label;
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
  });
  document.querySelectorAll<HTMLElement>(".sidebar-vendor-cta[data-en][data-ha]").forEach((link) => {
    const label = link.dataset[state.language] || "";
    const text = link.querySelector<HTMLElement>(".sidebar-text");
    if (text) text.textContent = label;
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
  });
}

// — Search —

function renderProductResults(products = state.lastResults): void {
  const { visibleProducts, hasMore } = paginateProducts(products, state.visibleProductCount);
  elements.resultsGrid.innerHTML = visibleProducts.map(renderProductCard).join("");
  elements.emptyState.hidden = products.length > 0;
  elements.loadMoreProducts.hidden = !hasMore;
  syncAllWishlistButtons();
}

function renderLoadingProducts(): void {
  elements.resultStatus.hidden = false;
  elements.resultStatus.textContent = getCopy("Loading products...", "Ana loda kaya...");
  elements.resultsGrid.innerHTML = renderProductSkeletons();
  elements.emptyState.hidden = true;
  elements.loadMoreProducts.hidden = true;
}

function renderCatalogPreview(resetPage = true): void {
  const catalog = getCatalogProducts();
  state.lastResults = catalog;
  if (resetPage) state.visibleProductCount = PRODUCT_PAGE_SIZE;
  elements.resultsTitle.textContent = getCopy("Featured products", "Fitattun kaya");
  elements.resultsIntro.textContent = getCopy(
    "Fresh picks from Kano vendors. Search or choose a quick category to narrow the shelf.",
    "Fitattun kaya daga dillalan Kano. Yi bincike ko zabi rukuni domin takaita kaya."
  );
  elements.resultStatus.hidden = false;
  elements.resultStatus.textContent = getCopy(`${catalog.length} live products`, `Kaya ${catalog.length} a fili`);
  renderProductResults(catalog);
}

async function refreshLiveCatalog(): Promise<void> {
  try {
    await refreshLiveProducts();
    if (state.lastQuery) {
      const results = getSearchResults(state.lastQuery);
      state.lastResults = results;
      updateResultCopy(state.lastQuery, results);
      renderProductResults(results);
    } else {
      renderCatalogPreview(false);
    }
    renderAdminDashboard();
  } catch {
    // The local catalog remains usable if the API is unavailable during testing.
  }
}

async function refreshLiveAdminDashboard(): Promise<void> {
  if (state.currentUser?.role !== "admin" || !state.currentUser.token) return;
  try {
    await Promise.all([
      refreshLiveAdminQueues(),
      fetchLiveAdminData(),
    ]);
    if (state.lastQuery) {
      state.lastResults = getSearchResults(state.lastQuery);
      updateResultCopy(state.lastQuery, state.lastResults);
      renderProductResults();
    } else {
      renderCatalogPreview(false);
    }
    renderAdminDashboard();
  } catch {
    // The local admin dashboard remains usable if live admin sync is unavailable.
  }
}

function renderCustomerDashboard(): void {
  const user = state.currentUser;
  if (!user || user.role !== "customer") return;

  // Welcome name
  const nameEl = document.querySelector<HTMLElement>("#customerWelcomeName");
  if (nameEl) {
    const firstName = user.firstName || user.name?.split?.(" ")?.[0] || "";
    nameEl.textContent = firstName
      ? getCopy(`Welcome back, ${firstName}!`, `Barka da dawo, ${firstName}!`)
      : getCopy("Welcome back!", "Barka da dawo!");
  }

  // Quick stats
  const orderCount = getOrders().filter((o) => o.customerPhone === user.phone).length;
  const cartCount = state.cartCount;
  const wishlistCount = Number(elements.wishlistCountEl.textContent) || 0;

  const statOrders = document.querySelector<HTMLElement>("#customerStatOrders");
  const statCart = document.querySelector<HTMLElement>("#customerStatCart");
  const statWishlist = document.querySelector<HTMLElement>("#customerStatWishlist");
  if (statOrders) statOrders.textContent = String(orderCount);
  if (statCart) statCart.textContent = String(cartCount);
  if (statWishlist) statWishlist.textContent = String(wishlistCount);

  // Recent orders preview (last 3)
  const recentEl = document.querySelector<HTMLElement>("#customerRecentOrders");
  if (!recentEl) return;
  const recentOrders = getOrders()
    .filter((o) => o.customerPhone === user.phone)
    .slice(0, 3);

  if (recentOrders.length === 0) {
    recentEl.innerHTML = `<p class="muted" data-en="No orders yet. Start shopping to see your orders here." data-ha="Babu oda tukuna. Fara sayayya don ganin ododinka a nan.">${getCopy("No orders yet. Start shopping to see your orders here.", "Babu oda tukuna. Fara sayayya don ganin ododinka a nan.")}</p>`;
    return;
  }

  recentEl.innerHTML = recentOrders.map((order) => `
    <div class="customer-order-row">
      <div class="customer-order-id">
        <strong>${escapeHtml(order.id)}</strong>
        <small>${escapeHtml(formatDate(order.createdAt))}</small>
      </div>
      <span class="order-status order-status-${escapeHtml(order.status)}">${escapeHtml(order.status.replace(/_/g, " "))}</span>
      <span class="customer-order-total">${escapeHtml(formatPrice(order.subtotal))}</span>
    </div>
  `).join("");
}

function renderOrdersPage(): void {
  const ordersList = document.querySelector<HTMLElement>("#myOrdersList");
  if (!ordersList) return;
  if (!state.currentUser) {
    ordersList.innerHTML = `
      <p class="muted" data-en="Sign in to see your orders." data-ha="Shiga don ganin odanka.">
        ${getCopy("Sign in to see your orders.", "Shiga don ganin odanka.")}
      </p>
    `;
    return;
  }
  ordersList.innerHTML = renderOrdersPanel();
}

function renderLanguageSensitiveViews(): void {
  const currentRoute = getCurrentRoute();
  syncUserButton();
  syncRoleNavigation();
  syncAuthPagesLanguage();
  renderDashboardPage(currentRoute);
  renderCustomerDashboard();
  renderOrdersPage();
  renderCartPanel();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderAdminDashboard();
  syncAllWishlistButtons();
  refreshUserPanelLanguage();
  refreshActiveProductModal();

  const userOrdersList = document.querySelector<HTMLElement>("#userOrdersList");
  if (userOrdersList) userOrdersList.innerHTML = renderOrdersPanel();
  if (document.querySelector("#wishlistModal")) openWishlistPanel();
}

async function refreshLiveVendorDashboard(): Promise<void> {
  if (state.currentUser?.role !== "vendor" || !state.currentUser.token) return;
  try {
    await Promise.all([
      refreshLiveVendorProducts(),
      fetchLiveVendorData(),
      fetchLiveVendorApplication(),
    ]);
    renderVendorProducts();
    renderVendorCommerce();
    // Re-render the new dashboard view with fresh data
    const currentRoute = getCurrentRoute();
    if (currentRoute.startsWith("vendor")) renderDashboardPage(currentRoute);
  } catch {
    // Local vendor dashboard remains usable if live sync is unavailable.
  }
}

// ── Dashboard page injection ────────────────────────────────────────────────
// Renders the appropriate HTML into role-specific dash containers.
// For the customer, vendor, and admin sections, each has a <div id="*DashView">
// that receives the rich dashboard HTML generated by the page renderers.

function wireDashboardEvents(container: HTMLElement, routeForRefresh: string): void {
  // ── Customer quick actions ──────────────────────────────────────────────────
  container.querySelector<HTMLButtonElement>("#customerCartBtn")?.addEventListener("click", () => { renderCartPanel(); openCart(); });
  container.querySelector<HTMLButtonElement>("#customerCartBtnSecondary")?.addEventListener("click", () => { renderCartPanel(); openCart(); });
  container.querySelector<HTMLButtonElement>("#customerWishlistBtn")?.addEventListener("click", openWishlistPanel);

  // Customer: proceed to checkout from cart sub-page
  container.querySelector<HTMLButtonElement>("#checkoutFromCartBtn")?.addEventListener("click", () => { openCheckoutModal(); });

  // Customer: cart quantity and remove actions (cart sub-page)
  container.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    const incBtn = target?.closest<HTMLButtonElement>(".cart-qty-inc");
    const decBtn = target?.closest<HTMLButtonElement>(".cart-qty-dec");
    const remBtn = target?.closest<HTMLButtonElement>(".cart-remove");
    if (incBtn?.dataset.productId) {
      updateQuantity(incBtn.dataset.productId, 1);
      renderDashboardPage(routeForRefresh);
    } else if (decBtn?.dataset.productId) {
      updateQuantity(decBtn.dataset.productId, -1);
      renderDashboardPage(routeForRefresh);
    } else if (remBtn?.dataset.productId) {
      removeFromCart(remBtn.dataset.productId);
      renderDashboardPage(routeForRefresh);
      showToast({ message: getCopy("Item removed from cart.", "An cire kaya daga kwandon saya."), type: "info" });
    }
  });

  // Customer: profile update form
  const profileForm = container.querySelector<HTMLFormElement>("#profileUpdateForm");
  if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(profileForm);
      const statusEl = profileForm.querySelector<HTMLElement>("#profileUpdateStatus");
      const submit = profileForm.querySelector<HTMLButtonElement>("button[type=submit]");
      if (submit) submit.disabled = true;
      if (statusEl) statusEl.textContent = getCopy("Saving…", "Ana ajiyewa…");

      const nameVal = String(fd.get("name") || "").trim();
      const emailVal = String(fd.get("email") || "").trim();
      const addrVal = String(fd.get("deliveryAddress") || "").trim();
      const langVal = (String(fd.get("preferredLanguage") || "en")) as "en" | "ha";

      const apiBody: { name?: string; email?: string; deliveryAddress?: string; preferredLanguage?: "en" | "ha" } = {
        ...(nameVal ? { name: nameVal } : {}),
        ...(emailVal ? { email: emailVal } : {}),
        ...(addrVal ? { deliveryAddress: addrVal } : {}),
        preferredLanguage: langVal,
      };

      if (state.currentUser?.token) {
        api.updateMe(apiBody)
          .then((res) => {
            if (state.currentUser) {
              state.currentUser = { ...state.currentUser, ...res.user };
              if (state.currentUser) saveSession(state.currentUser);
            }
            if (statusEl) { statusEl.textContent = getCopy("Profile saved!", "An ajiye bayanan sirri!"); statusEl.className = "dash-form-status dash-form-status--success"; }
          })
          .catch((err: Error) => {
            if (statusEl) { statusEl.textContent = err.message || getCopy("Could not save profile.", "Ba a iya ajiye bayanan sirri ba."); statusEl.className = "dash-form-status dash-form-status--error"; }
          })
          .finally(() => { if (submit) submit.disabled = false; });
      } else {
        // Persist locally if no API token
        if (state.currentUser) {
          state.currentUser = { ...state.currentUser, ...apiBody, name: nameVal || state.currentUser.name };
          saveSession(state.currentUser);
        }
        if (statusEl) { statusEl.textContent = getCopy("Profile saved locally.", "An ajiye bayanan sirri a na'ura."); statusEl.className = "dash-form-status dash-form-status--success"; }
        if (submit) submit.disabled = false;
      }
    });
  }

  // ── Vendor product form ─────────────────────────────────────────────────────
  const vendorProductForm = container.querySelector<HTMLFormElement>("#vendorProductForm");
  if (vendorProductForm) {
    vendorProductForm.addEventListener("submit", (event) => void handleVendorProductSubmit(event as SubmitEvent));
  }

  // Vendor: inline product status select (vendor/products sub-page)
  container.addEventListener("change", (event) => {
    const select = (event.target as Element | null)?.closest<HTMLSelectElement>(".vendor-status-select");
    const productId = select?.dataset.productId;
    const value = select?.value as "active" | "out_of_stock" | "taken_down" | undefined;
    if (!productId || !value) return;
    setVendorProductListingStatus(productId, value);
    showToast({ message: getCopy("Product status updated.", "An sabunta yanayin kaya."), type: "success" });
    if (state.currentUser?.token) api.updateVendorProduct(productId, value).catch(() => undefined);
  });

  // Vendor product list action delegation
  container.querySelector<HTMLElement>("#vendorProductsList")?.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-product-action]");
    const productId = button?.dataset.vendorProductId;
    const action = button?.dataset.vendorProductAction;
    if (!productId || (action !== "active" && action !== "out_of_stock" && action !== "taken_down")) return;
    setVendorProductListingStatus(productId, action);
    renderVendorProducts();
    renderDashboardPage(routeForRefresh);
    showToast({ message: action === "active" ? getCopy("Product restored to catalog.", "An mayar da kaya kasuwa.") : getCopy("Product removed from catalog.", "An cire kaya daga kasuwa."), type: action === "active" ? "success" : "info" });
    if (state.currentUser?.token) api.updateVendorProduct(productId, action).catch(() => undefined);
  });

  // Vendor commerce order delegation
  container.querySelector<HTMLElement>("#vendorCommerceList")?.addEventListener("click", (event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-order-ready]");
    const orderId = button?.dataset.vendorOrderReady;
    if (!orderId) return;
    advanceOrderStatus(orderId);
    renderDashboardPage(routeForRefresh);
    showToast({ message: getCopy("Order marked ready for pickup or delivery.", "An nuna oda a shirye domin dauka ko kaiwa."), type: "success" });
  });

  // Vendor: payout request form
  const payoutForm = container.querySelector<HTMLFormElement>("#payoutRequestForm");
  if (payoutForm) {
    payoutForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(payoutForm);
      const statusEl = payoutForm.querySelector<HTMLElement>("#payoutRequestStatus");
      const submit = payoutForm.querySelector<HTMLButtonElement>("button[type=submit]");
      const amount = Number(fd.get("amount") || 0);
      const bankName = String(fd.get("bankName") || "").trim();
      const accountNumber = String(fd.get("accountNumber") || "").trim();
      const accountName = String(fd.get("accountName") || "").trim();

      if (amount < 1 || !bankName || accountNumber.length < 10 || !accountName) {
        if (statusEl) { statusEl.textContent = getCopy("Fill in all payout fields correctly.", "Cika dukkan filayen biya yadda ya kamata."); statusEl.className = "dash-form-status dash-form-status--error"; }
        return;
      }
      if (submit) submit.disabled = true;
      if (statusEl) statusEl.textContent = getCopy("Submitting…", "Ana aika…");

      if (state.currentUser?.token) {
        api.requestPayout({ amount, bankName, accountNumber, accountName })
          .then(() => {
            if (statusEl) { statusEl.textContent = getCopy("Payout request submitted!", "An aika buƙatar biya!"); statusEl.className = "dash-form-status dash-form-status--success"; }
            payoutForm.reset();
            showToast({ message: getCopy("Payout request submitted.", "An aika buƙatar biya."), type: "success" });
          })
          .catch((err: Error) => {
            if (statusEl) { statusEl.textContent = err.message || getCopy("Could not submit payout.", "Ba a iya aika buƙatar biya ba."); statusEl.className = "dash-form-status dash-form-status--error"; }
          })
          .finally(() => { if (submit) submit.disabled = false; });
      } else {
        requestWithdrawal(state.currentUser?.name ?? "", amount);
        if (statusEl) { statusEl.textContent = getCopy("Request saved locally.", "An ajiye buƙata a na'ura."); statusEl.className = "dash-form-status dash-form-status--success"; }
        payoutForm.reset();
        if (submit) submit.disabled = false;
        renderDashboardPage(routeForRefresh);
      }
    });
  }

  // ── Admin actions ───────────────────────────────────────────────────────────
  container.addEventListener("click", (event) => {
    const target = event.target as Element | null;

    // Admin: approve vendor
    const approveVendorBtn = target?.closest<HTMLButtonElement>(".admin-approve-vendor");
    if (approveVendorBtn?.dataset.vendorId) {
      const id = approveVendorBtn.dataset.vendorId;
      approveVendorBtn.disabled = true;
      (state.currentUser?.token
        ? api.updateVendorApplication(id, { status: "approved" })
        : Promise.resolve(reviewVendorRequest(id, "approved", "Admin approved"))
      ).then(() => {
        showToast({ message: getCopy("Vendor approved.", "An amince da dillali."), type: "success" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => { showToast({ message: getCopy("Could not approve vendor.", "Ba a iya amincewa ba."), type: "error" }); approveVendorBtn.disabled = false; });
      return;
    }

    // Admin: reject vendor
    const rejectVendorBtn = target?.closest<HTMLButtonElement>(".admin-reject-vendor");
    if (rejectVendorBtn?.dataset.vendorId) {
      const id = rejectVendorBtn.dataset.vendorId;
      rejectVendorBtn.disabled = true;
      (state.currentUser?.token
        ? api.updateVendorApplication(id, { status: "rejected" })
        : Promise.resolve(reviewVendorRequest(id, "rejected", "Admin rejected"))
      ).then(() => {
        showToast({ message: getCopy("Vendor rejected.", "An ƙi dillali."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => { showToast({ message: getCopy("Could not reject vendor.", "Ba a iya ƙi ba."), type: "error" }); rejectVendorBtn.disabled = false; });
      return;
    }

    // Admin: approve payout
    const approvePayoutBtn = target?.closest<HTMLButtonElement>(".admin-approve-payout");
    if (approvePayoutBtn?.dataset.payoutId) {
      const id = approvePayoutBtn.dataset.payoutId;
      approvePayoutBtn.disabled = true;
      (state.currentUser?.token
        ? api.updateAdminPayout(id, { status: "approved" })
        : Promise.resolve(approveWithdrawal(id))
      ).then(() => {
        showToast({ message: getCopy("Payout approved.", "An amince da biya."), type: "success" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => { showToast({ message: getCopy("Could not approve payout.", "Ba a iya amincewa da biya ba."), type: "error" }); approvePayoutBtn.disabled = false; });
      return;
    }

    // Admin: reject payout
    const rejectPayoutBtn = target?.closest<HTMLButtonElement>(".admin-reject-payout");
    if (rejectPayoutBtn?.dataset.payoutId) {
      const id = rejectPayoutBtn.dataset.payoutId;
      rejectPayoutBtn.disabled = true;
      (state.currentUser?.token
        ? api.updateAdminPayout(id, { status: "rejected" })
        : Promise.resolve(rejectWithdrawal(id))
      ).then(() => {
        showToast({ message: getCopy("Payout rejected.", "An ƙi biya."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => { showToast({ message: getCopy("Could not reject payout.", "Ba a iya ƙi biya ba."), type: "error" }); rejectPayoutBtn.disabled = false; });
      return;
    }

    // Admin: toggle review visibility
    const toggleReviewBtn = target?.closest<HTMLButtonElement>(".admin-toggle-review");
    if (toggleReviewBtn?.dataset.reviewId) {
      const id = toggleReviewBtn.dataset.reviewId;
      const hidden = toggleReviewBtn.dataset.hidden === "true";
      toggleReviewBtn.disabled = true;
      (state.currentUser?.token
        ? api.updateAdminReview(id, { hidden: !hidden })
        : Promise.resolve(hideReview(id))
      ).then(() => {
        showToast({ message: getCopy(hidden ? "Review restored." : "Review hidden.", hidden ? "An maido da ra'ayi." : "An ɓoye ra'ayi."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => { showToast({ message: getCopy("Could not update review.", "Ba a iya sabunta ra'ayi ba."), type: "error" }); toggleReviewBtn.disabled = false; });
      return;
    }
  });
}

function renderDashboardPage(route: string): void {
  const startedAt = performance.now();
  const user = state.currentUser;
  const base = route.split("/")[0];
  let rendered = false;

  if (base === "customer" && user?.role === "customer") {
    const container = document.getElementById("customerDashView");
    if (!container) return;
    const dashPath = route === "customer" ? "customer/overview" : route;
    container.innerHTML = renderCustomerOverview(user, dashPath);
    wireDashboardEvents(container, route);
    rendered = true;
  }

  if (base === "vendor" && user?.role === "vendor") {
    const container = document.getElementById("vendorDashView");
    if (!container) return;
    const dashPath = route === "vendor" ? "vendor/overview" : route;
    container.innerHTML = renderVendorOverview(user, dashPath);
    wireDashboardEvents(container, route);
    rendered = true;
  }

  if (base === "admin" && user?.role === "admin") {
    const container = document.getElementById("adminDashView");
    if (!container) return;
    const dashPath = route === "admin" ? "admin/overview" : route;
    container.innerHTML = renderAdminOverview(dashPath);
    wireDashboardEvents(container, route);
    rendered = true;
  }

  if (rendered) {
    window.dispatchEvent(new CustomEvent("kanoMart:dashboard-rendered", {
      detail: { route, role: base, durationMs: Math.round(performance.now() - startedAt) },
    }));
  }
}

let _searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

function performSearch(rawQuery: string, debounceMs = 0): void {
  const query = rawQuery.trim();
  if (!query) return;

  if (_searchDebounceTimer !== null) clearTimeout(_searchDebounceTimer);

  _searchDebounceTimer = setTimeout(() => {
    _searchDebounceTimer = null;
    state.lastQuery = query;
    state.visibleProductCount = PRODUCT_PAGE_SIZE;
    renderLoadingProducts();
    document.querySelector<HTMLElement>("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });

    // Hit the live API for fresh results; fall back to the local cache on failure.
    refreshLiveProducts({ q: query })
      .then((results) => {
        saveSearch(query, results);
        state.lastResults = results;
        updateResultCopy(query, results);
        renderProductResults(results);
      })
      .catch(() => {
        const results = getCachedSearchResults(query);
        saveSearch(query, results);
        state.lastResults = results;
        updateResultCopy(query, results);
        renderProductResults(results);
      });
  }, debounceMs);
}

// — Language —

function setLanguage(language: Language): void {
  state.language = language;
  localStorage.setItem(storageKeys.language, language);
  document.documentElement.lang = language;
  document.title = getCopy(
    "Kano Mart | Local Marketplace for Kano",
    "Kano Mart | Kasuwar Kano ta yanar gizo"
  );

  document.querySelectorAll<HTMLElement>("[data-en][data-ha]").forEach((node) => {
    if (node.matches(".sidebar-nav a, .sidebar-vendor-cta")) return;
    node.textContent = node.dataset[language] || "";
  });

  document.querySelectorAll<HTMLImageElement>("[data-alt-en][data-alt-ha]").forEach((node) => {
    node.alt = node.dataset[`alt${language === "en" ? "En" : "Ha"}`] || "";
  });

  document.querySelectorAll<HTMLElement>("[data-aria-en][data-aria-ha]").forEach((node) => {
    node.setAttribute("aria-label", node.dataset[`aria${language === "en" ? "En" : "Ha"}`] || "");
  });

  document.querySelectorAll<HTMLInputElement>("[data-placeholder-en][data-placeholder-ha]").forEach((node) => {
    node.placeholder = node.dataset[`placeholder${language === "en" ? "En" : "Ha"}`] || "";
  });

  setActiveLanguageButtons(language);
  syncSidebarLabels();
  syncThemeToggles();

  if (state.lastQuery) {
    state.lastResults = getSearchResults(state.lastQuery);
    updateResultCopy(state.lastQuery, state.lastResults);
    renderProductResults();
  } else {
    renderCatalogPreview();
  }

  renderLanguageSensitiveViews();
}

// — Vendor form —

function handleVendorRequestSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const formData = new FormData(elements.vendorForm);
  const businessName = sanitizePlainText(String(formData.get("businessName") || ""), 80);
  const phone = sanitizePlainText(String(formData.get("phone") || ""), 24);
  const area = sanitizePlainText(String(formData.get("area") || ""), 80);
  const category = sanitizePlainText(String(formData.get("category") || ""), 40);

  if (!businessName) { elements.vendorMessage.textContent = getCopy("Business name is required.", "Ana buƙatar sunan kasuwanci."); return; }
  if (!phone || phone.replace(/\D/g, "").length < 10) { elements.vendorMessage.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci."); return; }
  if (!area) { elements.vendorMessage.textContent = getCopy("Market area is required.", "Ana buƙatar yankin kasuwa."); return; }
  if (!category) { elements.vendorMessage.textContent = getCopy("Please select a category.", "Da fatan za a zaɓi rukuni."); return; }

  // Hand off to the auth modal which calls the live API.
  // The vendor will complete their account (name + password) there,
  // and the registration will land in the admin approval queue.
  elements.vendorMessage.textContent = getCopy(
    "Complete your sign-up to submit the request.",
    "Kammala rajistarka domin tura buƙatar."
  );
  openAuthModal({ phone, role: "vendor", businessName, area, category });
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Invalid image"));
      return;
    }
    if (file.size > 1_500_000) {
      reject(new Error("Image too large"));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Could not read image")));
    reader.readAsDataURL(file);
  });
}

function renderVendorDashHeader(): void {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const vendor = findVendorByPhone(user.phone);
  const businessName = vendor?.businessName || user.name;
  const status = user.vendorStatus ?? "pending";

  const nameEl = document.querySelector<HTMLElement>("#vendorDashBusinessName");
  if (nameEl) nameEl.textContent = businessName;

  const badge = document.querySelector<HTMLElement>("#vendorStatusBadge");
  if (badge) {
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.dataset.status = status;
  }
}

function renderVendorProducts(): void {
  const list = document.querySelector<HTMLElement>("#vendorProductsList");
  if (!list) return;
  const user = state.currentUser;
  if (!user || user.role !== "vendor") {
    list.innerHTML = "";
    return;
  }
  renderVendorDashHeader();

  const vendorProducts = getProductsForVendor(user.phone);
  if (vendorProducts.length === 0) {
    list.innerHTML = `<p class="muted">${getCopy("No vendor products yet.", "Babu kayan dillali tukuna.")}</p>`;
    return;
  }

  list.innerHTML = vendorProducts
    .map((product) => {
      const modStatus = product.moderationStatus;
      const listStatus = product.listingStatus ?? "active";

      const moderationBadge =
        modStatus === "pending"
          ? `<span class="status-pill status-pending-review">${getCopy("Awaiting review", "Ana duba")}</span>`
          : modStatus === "rejected"
            ? `<span class="status-pill status-rejected">${getCopy("Rejected", "An ki")}</span>`
            : modStatus === "hidden"
              ? `<span class="status-pill status-hidden">${getCopy("Hidden by admin", "Admin ya ɓoye")}</span>`
              : null;

      const listingBadge = moderationBadge
        ? ""
        : (() => {
            const label =
              listStatus === "active"
                ? getCopy("Active", "Yana aiki")
                : listStatus === "out_of_stock"
                  ? getCopy("Out of stock", "Ya kare")
                  : getCopy("Taken down", "An cire");
            return `<span class="status-pill status-${escapeHtml(listStatus)}">${escapeHtml(label)}</span>`;
          })();

      const actions = moderationBadge
        ? `<span class="muted small">${getCopy("Pending admin approval", "Admin yana duba tukuna")}</span>`
        : listStatus === "active"
          ? `
            <button type="button" data-vendor-product-action="out_of_stock" data-vendor-product-id="${escapeHtml(product.id)}">
              ${getCopy("Out of stock", "Ya kare")}
            </button>
            <button type="button" data-vendor-product-action="taken_down" data-vendor-product-id="${escapeHtml(product.id)}">
              ${getCopy("Take down", "Cire")}
            </button>
          `
          : `
            <button type="button" data-vendor-product-action="active" data-vendor-product-id="${escapeHtml(product.id)}">
              ${getCopy("Restore", "Mayar")}
            </button>
          `;

      return `
        <article class="vendor-product-row">
          <div class="vendor-product-thumb" style="--accent: ${product.accent}">
            ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="">` : ""}
          </div>
          <div>
            <strong>${escapeHtml(product.name[state.language])}</strong>
            <span>${escapeHtml(product.price)} - ${escapeHtml(product.category[state.language])}</span>
          </div>
          ${moderationBadge ?? listingBadge}
          <div class="vendor-product-actions">${actions}</div>
        </article>
      `;
    })
    .join("");
}

function renderVendorCommerce(): void {
  const list = document.querySelector<HTMLElement>("#vendorCommerceList");
  if (!list) return;
  const user = state.currentUser;
  if (!user || user.role !== "vendor") {
    list.innerHTML = "";
    return;
  }

  const vendor = findVendorByPhone(user.phone);
  const vendorName = vendor?.businessName || user.name;
  const orders = getOrders().filter((order) => order.items.some((item) => item.vendor === vendorName));
  const paidOrders = orders.filter((order) => order.paymentStatus === "paid");
  const pendingOrders = orders.filter((order) => order.paymentStatus === "pending");
  const wallet = getVendorWalletSummaries().find((summary) => summary.vendor === vendorName);
  const notifications = getNotificationsFor("vendor", vendorName).slice(0, 4);

  const orderRows = orders.slice(0, 6).map((order) => {
    const canMarkReady = order.status === "awaiting_confirmation" || order.status === "preparing_order";
    return `
      <div class="vendor-commerce-row">
        <div>
          <strong>${escapeHtml(order.id)}</strong>
          <span>${escapeHtml(`${formatPrice(order.subtotal)} - ${order.paymentStatus} - ${order.status}`)}</span>
        </div>
        ${
          canMarkReady
            ? `<button type="button" data-vendor-order-ready="${escapeHtml(order.id)}">${getCopy("Mark ready", "Yi alamar a shirye")}</button>`
            : `<span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>`
        }
      </div>
    `;
  });

  list.innerHTML = `
    <div class="vendor-commerce-summary">
      <article><span>${getCopy("Paid orders", "Ododin da aka biya")}</span><strong>${paidOrders.length}</strong></article>
      <article><span>${getCopy("Pending payment", "Jiran biya")}</span><strong>${pendingOrders.length}</strong></article>
      <article><span>${getCopy("Available payout", "Kudin cirewa")}</span><strong>${formatPrice(wallet?.availableBalance || 0)}</strong></article>
      <article><span>${getCopy("Pending payout", "Kudin jira")}</span><strong>${formatPrice(wallet?.pendingBalance || 0)}</strong></article>
    </div>
    <div class="vendor-commerce-columns">
      <div>
        <h4>${getCopy("Order queue", "Jerin oda")}</h4>
        ${orderRows.join("") || `<p class="muted">${getCopy("No vendor orders yet.", "Babu odar dillali tukuna.")}</p>`}
      </div>
      <div>
        <h4>${getCopy("Recent notifications", "Sabbin sanarwa")}</h4>
        ${
          notifications.length
            ? notifications
                .map(
                  (notification) => `
                    <div class="notification-row">
                      <strong>${escapeHtml(notification.title)}</strong>
                      <span>${escapeHtml(notification.message)}</span>
                      <small>${escapeHtml(formatDate(notification.createdAt))}</small>
                    </div>
                  `
                )
                .join("")
            : `<p class="muted">${getCopy("No vendor notifications yet.", "Babu sanarwar dillali tukuna.")}</p>`
        }
      </div>
    </div>
  `;
}

async function handleVendorProductSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const message = document.querySelector<HTMLElement>("#vendorProductMessage");
  const user = state.currentUser;
  if (!user || user.role !== "vendor") {
    if (message) message.textContent = getCopy("Sign in as a vendor first.", "Shiga a matsayin dan kasuwa tukuna.");
    return;
  }

  const data = new FormData(form);
  const image = data.get("productImage");
  const productName = String(data.get("productName") || "").trim();
  const productNameHa = String(data.get("productNameHa") || "").trim();
  const descriptionEn = String(data.get("descriptionEn") || "").trim();
  const descriptionHa = String(data.get("descriptionHa") || "").trim();
  const category = String(data.get("productCategory") || "").trim();
  const quantityAvailable = Number(data.get("quantityAvailable") || 0);

  // Strip commas, spaces and currency symbols before parsing — iOS formats
  // number inputs as "20,000" which makes type="number" return "" from FormData.
  const rawPriceStr = String(data.get("productValue") ?? "").replace(/[^\d.]/g, "");
  const priceValue = rawPriceStr ? Number(rawPriceStr) : 0;

  if (!productName) {
    if (message) message.textContent = getCopy("Product name is required.", "Ana buƙatar sunan kaya.");
    form.querySelector<HTMLInputElement>("input[name='productName']")?.focus();
    return;
  }
  if (productName.length < 2) {
    if (message) message.textContent = getCopy("Product name must be at least 2 characters.", "Sunan kaya ya zama akalla haruffa 2.");
    form.querySelector<HTMLInputElement>("input[name='productName']")?.focus();
    return;
  }
  if (!category) {
    if (message) message.textContent = getCopy("Please choose a product category.", "Da fatan za a zaɓi rukuni na kaya.");
    form.querySelector<HTMLSelectElement>("select[name='productCategory']")?.focus();
    return;
  }
  if (!Number.isFinite(quantityAvailable) || quantityAvailable < 0) {
    if (message) message.textContent = getCopy("Enter a valid quantity.", "Shigar da adadi mai inganci.");
    form.querySelector<HTMLInputElement>("input[name='quantityAvailable']")?.focus();
    return;
  }

  // Validate image and price with specific messages so the vendor knows which field failed
  if (!(image instanceof File) || !image.name || image.size === 0) {
    if (message) message.textContent = getCopy(
      "Please choose a product image (JPEG, PNG, or WebP).",
      "Da fatan za a zaɓi hoton kaya (JPEG, PNG, ko WebP)."
    );
    return;
  }
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    if (message) message.textContent = getCopy(
      "Enter a valid price (numbers only, e.g. 15000).",
      "Shigar da farashi mai inganci (lambobi kawai, misali 15000)."
    );
    return;
  }

  try {
    const imageDataUrl = await readImageAsDataUrl(image);
    const vendor = findVendorByPhone(user.phone);
    const productInput = {
      vendor: vendor?.businessName || user.name,
      vendorPhone: user.phone,
      area: vendor?.area || "Kano",
      name: productName,
      nameHa: productNameHa,
      descriptionEn,
      descriptionHa,
      priceValue,
      quantityAvailable,
      category,
      imageDataUrl,
    };
    saveVendorProduct(productInput);

    let liveMessage = "";
    if (user.token) {
      try {
        const upload = await api.uploadVendorImage({
          fileName: image.name,
          mimeType: image.type,
          dataUrl: imageDataUrl,
        });
        await api.createVendorProduct({
          name: { en: productInput.name, ha: productInput.nameHa || productInput.name },
          description: { en: productInput.descriptionEn, ha: productInput.descriptionHa || productInput.descriptionEn },
          category: productInput.category,
          price: productInput.priceValue,
          quantityAvailable: productInput.quantityAvailable,
          area: productInput.area,
          imageUrl: upload.upload.url,
          tags: [productInput.name, productInput.category, productInput.area],
        });
        await Promise.all([refreshLiveCatalog(), refreshLiveVendorDashboard()]);
        liveMessage = getCopy(" Submitted for admin review — visible in catalog once approved.", " An tura wa admin — zai bayyana a kasuwa bayan amincewar admin.");
      } catch (error) {
        liveMessage = getCopy(
          " Saved locally. Live submission needs approved vendor access.",
          " An ajiye a gida. Tura live na bukatar amincewar dillali."
        );
      }
    }

    form.reset();
    if (message) message.textContent = getCopy("Product added to your active catalog.", "An saka kaya a kasuwarka.") + liveMessage;
    renderVendorProducts();
    renderVendorCommerce();
    renderCatalogPreview();
    renderAdminDashboard();
  } catch (error) {
    if (message) {
      message.textContent =
        error instanceof Error && error.message === "Image too large"
          ? getCopy("Image is too large. Use an image under 1.5MB.", "Hoton ya yi girma. Yi amfani da kasa da 1.5MB.")
          : getCopy("Could not add product. Check the image and try again.", "Ba a iya saka kaya ba. Duba hoton ka sake gwadawa.");
    }
  }
}

function applyLocalVendorDecision(id: string, action: "approved" | "rejected"): boolean {
  const vendor = reviewVendorRequest(
    id,
    action,
    action === "approved"
      ? "Approved from prototype admin dashboard"
      : "Rejected from prototype admin dashboard"
  );
  if (!vendor) return false;
  createNotification({
    audience: "vendor",
    recipient: vendor.businessName,
    title: action === "approved" ? "Vendor approved" : "Vendor rejected",
    message: `${vendor.businessName} was ${action}.`,
    type: "vendor",
  });

  renderAdminDashboard();
  showToast({
    message:
      action === "approved"
        ? getCopy(`${vendor.businessName} approved.`, `An amince da ${vendor.businessName}.`)
        : getCopy(`${vendor.businessName} rejected.`, `An ki ${vendor.businessName}.`),
    type: action === "approved" ? "success" : "info",
  });
  return true;
}

function applyLocalProductDecision(productId: string, productAction: "approved" | "hidden" | "rejected"): boolean {
  const record = moderateProduct(productId, productAction, "Updated from prototype admin dashboard");
  if (!record) return false;
  createNotification({
    audience: "vendor",
    title: productAction === "approved" ? "Product approved" : "Product review updated",
    message: `Product ${productId} is now ${productAction}.`,
    type: "product",
  });

  if (state.lastQuery) {
    state.lastResults = getSearchResults(state.lastQuery);
    updateResultCopy(state.lastQuery, state.lastResults);
    renderProductResults();
  } else {
    renderCatalogPreview();
  }

  renderAdminDashboard();
  renderVendorCommerce();
  showToast({
    message: getCopy("Product moderation updated.", "An sabunta duba kayan."),
    type: productAction === "approved" ? "success" : "info",
  });
  return true;
}

// — Event wiring —

elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(elements.searchInput.value, 0);
});

elements.searchInput.addEventListener("input", () => {
  if (elements.searchInput.value.trim().length >= 2) {
    performSearch(elements.searchInput.value, 300);
  }
});

// Hero quick-search chips AND home category cards both trigger catalog search
document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>("[data-query-en][data-query-ha]");
  if (!button) return;
  const query = button.dataset[state.language === "ha" ? "queryHa" : "queryEn"] || "";
  elements.searchInput.value = query;
  window.location.hash = "catalog";
  setRoute("catalog");
  performSearch(query);
});

document.addEventListener("click", (event) => {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("[data-route]");
  if (!link?.dataset.route) return;
  event.preventDefault();
  window.location.hash = link.dataset.route;
  setRoute(link.dataset.route);
});

window.addEventListener("hashchange", () => setRoute());

elements.loadMoreProducts.addEventListener("click", () => {
  state.visibleProductCount += PRODUCT_PAGE_SIZE;
  renderProductResults();
});

elements.sidebarOpen.addEventListener("click", openSidebar);
elements.sidebarClose.addEventListener("click", closeSidebar);
elements.sidebarOverlay.addEventListener("click", closeSidebar);
elements.sidebarCollapse.addEventListener("click", () => {
  setSidebarCollapsed(!document.body.classList.contains("sidebar-collapsed"));
});
document.querySelector<HTMLButtonElement>("#sidebarAccountAction")?.addEventListener("click", openUserPanel);

// Product grid: delegated events for wish, add-to-cart, and card click → modal
elements.resultsGrid.addEventListener("click", (event) => {
  const target = event.target as Element | null;

  const wishBtn = target?.closest<HTMLButtonElement>("[data-wishlist]");
  if (wishBtn) {
    if (!state.currentUser) { openAuthModal(); return; }
    const id = wishBtn.dataset.wishlist!;
    const product = state.lastResults.find((p) => p.id === id);
    toggleWishlist(id, product?.name[state.language] ?? id);
    syncWishlistCount();
    syncRoleNavigation();
    return;
  }

  const addBtn = target?.closest<HTMLButtonElement>("[data-add-to-cart]");
  if (addBtn) {
    if (!state.currentUser) { openAuthModal(); return; }
    addToCart(addBtn.dataset.addToCart!);
    elements.cartCountEl.textContent = String(state.cartCount);
    syncRoleNavigation();
    addBtn.textContent = getCopy("Added", "An saka");
    window.setTimeout(() => { addBtn.textContent = getCopy("Add", "Saka"); }, 1200);
    return;
  }

  const card = target?.closest<HTMLElement>(".product-card");
  if (card?.dataset.productId) {
    recordProductView(card.dataset.productId);
    renderAdminDashboard();
    openProductModal(card.dataset.productId);
  }
});

// Cart panel delegation: qty controls and remove
elements.cartItemsEl.addEventListener("click", (event) => {
  const target = event.target as Element | null;
  const dec = target?.closest<HTMLButtonElement>("[data-qty-dec]");
  const inc = target?.closest<HTMLButtonElement>("[data-qty-inc]");
  const rem = target?.closest<HTMLButtonElement>("[data-remove]");
  if (dec) updateQuantity(dec.dataset.qtyDec!, -1);
  if (inc) updateQuantity(inc.dataset.qtyInc!, 1);
  if (rem) removeFromCart(rem.dataset.remove!);
});

// Cart open/close
document.querySelectorAll<HTMLElement>(".cart-button").forEach((button) => {
  button.addEventListener("click", () => {
    renderCartPanel();
    openCart();
  });
});
document.querySelectorAll<HTMLElement>(".wishlist-button").forEach((button) => {
  button.addEventListener("click", openWishlistPanel);
});

// Customer dashboard shortcuts
document.querySelector<HTMLButtonElement>("#customerCartBtn")?.addEventListener("click", () => {
  renderCartPanel();
  openCart();
});
document.querySelector<HTMLButtonElement>("#customerWishlistBtn")?.addEventListener("click", openWishlistPanel);
elements.cartOverlay.addEventListener("click", closeCart);
document.querySelector<HTMLButtonElement>(".cart-close")?.addEventListener("click", closeCart);
elements.checkoutButton.addEventListener("click", () => {
  if (!state.currentUser) { openAuthModal(); return; }
  closeCart();
  openCheckoutModal();
});

// Language toggle
elements.languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language === "ha" ? "ha" : "en"));
});

document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => setTheme(getCurrentTheme() === "dark" ? "light" : "dark"));
});

// Vendor public registration form (marketing page, not the dashboard product form)
elements.vendorForm.addEventListener("submit", handleVendorRequestSubmit);
// NOTE: #vendorProductForm is wired via wireDashboardEvents when the vendor dashboard is injected.

// Vendor product image preview
document.getElementById("productImageInput")?.addEventListener("change", (event) => {
  const input = event.target as HTMLInputElement;
  const preview = document.getElementById("productImagePreview") as HTMLImageElement | null;
  if (!preview) return;
  const file = input.files?.[0];
  if (file) {
    const url = URL.createObjectURL(file);
    preview.src = url;
    preview.style.display = "block";
    preview.onload = () => URL.revokeObjectURL(url);
  } else {
    preview.src = "";
    preview.style.display = "none";
  }
});
// NOTE: #vendorProductsList and #vendorCommerceList are wired via wireDashboardEvents when the vendor dashboard is injected.

// Admin
elements.exportSearches.addEventListener("click", exportSearchHistory);
elements.clearSearches.addEventListener("click", clearPrototypeData);
elements.adminContent.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id === "commissionForm") {
    event.preventDefault();
    const data = new FormData(form);
    saveCommissionSettings({ defaultRate: Number(data.get("defaultRate") || 10) / 100 });
    renderAdminDashboard();
    showToast({ message: getCopy("Commission settings saved.", "An ajiye saitin kwamishan."), type: "success" });
    return;
  }
  if (form.id === "promotionForm") {
    event.preventDefault();
    const data = new FormData(form);
    const target = sanitizePlainText(String(data.get("target") || ""), 80);
    const type = String(data.get("type") || "seasonal_campaign") as PromotionType;
    const titleText = sanitizePlainText(String(data.get("title") || ""), 80);
    const discountPercent = Number(data.get("discountPercent") || 0) || undefined;
    createPromotion({
      title: titleText,
      type,
      discountPercent,
      code: type === "discount_code" ? target : undefined,
      vendor: type === "featured_vendor" ? target : undefined,
      productId: type === "featured_product" ? target : undefined,
      category: type === "seasonal_campaign" || type === "flash_sale" ? target.toLowerCase() : undefined,
    });

    if (state.currentUser?.token) {
      api.createAdminPromotion({
        title: { en: titleText, ha: titleText },
        type,
        discountPercent: discountPercent ?? 1,
        code: type === "discount_code" ? target || undefined : undefined,
        productId: type === "featured_product" ? target || undefined : undefined,
        vendorUserId: type === "featured_vendor" ? target || undefined : undefined,
        category: type === "seasonal_campaign" || type === "flash_sale" ? target.toLowerCase() || undefined : undefined,
        active: true,
      }).catch(() => undefined);
    }

    form.reset();
    renderCatalogPreview(false);
    renderAdminDashboard();
    showToast({ message: getCopy("Promotion created.", "An kirkiri talla."), type: "success" });
  }
});
elements.adminContent.addEventListener("change", (event) => {
  const select = (event.target as Element | null)?.closest<HTMLSelectElement>("[data-vendor-plan]");
  const vendor = select?.dataset.vendorPlan;
  const planId = select?.value as VendorPlanId | undefined;
  if (!vendor || !planId || !["free", "standard", "premium"].includes(planId)) return;
  setVendorSubscription(vendor, planId);
  renderAdminDashboard();
  showToast({ message: getCopy("Vendor plan updated.", "An sabunta plan din dillali."), type: "success" });
});
elements.adminContent.addEventListener("click", (event) => {
  const vendorPerformanceRow = (event.target as Element | null)?.closest<HTMLElement>("#vendorPerformance .record-row");
  if (vendorPerformanceRow && !((event.target as Element | null)?.closest("button"))) {
    const vendor = vendorPerformanceRow.querySelector("strong")?.textContent?.trim() || "";
    const wallet = getVendorWalletSummaries().find((summary) => summary.vendor === vendor);
    if (wallet && wallet.availableBalance > 0) {
      const withdrawal = requestWithdrawal(wallet.vendor, wallet.availableBalance);
      if (withdrawal) {
        renderAdminDashboard();
        showToast({
          message: getCopy("Withdrawal request created.", "An kirkiri bukatar cire kudi."),
          type: "success",
        });
      }
      return;
    }
  }

  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-action]");
  if (button) {
    const id = button.dataset.vendorId;
    const action = button.dataset.vendorAction;
    if (!id || (action !== "approved" && action !== "rejected")) return;

    if (state.currentUser?.role === "admin" && state.currentUser.token) {
      button.disabled = true;
      api.updateVendorApplication(id, {
        status: action,
        adminNote: `Updated from Kano Mart live admin dashboard`,
      })
        .then(async () => {
          await refreshLiveAdminDashboard();
          showToast({
            message: action === "approved" ? getCopy("Live vendor approved.", "An amince da dillali live.") : getCopy("Live vendor rejected.", "An ki dillali live."),
            type: action === "approved" ? "success" : "info",
          });
        })
        .catch(() => {
          applyLocalVendorDecision(id, action);
        })
        .finally(() => {
          button.disabled = false;
        });
      return;
    }

    applyLocalVendorDecision(id, action);
    return;
  }

  const productButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-product-action]");
  if (!productButton) {
    const reviewButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-review-action]");
    if (reviewButton?.dataset.reviewId) {
      const review = hideReview(reviewButton.dataset.reviewId);
      if (!review) return;

      if (state.currentUser?.token) {
        api.updateAdminReview(reviewButton.dataset.reviewId, { hidden: true }).catch(() => undefined);
      }

      renderAdminDashboard();
      showToast({
        message: getCopy("Review removed from public listings.", "An cire ra'ayi daga fili."),
        type: "info",
      });
      return;
    }

    const paymentButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-payment-action]");
    if (paymentButton?.dataset.paymentId) {
      const action = paymentButton.dataset.paymentAction;
      const payment =
        action === "confirm"
          ? confirmPayment(paymentButton.dataset.paymentId)
          : action === "fail"
            ? failPayment(paymentButton.dataset.paymentId)
            : action === "refund"
              ? refundPayment(paymentButton.dataset.paymentId)
              : null;
      if (!payment) return;

      if (state.currentUser?.token) {
        const apiStatus = action === "confirm" ? "paid" : action === "fail" ? "failed" : action === "refund" ? "refunded" : null;
        if (apiStatus) {
          api.updateAdminPayment(paymentButton.dataset.paymentId, {
            status: apiStatus as "paid" | "failed" | "refunded",
          }).catch(() => undefined);
        }
      }

      renderAdminDashboard();
      renderVendorCommerce();
      showToast({
        message: getCopy(`Payment ${payment.status}.`, `Biya ${payment.status}.`),
        type: payment.status === "paid" ? "success" : "info",
      });
      return;
    }

    const orderButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-order-advance]");
    if (orderButton?.dataset.orderAdvance) {
      const order = advanceOrderStatus(orderButton.dataset.orderAdvance);
      if (!order) return;

      if (state.currentUser?.token) {
        api.updateAdminOrder(orderButton.dataset.orderAdvance, { status: order.status }).catch(() => undefined);
      }

      renderAdminDashboard();
      renderVendorCommerce();
      showToast({
        message: getCopy(`Order ${order.id}: ${order.status}`, `Oda ${order.id}: ${order.status}`),
        type: order.status === "delivered" ? "success" : "info",
      });
      return;
    }

    const withdrawalButton = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-withdrawal-action]");
    if (!withdrawalButton?.dataset.withdrawalId) return;
    const action = withdrawalButton.dataset.withdrawalAction;
    const withdrawal =
      action === "approved"
        ? approveWithdrawal(withdrawalButton.dataset.withdrawalId, "Approved from prototype admin dashboard")
        : action === "rejected"
          ? rejectWithdrawal(withdrawalButton.dataset.withdrawalId, "Rejected from prototype admin dashboard")
          : null;
    if (!withdrawal) return;

    if (state.currentUser?.token && (action === "approved" || action === "rejected")) {
      // withdrawalId maps to a payoutRequest id — sync to the live /admin/payouts/:id endpoint
      api.updateAdminPayout(withdrawalButton.dataset.withdrawalId, {
        status: action,
        adminNote: action === "approved" ? "Approved from admin dashboard" : "Rejected from admin dashboard",
      }).catch(() => undefined);
    }

    renderAdminDashboard();
    renderVendorCommerce();
    showToast({
      message: getCopy(`Withdrawal ${withdrawal.status}.`, `Cire kudi ${withdrawal.status}.`),
      type: withdrawal.status === "approved" ? "success" : "info",
    });
    return;
  }
  const productId = productButton.dataset.productId;
  const productAction = productButton.dataset.productAction;
  if (!productId || (productAction !== "approved" && productAction !== "hidden" && productAction !== "rejected")) return;

  if (state.currentUser?.role === "admin" && state.currentUser.token) {
    productButton.disabled = true;
    api.updateAdminProduct(productId, {
      status: productAction,
      reviewNote: "Updated from Kano Mart live admin dashboard",
    })
      .then(async () => {
        await refreshLiveAdminDashboard();
        showToast({
          message: getCopy("Live product moderation updated.", "An sabunta duba kayan live."),
          type: productAction === "approved" ? "success" : "info",
        });
      })
      .catch(() => {
        applyLocalProductDecision(productId, productAction);
      })
      .finally(() => {
        productButton.disabled = false;
      });
    return;
  }

  applyLocalProductDecision(productId, productAction);
});
// User / auth
elements.userButton.addEventListener("click", openUserPanel);
window.addEventListener("kanoMart:signed-in", () => {
  syncUserButton();
  syncRoleNavigation();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderAdminDashboard();
  renderCustomerDashboard();
  renderOrdersPage();
  void refreshLiveAdminDashboard();
  void refreshLiveVendorDashboard();
  void fetchLiveNotifications();
  if (state.currentUser?.role === "customer") {
    void fetchLiveOrders().then(() => {
      renderCustomerDashboard();
      renderDashboardPage(getCurrentRoute());
    }).catch(() => undefined);
  }
  const nextRoute = getDefaultRouteForRole();
  window.history.replaceState(null, "", `#${nextRoute}`);
  setRoute(nextRoute);
  // Inject the new rich dashboard view for the logged-in role
  renderDashboardPage(nextRoute);
});
window.addEventListener("kanoMart:signed-out", () => {
  syncRoleNavigation();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderOrdersPage();
  setRoute("home");
});

// Global Escape key closes cart
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
  if (e.key === "Escape") closeSidebar();
});

// ── Admin tab switching ──
document.querySelector("#adminContent")?.addEventListener("click", (e) => {
  const btn = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-admin-tab]");
  if (!btn) return;
  const tab = btn.dataset.adminTab!;
  document.querySelectorAll<HTMLButtonElement>(".admin-tab-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.adminTab === tab);
    b.setAttribute("aria-selected", String(b.dataset.adminTab === tab));
  });
  document.querySelectorAll<HTMLElement>(".admin-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== tab;
  });
});

// ── Vendor tab switching ──
document.querySelector(".vendor-dashboard")?.addEventListener("click", (e) => {
  const btn = (e.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-tab]");
  if (!btn) return;
  const tab = btn.dataset.vendorTab!;
  document.querySelectorAll<HTMLButtonElement>(".vendor-tab-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.vendorTab === tab);
    b.setAttribute("aria-selected", String(b.dataset.vendorTab === tab));
  });
  document.querySelectorAll<HTMLElement>(".vendor-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.vendorPanel !== tab;
  });
});

// — Init: clear all demo/legacy data when app version changes —
const APP_DATA_VERSION = "v2-postgres";
if (localStorage.getItem("kanoMart.dataVersion") !== APP_DATA_VERSION) {
  const keysToPreserve = new Set(["kanoMart.dataVersion", "kanoMart.language", SIDEBAR_COLLAPSED_KEY, THEME_STORAGE_KEY]);
  Object.keys(localStorage)
    .filter((k) => !keysToPreserve.has(k))
    .forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("kanoMart.dataVersion", APP_DATA_VERSION);
}

// — Init —
// Demo seed products are for local development only; in production the catalog
// is exclusively what the API returns.
setTheme(getPreferredTheme());
setSeedCatalogEnabled(["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname));
syncCart();
syncWishlistCount();
setLanguage(state.language);
syncUserButton();
renderAdminGate();
renderAdminDashboard();
renderVendorProducts();
renderVendorCommerce();
renderOrdersPage();
syncRoleNavigation();
setRoute();
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
syncSidebarLabels();
void refreshLiveCatalog();
void refreshLiveAdminDashboard();
void refreshLiveVendorDashboard();

// Validate stored session token against the live API; clear on 401 / expired.
// Note: a 401 from api.me() also fires kanoMart:sessionExpired (which calls signOut()),
// so we guard with state.currentUser to avoid a double sign-out + double toast.
if (state.currentUser?.token) {
  void refreshSession().then((user) => {
    if (!user && state.currentUser) {
      // Token is no longer valid AND the sessionExpired handler hasn't already cleared it.
      signOut();
      showToast({ message: getCopy("Your session expired. Please sign in again.", "Zaman ku ya ƙare. Da fatan za a sake shiga."), type: "info" });
      return;
    }
    if (user && state.currentUser) {
      // Reconcile with the server: role/vendorStatus may have changed since the
      // session was stored (e.g. vendor approved, role corrected).
      state.currentUser = {
        ...state.currentUser,
        id: user.id,
        role: user.role,
        vendorStatus: user.vendorStatus,
        name: user.name || state.currentUser.name,
        email: user.email ?? state.currentUser.email,
      };
      localStorage.setItem(storageKeys.session, JSON.stringify(state.currentUser));
      state.adminAuthenticated = user.role === "admin";
      syncUserButton();
      syncRoleNavigation();
      renderAdminGate();
      setRoute();
      if (user.role === "customer") {
        void fetchLiveOrders().then(() => {
          renderCustomerDashboard();
          renderDashboardPage(getCurrentRoute());
        }).catch(() => undefined);
      }
      renderDashboardPage(getCurrentRoute());
    }
  }).catch(() => undefined);
}

// Global session-expiry handler: any 401 from any API call lands here.
window.addEventListener("kanoMart:sessionExpired", () => {
  if (state.currentUser) {
    signOut();
    openAuthModal();
    showToast({ message: getCopy("Your session expired. Please sign in again.", "Zaman ku ya ƙare. Da fatan za a sake shiga."), type: "info" });
  }
});

// ── Notification badge polling ─────────────────────────────────────────────

const notifBtn = document.getElementById("sidebarNotifBtn") as HTMLButtonElement | null;
const notifCountEl = document.getElementById("sidebarNotifCount") as HTMLElement | null;

function updateNotifBadge(count: number): void {
  if (!notifCountEl) return;
  if (count > 0) {
    notifCountEl.textContent = count > 99 ? "99+" : String(count);
    notifCountEl.hidden = false;
  } else {
    notifCountEl.hidden = true;
  }
}

let _notifPollTimer: ReturnType<typeof setInterval> | null = null;

function startNotifPolling(): void {
  if (_notifPollTimer !== null) return;
  const poll = () => {
    const role = state.currentUser?.role;
    if (role !== "vendor" && role !== "admin") return;
    fetchLiveNotifications().then((notifs) => {
      const unread = notifs.filter((n) => !n.readAt).length;
      updateNotifBadge(unread);
    }).catch(() => undefined);
  };
  poll();
  _notifPollTimer = setInterval(poll, 30_000);
}

function stopNotifPolling(): void {
  if (_notifPollTimer !== null) {
    clearInterval(_notifPollTimer);
    _notifPollTimer = null;
  }
  updateNotifBadge(0);
}

notifBtn?.addEventListener("click", () => {
  const role = state.currentUser?.role;
  if (role === "vendor") { window.location.hash = "vendor"; setRoute("vendor"); }
  else if (role === "admin") { window.location.hash = "admin"; setRoute("admin"); }
  // Mark all as read via API (fire-and-forget)
  getLiveNotifications().filter((n) => !n.readAt).forEach((n) => {
    void markNotificationRead(n.id);
  });
  updateNotifBadge(0);
});

window.addEventListener("kanoMart:signed-in", () => {
  const role = state.currentUser?.role;
  if (role === "vendor" || role === "admin") startNotifPolling();
});

window.addEventListener("kanoMart:signed-out", () => {
  stopNotifPolling();
  stopOrderPolling();
});

// Start polling immediately if a vendor/admin session was restored on page load
if (state.currentUser?.role === "vendor" || state.currentUser?.role === "admin") {
  startNotifPolling();
}

// Pre-fetch categories from the live API for dynamic catalog support
void fetchLiveCategories();

// Initialise the dedicated login and signup pages
initLoginPage();
initSignupPage();

// Render role dashboards for users already logged in (page reload)
renderCustomerDashboard();
renderOrdersPage();
// Inject rich dashboard view for users restoring a session
if (state.currentUser) {
  renderDashboardPage(getCurrentRoute());
}

const scheduleEnhancements =
  "requestIdleCallback" in window
    ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 1200 })
    : (callback: () => void) => window.setTimeout(callback, 350);

scheduleEnhancements(() => {
  import("./frontend-enhancements").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});
