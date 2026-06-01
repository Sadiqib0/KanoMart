import type { Language } from "../backend/types";
import { storageKeys } from "../backend/data";
import { state, elements } from "./state";
import { escapeHtml, formatDate, formatPrice, getCopy, sanitizePlainText, setActiveLanguageButtons } from "./utils";
import { getSearchResults, saveSearch } from "./search";
import { renderProductCard, updateResultCopy, renderAdminDashboard } from "./render";
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
  getProductsForVendor,
  moderateProduct,
  saveVendorProduct,
  setVendorProductListingStatus,
} from "../backend/products";
import { getCachedSearchResults, paginateProducts, PRODUCT_PAGE_SIZE, renderProductSkeletons } from "./frontend-data";
import { advanceOrderStatus, getOrders } from "./orders";
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
import { refreshLiveAdminQueues, refreshLiveProducts, refreshLiveVendorProducts } from "./live-api";
import { api } from "./api-client";

const routes = new Set(["home", "customer", "catalog", "payments", "vendor", "orders", "admin"]);
const SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";

function getCurrentRoute(): string {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  return routes.has(raw) ? raw : "home";
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
  if (route === "admin") return role === "admin";
  if (route === "customer") return role === "customer";
  if (route === "orders") return role === "customer";
  return true;
}

function setRoute(route = getCurrentRoute()): void {
  let nextRoute = routes.has(route) ? route : "home";
  if (!canAccessRoute(nextRoute)) {
    nextRoute = getDefaultRouteForRole();
    if (window.location.hash.replace("#", "") !== nextRoute) {
      window.history.replaceState(null, "", `#${nextRoute}`);
    }
  }
  document.querySelectorAll<HTMLElement>("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === nextRoute;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll<HTMLElement>("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === nextRoute;
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
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
    await refreshLiveAdminQueues();
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

async function refreshLiveVendorDashboard(): Promise<void> {
  if (state.currentUser?.role !== "vendor" || !state.currentUser.token) return;
  try {
    await refreshLiveVendorProducts();
    renderVendorProducts();
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

  if (state.lastQuery) {
    state.lastResults = getSearchResults(state.lastQuery);
    updateResultCopy(state.lastQuery, state.lastResults);
    renderProductResults();
  } else {
    renderCatalogPreview();
  }

  syncUserButton();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminDashboard();
}

// — Vendor form —

function handleVendorRequestSubmit(event: SubmitEvent): void {
  event.preventDefault();
  const formData = new FormData(elements.vendorForm);
  const vendorRequest = persistVendorRequest({
    businessName: sanitizePlainText(String(formData.get("businessName") || ""), 80),
    phone: sanitizePlainText(String(formData.get("phone") || ""), 24),
    area: sanitizePlainText(String(formData.get("area") || ""), 80),
    category: sanitizePlainText(String(formData.get("category") || ""), 40),
  });
  createNotification({
    audience: "admin",
    title: "New vendor application",
    message: `${vendorRequest.businessName} is awaiting approval.`,
    type: "vendor",
  });
  if (state.currentUser && normalizePhone(state.currentUser.phone) === normalizePhone(vendorRequest.phone)) {
    saveSession(createSessionForPhone(vendorRequest.phone));
  }
  elements.vendorForm.reset();
  elements.vendorMessage.textContent = getCopy(
    "Vendor request saved for admin review.",
    "An ajiye bukatar rajista domin admin ya duba."
  );
  renderAdminDashboard();
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

function renderVendorProducts(): void {
  const list = document.querySelector<HTMLElement>("#vendorProductsList");
  if (!list) return;
  const user = state.currentUser;
  if (!user || user.role !== "vendor") {
    list.innerHTML = "";
    return;
  }

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
  const priceValue = Number(data.get("productValue") || 0);
  if (!(image instanceof File) || !image.name || priceValue <= 0) {
    if (message) message.textContent = getCopy("Add a valid product image and price.", "Saka hoton kaya da farashi mai kyau.");
    return;
  }

  try {
    const imageDataUrl = await readImageAsDataUrl(image);
    const vendor = findVendorByPhone(user.phone);
    const productInput = {
      vendor: vendor?.businessName || user.name,
      vendorPhone: user.phone,
      area: vendor?.area || "Kano",
      name: String(data.get("productName") || ""),
      nameHa: String(data.get("productNameHa") || ""),
      descriptionEn: String(data.get("descriptionEn") || ""),
      descriptionHa: String(data.get("descriptionHa") || ""),
      priceValue,
      quantityAvailable: Number(data.get("quantityAvailable") || 0),
      category: String(data.get("productCategory") || "essentials"),
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
  performSearch(elements.searchInput.value);
});

elements.quickSearches.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLElement>("[data-query-en][data-query-ha]");
  if (!button) return;
  const query = button.dataset[state.language === "ha" ? "queryHa" : "queryEn"] || "";
  elements.searchInput.value = query;
  if (getCurrentRoute() !== "catalog") {
    window.location.hash = "catalog";
    setRoute("catalog");
  }
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
document.querySelector<HTMLFormElement>("#vendorProductForm")?.addEventListener("submit", (event) => {
  void handleVendorProductSubmit(event);
});
document.querySelector<HTMLElement>("#vendorProductsList")?.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-product-action]");
  const productId = button?.dataset.vendorProductId;
  const action = button?.dataset.vendorProductAction;
  if (!productId || (action !== "active" && action !== "out_of_stock" && action !== "taken_down")) return;
  setVendorProductListingStatus(productId, action);
  renderVendorProducts();
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
});
document.querySelector<HTMLElement>("#vendorCommerceList")?.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-vendor-order-ready]");
  const orderId = button?.dataset.vendorOrderReady;
  if (!orderId) return;
  const order = advanceOrderStatus(orderId);
  if (order?.status === "preparing_order") advanceOrderStatus(orderId);
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
    createPromotion({
      title: sanitizePlainText(String(data.get("title") || ""), 80),
      type,
      discountPercent: Number(data.get("discountPercent") || 0) || undefined,
      code: type === "discount_code" ? target : undefined,
      vendor: type === "featured_vendor" ? target : undefined,
      productId: type === "featured_product" ? target : undefined,
      category: type === "seasonal_campaign" || type === "flash_sale" ? target.toLowerCase() : undefined,
    });
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
  void refreshLiveAdminDashboard();
  const nextRoute = getDefaultRouteForRole();
  window.history.replaceState(null, "", `#${nextRoute}`);
  setRoute(nextRoute);
});
window.addEventListener("kanoMart:signed-out", () => {
  syncRoleNavigation();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  setRoute("home");
});

// Global Escape key closes cart
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
  if (e.key === "Escape") closeSidebar();
});

// — Init —
syncCart();
syncWishlistCount();
setLanguage(state.language);
syncUserButton();
renderAdminGate();
renderAdminDashboard();
renderVendorProducts();
renderVendorCommerce();
syncRoleNavigation();
setRoute();
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
syncSidebarLabels();
void refreshLiveCatalog();
void refreshLiveAdminDashboard();
void refreshLiveVendorDashboard();

const scheduleEnhancements =
  "requestIdleCallback" in window
    ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 1200 })
    : (callback: () => void) => window.setTimeout(callback, 350);

scheduleEnhancements(() => {
  import("./frontend-enhancements").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});
