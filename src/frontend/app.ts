import type { Language, VendorApprovalStatus } from "../backend/types";
import { storageKeys } from "../backend/data";
import { state, elements } from "./state";
import { escapeHtml, formatDate, formatPrice, getCopy, sanitizePlainText, setActiveLanguageButtons } from "./utils";
import { getSearchResults, saveSearch } from "./search";
import { renderProductCard, updateResultCopy, renderAdminDashboard as renderLegacyAdminDashboard } from "./render";
import { exportSearchHistory, clearPrototypeData } from "./admin";
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
import { openProductModal } from "./product-modal";
import { openWishlistPanel, toggleWishlist, syncWishlistCount, syncAllWishlistButtons } from "./wishlist";
import { openAuthModal, openUserPanel, saveSession, syncUserButton } from "./auth";
import { renderAdminGate } from "./admin-gate";
import { reviewVendorRequest, saveVendorRequest as persistVendorRequest } from "../backend/vendors";
import { showToast } from "./toast";
import {
  getCatalogProducts,
  getProductById,
  getProductsForVendor,
  moderateProduct,
  setVendorProductListingStatus,
} from "../backend/products";
import { vendorProfiles } from "../backend/data";
import { getCachedSearchResults, paginateProducts, PRODUCT_PAGE_SIZE, renderProductSkeletons } from "./frontend-data";
import { advanceOrderStatus, getOrders, renderOrdersPanel } from "./orders";
import { approveWithdrawal, rejectWithdrawal, requestWithdrawal } from "../backend/withdrawals";
import { getVendorWalletSummaries } from "../backend/wallet";
import { createSessionForPhone, findVendorByPhone } from "../backend/users";
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
  fetchLiveCategories,
  fetchLiveVendorApplication,
  getLiveVendorApplication,
  refreshSession,
} from "./live-api";
import { api, ApiRequestError, type ApiUser } from "./api-client";
import { initLoginPage, initSignupPage } from "./auth-pages";
import { getDashboardRoute, getDefaultDashboardRoute, getRoutePage } from "./router/dashboard-routes";
import { renderCustomerOverview } from "./pages/customer/overview";
import { renderVendorOverview } from "./pages/vendor/overview";
import { renderAdminOverview } from "./pages/admin/overview";
import { applyLanguageToDOM, setI18nLang } from "../i18n";
import { inject as injectAnalytics } from "@vercel/analytics";

const routes = new Set(["home", "customer", "catalog", "payments", "vendor", "orders", "admin", "login", "signup", "sell"]);
const AUTH_ROUTES = new Set(["login", "signup"]);
const SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";
const VENDOR_IMAGE_MAX_SOURCE_BYTES = 8_000_000;
const VENDOR_IMAGE_MAX_DATA_URL_LENGTH = 700_000;
const VENDOR_IMAGE_MAX_EDGE = 1_400;
const VENDOR_IMAGE_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];
const VENDOR_IMAGE_EDGE_STEPS = [1_400, 1_200, 1_000, 800, 640];
const VENDOR_PRODUCT_CATEGORIES = new Set(["food", "fashion", "children", "essentials"]);

function getCurrentRoute(): string {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  if (raw.startsWith("p/")) return raw;   // product detail: p/:id
  if (raw.startsWith("v/")) return raw;   // vendor storefront: v/:slug
  if (getDashboardRoute(raw)) return raw;
  return routes.has(raw) ? raw : "home";
}

function getVisitorRole(): string {
  return state.currentUser?.role ?? "guest";
}

function getDefaultRouteForRole(role = getVisitorRole()): string {
  return getDefaultDashboardRoute(role);
}

function canAccessRoute(route: string): boolean {
  const role = getVisitorRole();
  const dashboardRoute = getDashboardRoute(route);
  if (dashboardRoute) return dashboardRoute.role === role;
  if (route === "admin") return role === "admin";
  if (route === "customer") return role === "customer";
  if (route === "orders") return role === "customer";
  // Product detail, vendor storefront, and sell page are public
  if (route.startsWith("p/") || route.startsWith("v/") || route === "sell") return true;
  // Authenticated users should not land on login/signup — redirect to their dashboard
  if (AUTH_ROUTES.has(route)) return role === "guest";
  return true;
}

function setRoute(route = getCurrentRoute()): void {
  let nextRoute = routes.has(route) || getDashboardRoute(route) || route.startsWith("p/") || route.startsWith("v/") ? route : "home";
  const role = getVisitorRole();
  if (nextRoute === "customer" && role === "customer") nextRoute = "customer/overview";
  if (nextRoute === "vendor" && role === "vendor") nextRoute = "vendor/overview";
  if (nextRoute === "admin" && role === "admin") nextRoute = "admin/overview";
  if (!canAccessRoute(nextRoute)) {
    nextRoute = getDefaultRouteForRole();
    if (window.location.hash.replace("#", "") !== nextRoute) {
      window.history.replaceState(null, "", `#${nextRoute}`);
    }
  }
  const pageRoute = getRoutePage(nextRoute);
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === pageRoute;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll<HTMLElement>("[data-route]").forEach((link) => {
    const linkRoute = link.dataset.route ?? "";
    const isActive = linkRoute === nextRoute || linkRoute === pageRoute || nextRoute.startsWith(`${linkRoute}/`);
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
  // Toggle full-page auth layout (hides sidebar + header)
  document.body.classList.toggle("is-auth-route", AUTH_ROUTES.has(nextRoute));
  // Toggle transparent hero header vs solid sticky header
  document.body.classList.toggle("on-home", pageRoute === "home");
  // Body role classes (used by CSS for marketing nav, mobile bottom nav, etc.)
  const currentRole = getVisitorRole();
  document.body.classList.toggle("is-guest", currentRole === "guest");
  document.body.classList.toggle("is-customer", currentRole === "customer");
  document.body.classList.toggle("is-vendor", currentRole === "vendor");
  document.body.classList.toggle("is-admin", currentRole === "admin");
  // Render new route-specific pages
  if (pageRoute === "product") renderProductPage(nextRoute.replace("p/", ""));
  if (pageRoute === "vendorpage") renderVendorStorefront(nextRoute.replace("v/", ""));
  renderActiveDashboardRoute(nextRoute);
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
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
      label: "Guest",
      title: "Marketplace",
      hint: "Sign in to unlock your dashboard.",
      meta: "Sign in with mobile number",
      avatar: "?",
    },
    customer: {
      label: "Customer",
      title: "Customer workspace",
      hint: "Orders, cart, wishlist, and checkout.",
      meta: user?.phone ?? "Customer account",
      avatar: user?.name?.slice(0, 1).toUpperCase() || "C",
    },
    vendor: {
      label: "Vendor",
      title: "Seller workspace",
      hint: user?.vendorStatus === "approved" ? "Store approved and ready." : "Approval status is pending.",
      meta: user?.vendorStatus ? `Vendor: ${user.vendorStatus}` : "Vendor account",
      avatar: user?.name?.slice(0, 1).toUpperCase() || "V",
    },
    admin: {
      label: "Admin",
      title: "Operations control",
      hint: "Approvals, finance, orders, and risk.",
      meta: "Verified admin number",
      avatar: "A",
    },
  }[role] ?? {
    label: "Guest",
    title: "Marketplace",
    hint: "Sign in to unlock your dashboard.",
    meta: "Sign in with mobile number",
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
  if (!canAccessRoute(getCurrentRoute())) {
    setRoute(getDefaultRouteForRole(role));
  }
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
  } catch (error) {
    console.warn("[KanoMart] Live admin sync failed — showing local data:", error);
    renderAdminDashboard();
  }
}

// ─── Product detail page ───────────────────────────────────────────────────

function renderProductPage(productId: string): void {
  const section = document.getElementById("productPage");
  if (!section) return;
  const product = getProductById(productId);
  if (!product) {
    section.innerHTML = `
      <div class="pdp-not-found">
        <h1>${getCopy("Product not found", "Ba a sami kayan ba")}</h1>
        <a href="#catalog" data-route="catalog">${getCopy("Back to catalog", "Koma kasuwa")}</a>
      </div>`;
    return;
  }
  const lang = state.language;
  const name = escapeHtml(product.name[lang]);
  const vendor = escapeHtml(product.vendor);
  const price = escapeHtml(product.price);
  const area = escapeHtml(product.area);
  const desc = product.description?.[lang] ? `<p class="pdp-desc">${escapeHtml(product.description[lang])}</p>` : "";
  const wished = typeof isWishlisted === "function" ? isWishlisted(product.id) : false;
  const profile = vendorProfiles[product.vendor];
  const vendorCard = profile ? `
    <div class="pdp-vendor-card">
      <div class="pdp-vendor-avatar">${escapeHtml(profile.name.slice(0, 2).toUpperCase())}</div>
      <div class="pdp-vendor-info">
        <strong>${escapeHtml(profile.name)}</strong>
        <small>★ ${profile.rating.toFixed(1)} · ${profile.totalOrders} ${getCopy("orders", "oda")} · ${getCopy("Verified since", "Tabbatacce tun")} ${profile.since}</small>
      </div>
      <a href="#v/${encodeURIComponent(product.vendor)}" data-route-vendor="${encodeURIComponent(product.vendor)}" class="pdp-vendor-link">${getCopy("Visit store →", "Ziyarci shago →")}</a>
    </div>` : "";
  const imgHtml = product.imageDataUrl
    ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${name}" class="pdp-main-img" />`
    : `<div class="pdp-main-img pdp-img-placeholder" style="--accent:${product.accent ?? "#176b4d"}">${escapeHtml(product.subcategory[lang])}</div>`;

  section.innerHTML = `
    <div class="pdp-breadcrumb">
      <a href="#home" data-route="home">${getCopy("Home", "Gida")}</a>
      <span aria-hidden="true">›</span>
      <a href="#catalog" data-route="catalog">${getCopy("Browse", "Bincika")}</a>
      <span aria-hidden="true">›</span>
      <strong>${name}</strong>
    </div>
    <div class="pdp-body">
      <div class="pdp-gallery">${imgHtml}</div>
      <div class="pdp-info">
        <small class="pdp-vendor-meta">${vendor} · ${area}</small>
        <h1 class="pdp-name">${name}</h1>
        <div class="pdp-price">${price}</div>
        ${desc}
        <div class="pdp-stock">${getCopy("Stock", "Adadi")}: ${escapeHtml(String(product.quantityAvailable ?? getCopy("Available", "Akwai")))}</div>
        <div class="pdp-actions">
          <button type="button" class="pdp-add-to-cart" data-pdp-add="${escapeHtml(product.id)}">
            ${getCopy("Add to cart", "Saka a kwando")}
          </button>
          <button type="button" class="pdp-wishlist${wished ? " is-wishlisted" : ""}" data-pdp-wish="${escapeHtml(product.id)}"
            aria-pressed="${wished}" aria-label="${getCopy("Save to wishlist", "Ajiye")}">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
            ${wished ? getCopy("Saved", "An ajiye") : getCopy("Save", "Ajiye")}
          </button>
        </div>
        <ul class="pdp-trust-list">
          <li>${getCopy("Same-day delivery in Kano", "Isarwa a ranar yau a Kano")}</li>
          <li>${getCopy("Pay on delivery available", "Ana biya a gida")}</li>
          <li>${getCopy("Easy 7-day returns on eligible items", "Dawowar kaya mai sauki a cikin kwanaki 7")}</li>
        </ul>
        ${vendorCard}
      </div>
    </div>`;

  // Wire up buttons
  section.querySelector<HTMLButtonElement>("[data-pdp-add]")?.addEventListener("click", (e) => {
    const btn = (e.currentTarget as HTMLButtonElement);
    if (!state.currentUser) { openAuthModal(); return; }
    addToCart(btn.dataset.pdpAdd!);
    elements.cartCountEl.textContent = String(state.cartCount);
    btn.textContent = getCopy("Added!", "An saka!");
    window.setTimeout(() => { btn.textContent = getCopy("Add to cart", "Saka a kwando"); }, 1400);
  });
  section.querySelector<HTMLButtonElement>("[data-pdp-wish]")?.addEventListener("click", (e) => {
    const btn = (e.currentTarget as HTMLButtonElement);
    if (!state.currentUser) { openAuthModal(); return; }
    toggleWishlist(btn.dataset.pdpWish!, product.name[lang]);
    syncWishlistCount();
    const now = typeof isWishlisted === "function" ? isWishlisted(product.id) : false;
    btn.classList.toggle("is-wishlisted", now);
    btn.setAttribute("aria-pressed", String(now));
  });
  section.querySelector<HTMLAnchorElement>("[data-route-vendor]")?.addEventListener("click", (e) => {
    e.preventDefault();
    const slug = (e.currentTarget as HTMLAnchorElement).dataset.routeVendor || "";
    window.location.hash = `v/${slug}`;
    setRoute(`v/${slug}`);
  });
}

// ─── Vendor storefront page ────────────────────────────────────────────────

function renderVendorStorefront(vendorSlug: string): void {
  const section = document.getElementById("vendorPage");
  if (!section) return;
  const decodedSlug = decodeURIComponent(vendorSlug);
  const profile = vendorProfiles[decodedSlug];
  const products = getCatalogProducts().filter((p) => p.vendor === decodedSlug);
  const lang = state.language;

  if (!profile && products.length === 0) {
    section.innerHTML = `
      <div class="pdp-not-found">
        <h1>${getCopy("Store not found", "Ba a sami shago ba")}</h1>
        <a href="#catalog" data-route="catalog">${getCopy("Back to catalog", "Koma kasuwa")}</a>
      </div>`;
    return;
  }

  const vendorName = escapeHtml(profile?.name ?? decodedSlug);
  const rating = profile ? `★ ${profile.rating.toFixed(1)}` : "";
  const orders = profile ? `${profile.totalOrders} ${getCopy("orders", "oda")}` : "";
  const since = profile ? `${getCopy("Verified since", "Tabbatacce tun")} ${profile.since}` : "";

  const productsHtml = products.length
    ? products.map(renderProductCard).join("")
    : `<p class="muted">${getCopy("No products listed yet.", "Babu kaya da aka saka tukuna.")}</p>`;

  section.innerHTML = `
    <div class="pdp-breadcrumb">
      <a href="#home" data-route="home">${getCopy("Home", "Gida")}</a>
      <span aria-hidden="true">›</span>
      <span>${getCopy("Vendors", "Dillalai")}</span>
      <span aria-hidden="true">›</span>
      <strong>${vendorName}</strong>
    </div>
    <div class="vendor-storefront-header">
      <div class="vsf-avatar">${escapeHtml(vendorName.slice(0, 2).toUpperCase())}</div>
      <div class="vsf-info">
        <h1>${vendorName}</h1>
        <div class="vsf-meta">${[rating, orders, since].filter(Boolean).join(" · ")}</div>
        ${profile?.area ? `<small class="muted">${escapeHtml(profile.area ?? "")}</small>` : ""}
      </div>
    </div>
    <div class="vsf-products">
      <h2>${getCopy("Products", "Kaya")} <span class="vsf-count">(${products.length})</span></h2>
      <div class="product-grid" id="vendorStorefrontGrid">${productsHtml}</div>
    </div>`;

  syncAllWishlistButtons();
}

function renderActiveDashboardRoute(route = getCurrentRoute()): void {
  const user = state.currentUser;
  if (user?.role === "customer" && getRoutePage(route) === "customer") {
    renderCustomerDashboard(route);
    return;
  }
  if (user?.role === "vendor" && getRoutePage(route) === "vendor") {
    renderVendorDashboard(route);
    return;
  }
  if (user?.role === "admin" && getRoutePage(route) === "admin") {
    renderAdminDashboard(route);
  }
}

function renderCustomerDashboard(route = getCurrentRoute()): void {
  const user = state.currentUser;
  if (!user || user.role !== "customer") return;
  const section = document.querySelector<HTMLElement>("#customer");
  if (!section) return;
  section.innerHTML = renderCustomerOverview(user, route);
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
  syncUserButton();
  syncRoleNavigation();
  renderActiveDashboardRoute();
  renderOrdersPage();
  renderCartPanel();

  const userOrdersList = document.querySelector<HTMLElement>("#userOrdersList");
  if (userOrdersList) userOrdersList.innerHTML = renderOrdersPanel();
  if (document.querySelector("#wishlistModal")) openWishlistPanel();
}

async function refreshLiveVendorDashboard(): Promise<void> {
  if (state.currentUser?.role !== "vendor" || !state.currentUser.token) return;
  try {
    const [, , application] = await Promise.all([
      refreshLiveVendorProducts(),
      fetchLiveVendorData(),
      fetchLiveVendorApplication(),
    ]);
    if (application?.status) syncCurrentVendorStatus(application.status);
    renderVendorDashboard();
  } catch {
    // Local vendor dashboard remains usable if live sync is unavailable.
  }
}

function performSearch(rawQuery: string): void {
  const query = rawQuery.trim();
  if (!query) return;

  state.lastQuery = query;
  state.visibleProductCount = PRODUCT_PAGE_SIZE;
  renderLoadingProducts();
  document.querySelector<HTMLElement>("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    const results = getCachedSearchResults(query);
    saveSearch(query, results);
    state.lastResults = results;
    updateResultCopy(query, results);
    renderProductResults(results);
    renderAdminDashboard();
  }, 180);
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

  // Use the i18n dictionary to apply language to all data-en/data-ha elements
  // Sidebar nav links are excluded — syncSidebarLabels() handles them separately
  setI18nLang(language);
  applyLanguageToDOM(language);

  setActiveLanguageButtons(language);
  syncSidebarLabels();

  if (state.lastQuery) {
    state.lastResults = getSearchResults(state.lastQuery);
    updateResultCopy(state.lastQuery, state.lastResults);
    renderProductResults();
  } else {
    renderCatalogPreview();
  }

  renderLanguageSensitiveViews();
  // Re-apply after re-render: dashboards inject new DOM nodes that need translation
  applyLanguageToDOM(language);
  syncSidebarLabels();
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

type PreparedVendorImage = {
  dataUrl: string;
  fileName: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  originalBytes: number;
  finalBytes: number;
  compressed: boolean;
};

function createVendorFormError(code: string): Error {
  const error = new Error(code);
  error.name = "VendorProductFormError";
  return error;
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(createVendorFormError("unsupported_image"));
      return;
    }
    if (file.size > VENDOR_IMAGE_MAX_SOURCE_BYTES) {
      reject(createVendorFormError("source_image_too_large"));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(createVendorFormError("image_read_failed")));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(createVendorFormError("image_decode_failed")), { once: true });
    image.src = dataUrl;
  });
}

function normalizeVendorImageName(fileName: string, mimeType: PreparedVendorImage["mimeType"]): string {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const base = sanitizePlainText(fileName.replace(/\.[^.]+$/, ""), 70)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "product-image"}.${ext}`;
}

function drawVendorImage(image: HTMLImageElement, maxEdge: number, quality: number): string {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw createVendorFormError("image_decode_failed");

  const ratio = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  const targetWidth = Math.max(1, Math.round(sourceWidth * ratio));
  const targetHeight = Math.max(1, Math.round(sourceHeight * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw createVendorFormError("image_compression_failed");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  if (!dataUrl.startsWith("data:image/jpeg;base64,")) throw createVendorFormError("image_compression_failed");
  return dataUrl;
}

async function prepareVendorProductImage(file: File): Promise<PreparedVendorImage> {
  const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedMimeTypes.has(file.type)) throw createVendorFormError("unsupported_image");

  const sourceDataUrl = await readImageAsDataUrl(file);
  if (sourceDataUrl.length <= VENDOR_IMAGE_MAX_DATA_URL_LENGTH) {
    const mimeType = file.type as PreparedVendorImage["mimeType"];
    return {
      dataUrl: sourceDataUrl,
      fileName: normalizeVendorImageName(file.name, mimeType),
      mimeType,
      originalBytes: file.size,
      finalBytes: sourceDataUrl.length,
      compressed: false,
    };
  }

  const image = await loadImageElement(sourceDataUrl);
  for (const edge of VENDOR_IMAGE_EDGE_STEPS) {
    const maxEdge = Math.min(edge, VENDOR_IMAGE_MAX_EDGE);
    for (const quality of VENDOR_IMAGE_QUALITY_STEPS) {
      const dataUrl = drawVendorImage(image, maxEdge, quality);
      if (dataUrl.length <= VENDOR_IMAGE_MAX_DATA_URL_LENGTH) {
        return {
          dataUrl,
          fileName: normalizeVendorImageName(file.name, "image/jpeg"),
          mimeType: "image/jpeg",
          originalBytes: file.size,
          finalBytes: dataUrl.length,
          compressed: true,
        };
      }
    }
  }

  throw createVendorFormError("compressed_image_too_large");
}

function getEffectiveVendorStatus(): VendorApprovalStatus {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return "pending";
  const application = getLiveVendorApplication();
  const localVendor = findVendorByPhone(user.phone);
  return application?.status ?? user.vendorStatus ?? localVendor?.status ?? "pending";
}

function syncCurrentVendorStatus(status: VendorApprovalStatus): void {
  const user = state.currentUser;
  if (!user || user.role !== "vendor" || user.vendorStatus === status) return;
  user.vendorStatus = status;
  localStorage.setItem(storageKeys.session, JSON.stringify(user));
  syncRoleNavigation();
}

function syncSessionFromApiUser(user: ApiUser | null): void {
  const current = state.currentUser;
  if (!current || !user || current.phone !== user.phone) return;
  state.currentUser = {
    ...current,
    id: user.id ?? current.id,
    email: user.email,
    firstName: user.firstName ?? current.firstName,
    lastName: user.lastName ?? current.lastName,
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || current.name,
    role: user.role,
    vendorStatus: user.vendorStatus ?? current.vendorStatus,
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage ?? current.preferredLanguage,
    createdAt: user.createdAt ?? current.createdAt,
  };
  localStorage.setItem(storageKeys.session, JSON.stringify(state.currentUser));
  syncUserButton();
  syncRoleNavigation();
  renderActiveDashboardRoute();
}

function setVendorProductMessage(
  message: HTMLElement | null,
  text: string,
  stateName: "info" | "success" | "error" = "info"
): void {
  if (!message) return;
  message.textContent = text;
  message.dataset.state = stateName;
}

function getVendorGateCopy(status: VendorApprovalStatus, hasToken: boolean): { title: string; body: string; submit: string } {
  if (!hasToken) {
    return {
      title: getCopy("Sign in again to submit products", "Sake shiga domin tura kaya"),
      body: getCopy(
        "Your session is missing live API access. Sign out and sign in again before adding products.",
        "Zaman shiga bai da damar API live. Fita ka sake shiga kafin saka kaya."
      ),
      submit: getCopy("Sign in required", "Ana bukatar shiga"),
    };
  }
  if (status === "approved") {
    return {
      title: getCopy("Store approved", "An amince da shago"),
      body: getCopy(
        "New products are submitted to admin review before they appear in the customer catalog.",
        "Sabbin kaya za su je wajen admin kafin su bayyana a kasuwar kwastoma."
      ),
      submit: getCopy("Add product", "Saka kaya"),
    };
  }
  if (status === "rejected") {
    return {
      title: getCopy("Store not approved", "Ba a amince da shago ba"),
      body: getCopy(
        "Your vendor application was not approved. Contact support before adding products.",
        "Ba a amince da rajistar dillali ba. Tuntubi tallafi kafin saka kaya."
      ),
      submit: getCopy("Store not approved", "Ba a amince ba"),
    };
  }
  return {
    title: getCopy("Vendor approval pending", "Ana jiran amincewar dillali"),
    body: getCopy(
      "Admin must approve your store before products can be submitted. You can browse the dashboard while waiting.",
      "Admin sai ya amince da shagonsa kafin a tura kaya. Za ka iya duba dashboard yayin jira."
    ),
    submit: getCopy("Waiting for approval", "Ana jiran amincewa"),
  };
}

function renderVendorProductGate(): void {
  const form = document.querySelector<HTMLFormElement>("#vendorProductForm");
  const gate = document.querySelector<HTMLElement>("#vendorProductGate");
  const message = document.querySelector<HTMLElement>("#vendorProductMessage");
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
  const user = state.currentUser;
  if (!form || !user || user.role !== "vendor") return;

  const status = getEffectiveVendorStatus();
  const canSubmit = Boolean(user.token) && status === "approved";
  const copy = getVendorGateCopy(status, Boolean(user.token));
  if (gate) {
    gate.dataset.status = canSubmit ? "approved" : status;
    gate.innerHTML = `
      <strong>${escapeHtml(copy.title)}</strong>
      <span>${escapeHtml(copy.body)}</span>
    `;
  }

  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button").forEach((control) => {
    control.disabled = !canSubmit;
  });
  if (submit) {
    submit.textContent = copy.submit;
    submit.dataset.idleText = copy.submit;
  }
  if (!canSubmit && message && !message.textContent.trim()) {
    setVendorProductMessage(message, copy.body, status === "rejected" || !user.token ? "error" : "info");
  }
}

function renderVendorDashHeader(): void {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const vendor = findVendorByPhone(user.phone);
  const businessName = vendor?.businessName || user.name;
  const status = getEffectiveVendorStatus();

  const nameEl = document.querySelector<HTMLElement>("#vendorDashBusinessName");
  if (nameEl) nameEl.textContent = businessName;

  const badge = document.querySelector<HTMLElement>("#vendorStatusBadge");
  if (badge) {
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.dataset.status = status;
  }
}

function renderVendorDashboard(route = getCurrentRoute()): void {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const dashboard = document.querySelector<HTMLElement>(".vendor-dashboard");
  if (!dashboard) return;
  dashboard.innerHTML = renderVendorOverview(user, route);
  renderVendorProducts();
  renderVendorProductGate();
  renderVendorCommerce();
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

function renderAdminDashboard(route = getCurrentRoute()): void {
  if (state.currentUser?.role !== "admin") {
    renderLegacyAdminDashboard();
    return;
  }
  if (elements.adminContent) {
    elements.adminContent.innerHTML = renderAdminOverview(route);
    refreshLegacyAdminElementRefs();
  }
  renderLegacyAdminDashboard();
}

function refreshLegacyAdminElementRefs(): void {
  const assign = <K extends keyof typeof elements>(key: K, selector: string): void => {
    const node = document.querySelector(selector);
    if (node) {
      (elements as unknown as Record<string, Element>)[String(key)] = node;
    }
  };

  assign("totalSearches", "#totalSearches");
  assign("failedSearches", "#failedSearches");
  assign("savedVendors", "#savedVendors");
  assign("topDemand", "#topDemand");
  assign("popularSearches", "#popularSearches");
  assign("failedSearchList", "#failedSearchList");
  assign("demandTrends", "#demandTrends");
  assign("vendorApprovals", "#vendorApprovals");
  assign("productModeration", "#productModeration");
  assign("withdrawalQueue", "#withdrawalQueue");
  assign("vendorPerformance", "#vendorPerformance");
  assign("orderRecords", "#orderRecords");
  assign("paymentStatus", "#paymentStatus");
  assign("reviewModeration", "#reviewModeration");
  assign("searchHistoryTable", "#searchHistoryTable");
}

function setVendorProductFormBusy(form: HTMLFormElement, busy: boolean, label?: string): void {
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button").forEach((control) => {
    control.disabled = busy;
  });
  if (submit) {
    submit.setAttribute("aria-busy", String(busy));
    submit.textContent = busy ? label ?? getCopy("Submitting...", "Ana turawa...") : submit.dataset.idleText || getCopy("Add product", "Saka kaya");
  }
}

function firstValidationDetail(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  for (const value of Object.values(details as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function getVendorProductErrorCopy(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.code === "vendor_not_approved") {
      return getCopy(
        "Your store is not approved yet. Admin approval is required before products can be submitted.",
        "Ba a amince da shagonsa ba tukuna. Ana bukatar amincewar admin kafin tura kaya."
      );
    }
    if (error.code === "unauthenticated") {
      return getCopy("Your session expired. Sign in again before adding products.", "Zaman shiga ya kare. Sake shiga kafin saka kaya.");
    }
    if (error.code === "body_too_large" || error.message.toLowerCase().includes("too large")) {
      return getCopy(
        "The image is still too large after compression. Use a clearer, smaller photo and try again.",
        "Hoton har yanzu ya yi girma bayan ragewa. Yi amfani da karamin hoto ka sake gwadawa."
      );
    }
    if (error.code === "validation_failed") {
      const detail = firstValidationDetail(error.details);
      return detail || getCopy("Check the product details and try again.", "Duba bayanan kaya ka sake gwadawa.");
    }
    if (error.code === "request_timeout" || error.code === "network_error") {
      return getCopy(
        "Network problem while submitting. Keep this page open and try again.",
        "Matsalar network yayin turawa. Bar wannan shafi a bude ka sake gwadawa."
      );
    }
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === "VendorProductFormError") {
      const messages: Record<string, string> = {
        unsupported_image: getCopy("Use a JPEG, PNG, or WebP product image.", "Yi amfani da hoton JPEG, PNG, ko WebP."),
        source_image_too_large: getCopy(
          "Image is too large. Use a product photo under 8MB.",
          "Hoton ya yi girma. Yi amfani da hoton kaya kasa da 8MB."
        ),
        image_read_failed: getCopy("Could not read the image. Choose another photo.", "Ba a iya karanta hoton ba. Zabi wani hoto."),
        image_decode_failed: getCopy("Could not open the image. Choose another JPEG, PNG, or WebP photo.", "Ba a iya bude hoton ba. Zabi wani JPEG, PNG, ko WebP."),
        image_compression_failed: getCopy("Could not optimize the image for upload. Choose another photo.", "Ba a iya rage hoton domin turawa ba. Zabi wani hoto."),
        compressed_image_too_large: getCopy(
          "Image is still too large after optimization. Crop or retake it and try again.",
          "Hoton har yanzu ya yi girma bayan ragewa. Yanke ko sake dauka ka gwada."
        ),
      };
      return messages[error.message] ?? getCopy("Could not prepare the image. Try another photo.", "Ba a iya shirya hoton ba. Gwada wani hoto.");
    }
    return error.message;
  }

  return getCopy("Could not add product. Check the details and try again.", "Ba a iya saka kaya ba. Duba bayanai ka sake gwadawa.");
}

async function handleVendorProductSubmit(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  const form =
    event.target instanceof HTMLFormElement
      ? event.target
      : event.currentTarget instanceof HTMLFormElement
        ? event.currentTarget
        : null;
  const message = document.querySelector<HTMLElement>("#vendorProductMessage");
  if (!form) {
    setVendorProductMessage(message, getCopy("Could not read the product form. Refresh and try again.", "Ba a iya karanta fom din kaya ba. Sabunta shafin ka sake gwadawa."), "error");
    return;
  }
  const user = state.currentUser;
  if (!user || user.role !== "vendor") {
    setVendorProductMessage(message, getCopy("Sign in as a vendor first.", "Shiga a matsayin dan kasuwa tukuna."), "error");
    return;
  }

  const approvalStatus = getEffectiveVendorStatus();
  if (approvalStatus !== "approved") {
    const copy = getVendorGateCopy(approvalStatus, Boolean(user.token));
    setVendorProductMessage(message, copy.body, approvalStatus === "rejected" ? "error" : "info");
    renderVendorProductGate();
    return;
  }
  if (!user.token) {
    const copy = getVendorGateCopy(approvalStatus, false);
    setVendorProductMessage(message, copy.body, "error");
    renderVendorProductGate();
    return;
  }

  const data = new FormData(form);
  const image = data.get("productImage");
  const name = sanitizePlainText(String(data.get("productName") || ""), 90);
  const nameHa = sanitizePlainText(String(data.get("productNameHa") || ""), 90);
  const descriptionEn = sanitizePlainText(String(data.get("descriptionEn") || ""), 240);
  const descriptionHa = sanitizePlainText(String(data.get("descriptionHa") || ""), 240);
  const category = sanitizePlainText(String(data.get("productCategory") || "essentials"), 40);

  // Strip commas, spaces and currency symbols before parsing — iOS formats
  // number inputs as "20,000" which makes type="number" return "" from FormData.
  const rawPriceStr = String(data.get("productValue") ?? "").replace(/[^\d.]/g, "");
  const priceValue = rawPriceStr ? Number(rawPriceStr) : 0;
  const quantityAvailable = Number(data.get("quantityAvailable") || 0);

  if (name.length < 2) {
    setVendorProductMessage(message, getCopy("Enter a product name.", "Shigar da sunan kaya."), "error");
    return;
  }
  if (!VENDOR_PRODUCT_CATEGORIES.has(category)) {
    setVendorProductMessage(message, getCopy("Choose a valid product category.", "Zabi rukuni mai inganci."), "error");
    return;
  }
  if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
    setVendorProductMessage(message, getCopy("Enter a valid stock quantity.", "Shigar da yawan kaya mai inganci."), "error");
    return;
  }

  // Validate image and price with specific messages so the vendor knows which field failed
  if (!(image instanceof File) || !image.name || image.size === 0) {
    setVendorProductMessage(message, getCopy(
      "Please choose a product image (JPEG, PNG, or WebP).",
      "Da fatan za a zaɓi hoton kaya (JPEG, PNG, ko WebP)."
    ), "error");
    return;
  }
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    setVendorProductMessage(message, getCopy(
      "Enter a valid price (numbers only, e.g. 15000).",
      "Shigar da farashi mai inganci (lambobi kawai, misali 15000)."
    ), "error");
    return;
  }

  try {
    setVendorProductFormBusy(form, true, getCopy("Optimizing image...", "Ana rage hoto..."));
    setVendorProductMessage(
      message,
      getCopy("Optimizing the image for fast upload...", "Ana rage hoton domin turawa da sauri..."),
      "info"
    );
    const preparedImage = await prepareVendorProductImage(image);
    const vendor = findVendorByPhone(user.phone);
    const productInput = {
      vendor: vendor?.businessName || user.name,
      vendorPhone: user.phone,
      area: vendor?.area || "Kano",
      name,
      nameHa,
      descriptionEn,
      descriptionHa,
      priceValue,
      quantityAvailable,
      category,
      imageDataUrl: preparedImage.dataUrl,
    };

    setVendorProductFormBusy(form, true, getCopy("Uploading...", "Ana lodawa..."));
    setVendorProductMessage(message, getCopy("Uploading image...", "Ana loda hoto..."), "info");
    const upload = await api.uploadVendorImage({
      fileName: preparedImage.fileName,
      mimeType: preparedImage.mimeType,
      dataUrl: preparedImage.dataUrl,
    });

    setVendorProductFormBusy(form, true, getCopy("Submitting...", "Ana turawa..."));
    setVendorProductMessage(message, getCopy("Submitting product for admin review...", "Ana tura kaya wajen admin..."), "info");
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

    form.reset();
    await Promise.all([refreshLiveCatalog(), refreshLiveVendorDashboard()]).catch(() => undefined);
    const compressionCopy = preparedImage.compressed
      ? getCopy(" Image optimized for upload.", " An rage hoton domin turawa.")
      : "";
    const currentMessage = document.querySelector<HTMLElement>("#vendorProductMessage") ?? message;
    setVendorProductMessage(
      currentMessage,
      getCopy(
        "Product submitted for admin review. It will appear in the catalog after approval.",
        "An tura kaya wajen admin. Zai bayyana a kasuwa bayan amincewa."
      ) + compressionCopy,
      "success"
    );
    showToast({
      message: getCopy("Product sent to admin review.", "An tura kaya wajen admin."),
      type: "success",
      duration: 3000,
    });
    renderVendorProducts();
    renderVendorProductGate();
    renderVendorCommerce();
    renderCatalogPreview();
    renderAdminDashboard();
  } catch (error) {
    const errorCopy = getVendorProductErrorCopy(error);
    setVendorProductMessage(message, errorCopy, "error");
    showToast({ message: errorCopy, type: "error", duration: 4500 });
    if (error instanceof ApiRequestError && error.code === "vendor_not_approved") {
      const application = await fetchLiveVendorApplication().catch(() => null);
      if (application?.status) syncCurrentVendorStatus(application.status);
    }
  } finally {
    setVendorProductFormBusy(form, false);
    renderVendorProductGate();
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
  performSearch(elements.searchInput.value);
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
  const hashRoute = link.hash?.replace("#", "");
  const route = hashRoute && hashRoute.startsWith(`${link.dataset.route}/`) ? hashRoute : link.dataset.route;
  window.location.hash = route;
  setRoute(route);
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
    const productId = card.dataset.productId;
    recordProductView(productId);
    renderAdminDashboard();
    // Navigate to full product page; keep modal for quick-look via explicit trigger
    window.location.hash = `p/${productId}`;
    setRoute(`p/${productId}`);
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
document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>("#customerCartBtn, #customerCartBtnSecondary");
  if (!button) return;
  renderCartPanel();
  openCart();
});
document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>("#customerWishlistBtn");
  if (!button) return;
  openWishlistPanel();
});
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

// Vendor form
elements.vendorForm.addEventListener("submit", handleVendorRequestSubmit);
document.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement | null;
  if (form?.id !== "vendorProductForm") return;
  void handleVendorProductSubmit(event);
});
document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-product-action]");
  if (!button?.closest("#vendorProductsList")) return;
  const productId = button?.dataset.vendorProductId;
  const action = button?.dataset.vendorProductAction;
  if (!productId || (action !== "active" && action !== "out_of_stock" && action !== "taken_down")) return;
  setVendorProductListingStatus(productId, action);
  renderVendorProducts();
  renderVendorProductGate();
  renderVendorCommerce();
  renderCatalogPreview(false);
  renderAdminDashboard();
  showToast({
    message:
      action === "active"
        ? getCopy("Product restored to catalog.", "An mayar da kaya kasuwa.")
        : getCopy("Product removed from active catalog.", "An cire kaya daga kasuwa."),
    type: action === "active" ? "success" : "info",
  });

  if (state.currentUser?.token) {
    api.updateVendorProduct(productId, action).catch((error) => {
      showToast({ message: getVendorProductErrorCopy(error), type: "error", duration: 3500 });
    });
  }
});
document.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-order-ready]");
  if (!button?.closest("#vendorCommerceList")) return;
  const orderId = button?.dataset.vendorOrderReady;
  if (!orderId) return;
  const order = advanceOrderStatus(orderId);
  renderVendorCommerce();
  renderAdminDashboard();
  showToast({
    message: getCopy("Order marked ready for pickup or delivery.", "An nuna oda a shirye domin dauka ko kaiwa."),
    type: "success",
  });
});

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
  renderAdminGate();
  renderOrdersPage();
  void refreshLiveAdminDashboard();
  void refreshLiveVendorDashboard();
  void fetchLiveNotifications();
  const nextRoute = getDefaultRouteForRole();
  window.history.replaceState(null, "", `#${nextRoute}`);
  setRoute(nextRoute);
  renderActiveDashboardRoute(nextRoute);
});
window.addEventListener("kanoMart:signed-out", () => {
  syncRoleNavigation();
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
  const keysToPreserve = new Set(["kanoMart.dataVersion", "kanoMart.language", SIDEBAR_COLLAPSED_KEY]);
  Object.keys(localStorage)
    .filter((k) => !keysToPreserve.has(k))
    .forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("kanoMart.dataVersion", APP_DATA_VERSION);
}

// — Init —
syncCart();
syncWishlistCount();
setLanguage(state.language);
syncUserButton();
renderAdminGate();
renderAdminDashboard();
renderVendorProducts();
renderVendorProductGate();
renderVendorCommerce();
renderOrdersPage();
syncRoleNavigation();
setRoute();
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
syncSidebarLabels();
void refreshLiveCatalog();
void refreshLiveAdminDashboard();
void refreshLiveVendorDashboard();

// Validate stored session token and refresh user data
if (state.currentUser?.token) {
  void refreshSession().then(syncSessionFromApiUser).catch(() => undefined);
}

// Pre-fetch categories from the live API for dynamic catalog support
void fetchLiveCategories();

// Initialise the dedicated login and signup pages
initLoginPage();
initSignupPage();

// Render role dashboards for users already logged in (page reload)
renderCustomerDashboard();
renderOrdersPage();

const scheduleEnhancements =
  "requestIdleCallback" in window
    ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 1200 })
    : (callback: () => void) => window.setTimeout(callback, 350);

scheduleEnhancements(() => {
  import("./frontend-enhancements").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});

// Vercel Analytics — tracks page views and Web Vitals
injectAnalytics();
