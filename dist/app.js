import {
  createId,
  createSessionForPhone,
  demoOrders,
  elements,
  escapeHtml,
  findUserProfileByEmail,
  findUserProfileByPhone,
  findVendorByPhone,
  formatDate,
  formatPrice,
  getCopy,
  getLocalizedValue,
  getStoredList,
  getUserProfiles,
  getVendorRequests,
  getVendorStatusCounts,
  groupByValue,
  isAdminPhone,
  localizeCategory,
  normalize,
  normalizePhone,
  orderStatusLabels,
  parsePrice,
  products,
  renderStars,
  requiresSignup,
  reviewVendorRequest,
  sanitizePlainText,
  saveUserProfile,
  seedReviews,
  setActiveLanguageButtons,
  setLiveVendorRequests,
  setStoredList,
  sortEntries,
  state,
  storageKeys,
  updateUserProfile,
  vendorProfiles,
  verifyPassword
} from "./chunk-V6VR6KCH.js";

// src/backend/products.ts
function getVendorProducts() {
  return getStoredList(storageKeys.vendorProducts).map((product) => ({
    ...product,
    listingStatus: product.listingStatus ?? "active"
  }));
}
function getLiveProducts() {
  return getStoredList(storageKeys.liveProducts).map((product) => ({
    ...product,
    listingStatus: product.listingStatus ?? "active"
  }));
}
function setLiveProducts(nextProducts) {
  setStoredList(storageKeys.liveProducts, nextProducts);
}
function setLiveVendorProducts(nextProducts) {
  setStoredList(storageKeys.vendorProducts, nextProducts);
}
function getAllProducts() {
  const seen = /* @__PURE__ */ new Set();
  return [...products, ...getLiveProducts(), ...getVendorProducts()].filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}
function getProductModerationRecords() {
  return getStoredList(storageKeys.productModeration);
}
function getProductStatus(productId) {
  const record = getProductModerationRecords().find((r) => r.productId === productId);
  if (record) return record.status;
  const product = [...getLiveProducts(), ...getVendorProducts()].find((p) => p.id === productId);
  if (product?.moderationStatus) return product.moderationStatus;
  return "approved";
}
function isProductApproved(productId) {
  return getProductStatus(productId) === "approved";
}
function getCatalogProducts() {
  return getAllProducts().filter(
    (product) => isProductApproved(product.id) && (product.listingStatus ?? "active") === "active"
  );
}
function getProductById(productId, options = {}) {
  const product = getAllProducts().find((item) => item.id === productId);
  if (!product) return void 0;
  if (options.includeModerated) return product;
  return isProductApproved(productId) && (product.listingStatus ?? "active") === "active" ? product : void 0;
}
function getProductsForVendor(vendorPhone) {
  return getVendorProducts().filter((product) => product.vendorPhone === vendorPhone);
}
function setVendorProductListingStatus(productId, listingStatus) {
  const vendorProducts = getVendorProducts();
  const product = vendorProducts.find((item) => item.id === productId);
  if (!product) return null;
  product.listingStatus = listingStatus;
  product.availability = listingStatus === "active" ? { en: "Available now", ha: "Akwai yanzu" } : listingStatus === "out_of_stock" ? { en: "Out of stock", ha: "Ya kare" } : { en: "Taken down", ha: "An cire daga kasuwa" };
  setStoredList(storageKeys.vendorProducts, vendorProducts);
  return product;
}
function moderateProduct(productId, status, reviewNote = "") {
  if (!getAllProducts().some((product) => product.id === productId)) return null;
  const records = getProductModerationRecords();
  const nextRecord = {
    productId,
    status,
    reviewedAt: (/* @__PURE__ */ new Date()).toISOString(),
    reviewNote: reviewNote.trim()
  };
  const nextRecords = [nextRecord, ...records.filter((record) => record.productId !== productId)];
  setStoredList(storageKeys.productModeration, nextRecords);
  const vendorProducts = getVendorProducts();
  const storedProduct = vendorProducts.find((p) => p.id === productId);
  if (storedProduct) {
    storedProduct.moderationStatus = status;
    setStoredList(storageKeys.vendorProducts, vendorProducts);
  }
  return nextRecord;
}
function getProductStatusCounts() {
  return getAllProducts().reduce(
    (counts, product) => {
      counts[getProductStatus(product.id)] += 1;
      return counts;
    },
    { pending: 0, approved: 0, hidden: 0, rejected: 0 }
  );
}

// src/frontend/search.ts
function getProductText(product) {
  return normalize(
    [
      product.name.en,
      product.name.ha,
      product.category.en,
      product.category.ha,
      product.subcategory.en,
      product.subcategory.ha,
      product.vendor,
      product.area,
      ...product.tags
    ].join(" ")
  );
}
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from(
    { length: m + 1 },
    (_, i) => Array.from({ length: n + 1 }, (_2, j) => i === 0 ? j : j === 0 ? i : 0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}
function fuzzyMatchesTerm(text, term) {
  if (text.includes(term)) return true;
  const len = term.length;
  if (len < 4) return false;
  const maxDistance = len <= 6 ? 1 : 2;
  const words = text.split(" ");
  return words.some((word) => {
    if (Math.abs(word.length - len) > maxDistance) return false;
    return levenshtein(word, term) <= maxDistance;
  });
}
function getSearchResults(query) {
  const cleanQuery = normalize(query);
  const terms = cleanQuery.split(" ").filter(Boolean);
  return getCatalogProducts().filter((product) => {
    const text = getProductText(product);
    if (text.includes(cleanQuery)) return true;
    return terms.every((term) => fuzzyMatchesTerm(text, term));
  });
}
var demandDictionary = [
  { category: "food", terms: ["food", "abinci", "rice", "shinkafa", "tuwo", "snack", "groceries"] },
  { category: "fashion", terms: ["fashion", "kaya", "yaduka", "shoe", "takalma", "turare", "perfume"] },
  { category: "children", terms: ["children", "yara", "school", "makaranta", "book", "littafi", "bag"] }
];
function inferDemandCategory(query, results) {
  if (results.length > 0) return results[0].category.en.toLowerCase();
  const value = normalize(query);
  const match = demandDictionary.find((entry) => entry.terms.some((term) => value.includes(term)));
  return match ? match.category : "unmatched demand";
}
function saveSearch(query, results) {
  const history = getStoredList(storageKeys.searches);
  history.unshift({
    id: createId(),
    query,
    language: state.language,
    resultCount: results.length,
    category: inferDemandCategory(query, results),
    status: results.length > 0 ? "matched" : "saved demand",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  setStoredList(storageKeys.searches, history.slice(0, 100));
}

// src/frontend/toast.ts
function showToast({ message, type = "success", duration = 2e3 }) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("toast-visible"));
  });
  window.setTimeout(() => {
    toast.classList.remove("toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

// src/frontend/api-client.ts
var DEFAULT_API_BASE_URL = "/api";
var API_TOKEN_KEY = "kanoMart.apiToken";
var DEFAULT_REQUEST_TIMEOUT_MS = 2e4;
function getApiBaseUrl() {
  const configured = globalThis.localStorage?.getItem("kanoMart.apiBaseUrl")?.trim();
  return configured || DEFAULT_API_BASE_URL;
}
function getApiToken() {
  return globalThis.localStorage?.getItem(API_TOKEN_KEY) ?? "";
}
function saveApiToken(token) {
  if (token) globalThis.localStorage?.setItem(API_TOKEN_KEY, token);
}
function clearApiToken() {
  globalThis.localStorage?.removeItem(API_TOKEN_KEY);
}
var ApiRequestError = class extends Error {
  constructor(message, options) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options.status;
    this.code = options.code ?? "api_request_failed";
    this.details = options.details;
  }
};
async function apiRequest(path, options = {}) {
  const token = options.token ?? getApiToken();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? (options.body ? "POST" : "GET"),
      credentials: "include",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...token ? { authorization: `Bearer ${token}` } : {}
      },
      body: options.body ? JSON.stringify(options.body) : void 0
    });
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === "AbortError";
    throw new ApiRequestError(
      isAbort ? "Request timed out. Check your connection and try again." : "Network request failed. Check your connection and try again.",
      { status: 0, code: isAbort ? "request_timeout" : "network_error" }
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
  const raw = await response.text();
  let payload = {};
  if (raw.trim()) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new ApiRequestError(response.ok ? "Invalid API response." : "API request failed.", {
        status: response.status,
        code: "invalid_api_response"
      });
    }
  }
  if (!response.ok) {
    throw new ApiRequestError(payload.error?.message ?? "API request failed.", {
      status: response.status,
      code: payload.error?.code,
      details: payload.error?.details
    });
  }
  return payload;
}
var api = {
  // Health
  health: () => apiRequest("/health"),
  // Auth
  me: () => apiRequest("/me"),
  updateMe: (body) => apiRequest("/me", { method: "PATCH", body }),
  login: (identifier, password) => apiRequest("/auth/login", { body: { identifier, password } }),
  register: (body) => apiRequest("/auth/register", { body }),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
  // Catalog
  categories: () => apiRequest("/categories"),
  products: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.category) qs.set("category", params.category);
    const query = qs.toString();
    return apiRequest(`/products${query ? `?${query}` : ""}`);
  },
  product: (id) => apiRequest(`/products/${encodeURIComponent(id)}`),
  productReviews: (productId) => apiRequest(`/products/${encodeURIComponent(productId)}/reviews`),
  // Notifications
  notifications: () => apiRequest("/notifications"),
  markNotificationRead: (id) => apiRequest(`/notifications/${encodeURIComponent(id)}`, { method: "PATCH", body: {} }),
  // Wishlist
  wishlist: () => apiRequest("/wishlist"),
  addToWishlist: (productId) => apiRequest("/wishlist", { body: { productId } }),
  removeFromWishlist: (productId) => apiRequest(`/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" }),
  // Cart
  cart: () => apiRequest("/cart"),
  addCartItem: (productId, quantity) => apiRequest("/cart/items", { body: { productId, quantity } }),
  updateCartItem: (productId, quantity) => apiRequest(`/cart/items/${encodeURIComponent(productId)}`, {
    method: "PATCH",
    body: { quantity }
  }),
  removeCartItem: (productId) => apiRequest(`/cart/items/${encodeURIComponent(productId)}`, { method: "DELETE" }),
  // Checkout & Orders
  checkout: (body) => apiRequest("/checkout", { body }),
  orders: () => apiRequest("/orders"),
  // Reviews
  createReview: (body) => apiRequest("/reviews", { body }),
  // Vendor
  vendorApplication: () => apiRequest("/vendor/application"),
  vendorProducts: () => apiRequest("/vendor/products"),
  createVendorProduct: (body) => apiRequest("/vendor/products", { body }),
  updateVendorProduct: (id, listingStatus) => apiRequest(`/vendor/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { listingStatus }
  }),
  uploadVendorImage: (body) => apiRequest("/vendor/uploads", { body }),
  vendorOrders: () => apiRequest("/vendor/orders"),
  vendorReviews: () => apiRequest("/vendor/reviews"),
  vendorWallet: () => apiRequest("/vendor/wallet"),
  requestPayout: (body) => apiRequest("/vendor/payouts", { body }),
  // Admin — Users
  adminUsers: () => apiRequest("/admin/users"),
  // Admin — Categories
  adminCreateCategory: (body) => apiRequest("/admin/categories", { body }),
  // Admin — Vendor applications
  adminVendorApplications: (status) => apiRequest(
    `/admin/vendor-applications${status ? `?status=${encodeURIComponent(status)}` : ""}`
  ),
  updateVendorApplication: (id, body) => apiRequest(`/admin/vendor-applications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  }),
  // Admin — Products
  adminProducts: (status) => apiRequest(`/admin/products${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  updateAdminProduct: (id, body) => apiRequest(`/admin/products/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  // Admin — Orders
  adminOrders: () => apiRequest("/admin/orders"),
  updateAdminOrder: (id, body) => apiRequest(`/admin/orders/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  // Admin — Payments
  adminPayments: () => apiRequest("/admin/payments"),
  updateAdminPayment: (id, body) => apiRequest(`/admin/payments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body
  }),
  // Admin — Reviews
  adminReviews: () => apiRequest("/admin/reviews"),
  updateAdminReview: (id, body) => apiRequest(`/admin/reviews/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  // Admin — Promotions
  adminPromotions: () => apiRequest("/admin/promotions"),
  createAdminPromotion: (body) => apiRequest("/admin/promotions", { body }),
  updateAdminPromotion: (id, body) => apiRequest(`/admin/promotions/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  // Admin — Payouts
  adminPayouts: () => apiRequest("/admin/payouts"),
  updateAdminPayout: (id, body) => apiRequest(`/admin/payouts/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  // Admin — Analytics
  adminAnalytics: () => apiRequest("/admin/analytics")
};

// src/frontend/wishlist.ts
function getWishlist() {
  return getStoredList(storageKeys.wishlist);
}
function isWishlisted2(productId) {
  return getWishlist().includes(productId);
}
function toggleWishlist(productId, productName) {
  const list = getWishlist();
  const idx = list.indexOf(productId);
  if (idx === -1) {
    list.push(productId);
    showToast({ message: getCopy(`Saved: ${productName}`, `An ajiye: ${productName}`) });
    if (state.currentUser?.token) {
      api.addToWishlist(productId).catch(() => void 0);
    }
  } else {
    list.splice(idx, 1);
    showToast({
      message: getCopy("Removed from wishlist", "An cire daga jerin da aka ajiye"),
      type: "info"
    });
    if (state.currentUser?.token) {
      api.removeFromWishlist(productId).catch(() => void 0);
    }
  }
  setStoredList(storageKeys.wishlist, list);
  syncWishlistCount();
  syncWishlistButtons(productId);
}
function syncWishlistCount() {
  const count = getWishlist().length;
  elements.wishlistCountEl.textContent = String(count);
  elements.wishlistCountEl.hidden = count === 0;
  document.querySelector("#sidebarWishlistCount")?.replaceChildren(String(count));
}
function syncWishlistButtons(productId) {
  const list = getWishlist();
  const selector = productId ? `[data-wishlist="${productId}"]` : "[data-wishlist]";
  document.querySelectorAll(selector).forEach((btn) => {
    const id = btn.dataset.wishlist;
    const saved = list.includes(id);
    btn.classList.toggle("is-wishlisted", saved);
    btn.setAttribute(
      "aria-label",
      saved ? getCopy("Remove from wishlist", "Cire daga jerin da aka ajiye") : getCopy("Save to wishlist", "Ajiye zuwa jerin kaya")
    );
    btn.setAttribute("aria-pressed", String(saved));
  });
}
function syncAllWishlistButtons() {
  syncWishlistButtons();
}
function openWishlistPanel() {
  document.querySelector("#wishlistModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "wishlistModal";
  modal.className = "modal-backdrop modal-visible";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "wishlistTitle");
  const wishlist = getWishlist();
  const rows = wishlist.map((id) => getProductById(id, { includeModerated: true })).filter(Boolean).map((product) => {
    const item = product;
    return `
        <div class="wishlist-row">
          <div>
            <strong>${escapeHtml(item.name[state.language])}</strong>
            <span>${escapeHtml(item.vendor)} - ${escapeHtml(item.price)}</span>
          </div>
          <button type="button" data-wishlist-remove="${escapeHtml(item.id)}">${getCopy("Remove", "Cire")}</button>
        </div>
      `;
  }).join("");
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="wishlistTitle">${getCopy("Saved products", "Kayayyakin da aka ajiye")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div class="wishlist-panel-body">
        ${rows || `<p class="muted">${getCopy("No saved products yet.", "Babu kaya da aka ajiye tukuna.")}</p>`}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector(".modal-close")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
    const button = event.target?.closest("[data-wishlist-remove]");
    if (!button?.dataset.wishlistRemove) return;
    const product = getProductById(button.dataset.wishlistRemove, { includeModerated: true });
    toggleWishlist(button.dataset.wishlistRemove, product?.name[state.language] ?? button.dataset.wishlistRemove);
    openWishlistPanel();
  });
}

// src/backend/notifications.ts
function getNotifications() {
  return getStoredList(storageKeys.notifications);
}
function createNotification(input) {
  const notification = {
    id: createId(),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    ...input
  };
  setStoredList(storageKeys.notifications, [notification, ...getNotifications()].slice(0, 100));
  return notification;
}
function notifyMany(items) {
  return items.map(createNotification);
}
function getNotificationsFor(audience, recipient) {
  return getNotifications().filter((notification) => {
    if (notification.audience !== audience) return false;
    return !notification.recipient || !recipient || notification.recipient === recipient;
  });
}

// src/frontend/reviews.ts
function getAllReviews() {
  const stored = getStoredList(storageKeys.reviews);
  const storedIds = new Set(stored.map((r) => r.id));
  const seeds = seedReviews.filter((r) => !storedIds.has(r.id));
  return [...stored, ...seeds];
}
function getProductReviews(productId) {
  return getAllReviews().filter((r) => !r.hidden).filter((r) => r.productId === productId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
function getAverageRating(productId) {
  const reviews = getProductReviews(productId);
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}
function hideReview(reviewId, adminNote = "Removed by admin") {
  const stored = getStoredList(storageKeys.reviews);
  const seeded = seedReviews.find((review2) => review2.id === reviewId);
  const review = stored.find((item) => item.id === reviewId) || (seeded ? { ...seeded } : null);
  if (!review) return null;
  review.hidden = true;
  review.adminNote = adminNote;
  setStoredList(storageKeys.reviews, [review, ...stored.filter((item) => item.id !== reviewId)]);
  return review;
}

// src/backend/marketplace-settings.ts
var vendorSubscriptionPlans = [
  {
    id: "free",
    name: "Free",
    monthlyFee: 0,
    productLimit: 8,
    featuredPlacement: false,
    commissionRate: 0.12
  },
  {
    id: "standard",
    name: "Standard",
    monthlyFee: 5e3,
    productLimit: 40,
    featuredPlacement: false,
    commissionRate: 0.1
  },
  {
    id: "premium",
    name: "Premium",
    monthlyFee: 15e3,
    productLimit: 120,
    featuredPlacement: true,
    commissionRate: 0.08
  }
];
var defaultCommissionSettings = {
  defaultRate: 0.1,
  perVendorRates: {},
  updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
};
function getCommissionSettings() {
  try {
    const raw = localStorage.getItem(storageKeys.commissionSettings);
    return raw ? { ...defaultCommissionSettings, ...JSON.parse(raw) } : defaultCommissionSettings;
  } catch {
    return defaultCommissionSettings;
  }
}
function saveCommissionSettings(input) {
  const settings = {
    ...getCommissionSettings(),
    ...input,
    defaultRate: Math.max(0, Math.min(0.5, input.defaultRate ?? getCommissionSettings().defaultRate)),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  localStorage.setItem(storageKeys.commissionSettings, JSON.stringify(settings));
  return settings;
}
function getVendorSubscriptions() {
  return getStoredList(storageKeys.vendorSubscriptions);
}
function getVendorSubscription(vendor) {
  return getVendorSubscriptions().find((subscription) => subscription.vendor === vendor) ?? {
    vendor,
    planId: "free",
    status: "active",
    updatedAt: (/* @__PURE__ */ new Date(0)).toISOString()
  };
}
function setVendorSubscription(vendor, planId) {
  const next = {
    vendor,
    planId,
    status: "active",
    paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  setStoredList(storageKeys.vendorSubscriptions, [
    next,
    ...getVendorSubscriptions().filter((subscription) => subscription.vendor !== vendor)
  ]);
  return next;
}
function getVendorPlan(vendor) {
  const subscription = getVendorSubscription(vendor);
  return vendorSubscriptionPlans.find((plan) => plan.id === subscription.planId) ?? vendorSubscriptionPlans[0];
}
function getCommissionRateForVendor(vendor) {
  const settings = getCommissionSettings();
  const customRate = settings.perVendorRates[vendor];
  if (typeof customRate === "number") return customRate;
  return getVendorPlan(vendor).commissionRate || settings.defaultRate;
}
function getVendorSubscriptionRevenue() {
  return getVendorSubscriptions().reduce((total, subscription) => {
    if (subscription.status !== "active") return total;
    const plan = vendorSubscriptionPlans.find((item) => item.id === subscription.planId);
    return total + (plan?.monthlyFee ?? 0);
  }, 0);
}

// src/backend/wallet.ts
var PLATFORM_COMMISSION_RATE = 0.1;
function calculateCommission(amount, rate = PLATFORM_COMMISSION_RATE) {
  return Math.round(amount * rate);
}
function getWalletLedger() {
  return getStoredList(storageKeys.walletLedger);
}
function settleDeliveredOrder(orderId) {
  const ledger = getWalletLedger();
  let changed = false;
  const availableAt = (/* @__PURE__ */ new Date()).toISOString();
  const updated = ledger.map((entry) => {
    if (entry.orderId !== orderId || entry.type !== "vendor_pending_credit" || entry.status === "available") {
      return entry;
    }
    changed = true;
    return {
      ...entry,
      status: "available",
      availableAt
    };
  });
  if (changed) {
    setStoredList(storageKeys.walletLedger, updated);
  }
  return updated.filter((entry) => entry.orderId === orderId);
}
function createLedgerEntriesForPaidOrder(order) {
  const existing = getWalletLedger();
  if (existing.some((entry) => entry.orderId === order.id)) {
    return existing.filter((entry) => entry.orderId === order.id);
  }
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const entries = order.items.flatMap((item) => [
    {
      id: createId(),
      orderId: order.id,
      productId: item.productId,
      vendor: item.vendor,
      type: "vendor_pending_credit",
      status: "pending",
      amount: item.vendorPayout,
      createdAt
    },
    {
      id: createId(),
      orderId: order.id,
      productId: item.productId,
      vendor: item.vendor,
      type: "platform_commission",
      status: "available",
      amount: item.commissionAmount,
      createdAt
    }
  ]);
  setStoredList(storageKeys.walletLedger, [...entries, ...existing]);
  return entries;
}
function getVendorWalletSummaries() {
  const summaries = /* @__PURE__ */ new Map();
  getWalletLedger().forEach((entry) => {
    const summary = summaries.get(entry.vendor) ?? {
      vendor: entry.vendor,
      pendingBalance: 0,
      availableBalance: 0,
      totalCommission: 0
    };
    if (entry.type === "vendor_pending_credit") {
      if (entry.status === "available") {
        summary.availableBalance += entry.amount;
      } else {
        summary.pendingBalance += entry.amount;
      }
    }
    if (entry.type === "platform_commission") {
      summary.totalCommission += entry.amount;
    }
    if (entry.type === "vendor_withdrawal_debit") {
      summary.availableBalance -= entry.amount;
    }
    summaries.set(entry.vendor, summary);
  });
  return [...summaries.values()].sort(
    (a, b) => b.pendingBalance + b.availableBalance - (a.pendingBalance + a.availableBalance) || a.vendor.localeCompare(b.vendor)
  );
}
function getPlatformCommissionTotal() {
  return getWalletLedger().filter((entry) => entry.type === "platform_commission").reduce((total, entry) => total + entry.amount, 0);
}
function getPlatformRevenueTotal() {
  return getPlatformCommissionTotal() + getVendorSubscriptionRevenue();
}
function getVendorAvailableBalance(vendor) {
  return getVendorWalletSummaries().find((summary) => summary.vendor === vendor)?.availableBalance ?? 0;
}
function recordWithdrawalDebit(withdrawal) {
  const existing = getWalletLedger().find(
    (entry2) => entry2.orderId === withdrawal.id && entry2.type === "vendor_withdrawal_debit"
  );
  if (existing) return existing;
  const entry = {
    id: createId(),
    orderId: withdrawal.id,
    productId: "withdrawal",
    vendor: withdrawal.vendor,
    type: "vendor_withdrawal_debit",
    status: "available",
    amount: withdrawal.amount,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    availableAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  setStoredList(storageKeys.walletLedger, [entry, ...getWalletLedger()]);
  return entry;
}

// src/backend/payments.ts
function getPayments() {
  return getStoredList(storageKeys.payments);
}
function getPaymentStatusForMethod(method) {
  return method === "card" || method === "ussd" || method === "wallet" ? "paid" : "pending";
}
function getPaymentGatewayForMethod(method) {
  if (method === "card" || method === "ussd" || method === "wallet") return "prototype";
  return "manual";
}
function createPaymentForOrder(order) {
  const existing = getPayments().find((payment2) => payment2.orderId === order.id);
  if (existing) return existing;
  const status = getPaymentStatusForMethod(order.paymentMethod);
  const payment = {
    id: createId(),
    orderId: order.id,
    reference: order.paymentReference,
    method: order.paymentMethod,
    amount: order.subtotal,
    currency: "NGN",
    status,
    gateway: getPaymentGatewayForMethod(order.paymentMethod),
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    verifiedAt: status === "paid" ? (/* @__PURE__ */ new Date()).toISOString() : void 0
  };
  setStoredList(storageKeys.payments, [payment, ...getPayments()]);
  if (payment.status === "paid") {
    createLedgerEntriesForPaidOrder(order);
  }
  return payment;
}
function syncOrderPaymentStatus(orderId, status) {
  const orders = getStoredList(storageKeys.orders);
  const order = orders.find((item) => item.id === orderId);
  if (!order) return null;
  order.paymentStatus = status;
  order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  setStoredList(storageKeys.orders, orders);
  return order;
}
function updatePaymentStatus(paymentId, status, adminNote) {
  const payments = getPayments();
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) return null;
  payment.status = status;
  payment.adminNote = adminNote;
  if (status === "paid") payment.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (status === "failed") payment.failedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (status === "refunded") payment.refundedAt = (/* @__PURE__ */ new Date()).toISOString();
  setStoredList(storageKeys.payments, payments);
  const order = syncOrderPaymentStatus(payment.orderId, status);
  if (order && status === "paid") {
    createLedgerEntriesForPaidOrder(order);
    notifyMany([
      {
        audience: "customer",
        recipient: order.customerPhone,
        title: "Payment successful",
        message: `Payment confirmed for ${order.id}.`,
        type: "payment",
        orderId: order.id
      },
      ...Array.from(new Set(order.items.map((item) => item.vendor))).map((vendor) => ({
        audience: "vendor",
        recipient: vendor,
        title: "Payment confirmed",
        message: `Payment confirmed for order ${order.id}.`,
        type: "payment",
        orderId: order.id
      }))
    ]);
  }
  if (order && status === "failed") {
    notifyMany([
      {
        audience: "customer",
        recipient: order.customerPhone,
        title: "Payment failed",
        message: `Payment failed for ${order.id}.`,
        type: "payment",
        orderId: order.id
      },
      {
        audience: "admin",
        title: "Failed payment",
        message: `Payment ${payment.reference} failed.`,
        type: "payment",
        orderId: order.id
      }
    ]);
  }
  if (order && status === "refunded") {
    createNotification({
      audience: "customer",
      recipient: order.customerPhone,
      title: "Payment refunded",
      message: `Refund processed for ${order.id}.`,
      type: "payment",
      orderId: order.id
    });
  }
  return payment;
}
function confirmPayment(paymentId, adminNote = "Confirmed manually by admin") {
  return updatePaymentStatus(paymentId, "paid", adminNote);
}
function failPayment(paymentId, adminNote = "Marked failed by admin") {
  return updatePaymentStatus(paymentId, "failed", adminNote);
}
function refundPayment(paymentId, adminNote = "Refunded by admin") {
  return updatePaymentStatus(paymentId, "refunded", adminNote);
}
function getPaymentSummary() {
  return getPayments().reduce(
    (summary, payment) => {
      if (payment.status === "paid") {
        summary.paidAmount += payment.amount;
        summary.paidCount += 1;
      } else if (payment.status === "pending") {
        summary.pendingAmount += payment.amount;
        summary.pendingCount += 1;
      } else if (payment.status === "failed") {
        summary.failedAmount += payment.amount;
        summary.failedCount += 1;
      } else {
        summary.refundedAmount += payment.amount;
        summary.refundedCount += 1;
      }
      return summary;
    },
    {
      paidAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      refundedAmount: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0
    }
  );
}

// src/frontend/cart.ts
function getCartItems() {
  return getStoredList(storageKeys.cart);
}
function getCartProduct(productId) {
  return getProductById(productId);
}
function getCartCount() {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}
function getCartSubtotal() {
  return getCartItems().reduce((sum, item) => {
    const product = getCartProduct(item.productId);
    return sum + (product ? parsePrice(product.price) * item.quantity : 0);
  }, 0);
}
function addToCart(productId) {
  const product = getCartProduct(productId);
  if (!product) {
    showToast({
      message: getCopy("This product is not available for purchase.", "Wannan kaya ba ya samuwa yanzu."),
      type: "error"
    });
    return;
  }
  const items = getCartItems();
  const existing = items.find((i) => i.productId === productId);
  const newQuantity = (existing?.quantity ?? 0) + 1;
  if (existing) {
    existing.quantity = newQuantity;
  } else {
    items.push({ productId, quantity: 1, addedAt: (/* @__PURE__ */ new Date()).toISOString() });
  }
  setStoredList(storageKeys.cart, items);
  syncCart();
  if (state.currentUser?.token) {
    api.addCartItem(productId, newQuantity).catch(() => void 0);
  }
  showToast({ message: getCopy(`Added: ${product.name.en}`, `An saka: ${product.name.ha}`) });
}
function updateQuantity(productId, delta) {
  const items = getCartItems();
  const item = items.find((i) => i.productId === productId);
  if (!item) return;
  item.quantity = Math.max(0, item.quantity + delta);
  const updated = items.filter((i) => i.quantity > 0);
  setStoredList(storageKeys.cart, updated);
  syncCart();
  if (state.currentUser?.token) {
    if (item.quantity > 0) {
      api.updateCartItem(productId, item.quantity).catch(() => void 0);
    } else {
      api.removeCartItem(productId).catch(() => void 0);
    }
  }
}
function removeFromCart(productId) {
  const items = getCartItems().filter((i) => i.productId !== productId);
  setStoredList(storageKeys.cart, items);
  syncCart();
  if (state.currentUser?.token) {
    api.removeCartItem(productId).catch(() => void 0);
  }
}
function clearCart() {
  setStoredList(storageKeys.cart, []);
  syncCart();
}
function syncCart() {
  const count = getCartCount();
  state.cartCount = count;
  elements.cartCountEl.textContent = String(count);
  document.querySelector("#sidebarCartCount")?.replaceChildren(String(count));
  renderCartPanel();
}
function openCart() {
  elements.cartPanel.hidden = false;
  elements.cartOverlay.hidden = false;
  elements.cartPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  elements.cartPanel.querySelector(".cart-close")?.focus();
}
function closeCart() {
  elements.cartPanel.hidden = true;
  elements.cartOverlay.hidden = true;
  elements.cartPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}
function renderCartPanel() {
  const items = getCartItems();
  const subtotal = getCartSubtotal();
  elements.cartSubtotal.textContent = formatPrice(subtotal);
  elements.checkoutButton.disabled = items.length === 0;
  if (items.length === 0) {
    elements.cartEmptyState.hidden = false;
    elements.cartItemsEl.innerHTML = "";
    return;
  }
  elements.cartEmptyState.hidden = true;
  elements.cartItemsEl.innerHTML = items.map((item) => {
    const product = getCartProduct(item.productId);
    if (!product) return "";
    const name2 = product.name[state.language];
    const lineTotal = formatPrice(parsePrice(product.price) * item.quantity);
    return `
        <div class="cart-item" data-product-id="${escapeHtml(item.productId)}">
          <div class="cart-item-thumb" style="--accent: ${product.accent}" aria-hidden="true"></div>
          <div class="cart-item-info">
            <strong>${escapeHtml(name2)}</strong>
            <span class="cart-item-price">${escapeHtml(lineTotal)}</span>
          </div>
          <div class="cart-item-controls">
            <button type="button" class="qty-btn" data-qty-dec="${escapeHtml(item.productId)}" aria-label="${getCopy("Decrease quantity", "Rage adadi")}">\u2212</button>
            <span class="qty-value" aria-label="${getCopy("Quantity", "Adadi")}">${item.quantity}</span>
            <button type="button" class="qty-btn" data-qty-inc="${escapeHtml(item.productId)}" aria-label="${getCopy("Increase quantity", "Kara adadi")}">+</button>
          </div>
          <button type="button" class="cart-remove" data-remove="${escapeHtml(item.productId)}" aria-label="${getCopy("Remove", "Cire")}">\xD7</button>
        </div>
      `;
  }).join("");
}

// src/backend/promotions.ts
function getPromotions() {
  return getStoredList(storageKeys.promotions);
}
function getActivePromotions(now = /* @__PURE__ */ new Date()) {
  const time = now.getTime();
  return getPromotions().filter((promotion) => {
    if (!promotion.active) return false;
    if (new Date(promotion.startsAt).getTime() > time) return false;
    if (promotion.endsAt && new Date(promotion.endsAt).getTime() < time) return false;
    return true;
  });
}
function createPromotion(input) {
  const startsAt = /* @__PURE__ */ new Date();
  const endsAt = new Date(startsAt.getTime() + (input.daysActive ?? 14) * 24 * 60 * 60 * 1e3);
  const promotion = {
    id: createId(),
    title: {
      en: input.title.trim().slice(0, 80) || "Kano Mart promotion",
      ha: (input.titleHa || input.title).trim().slice(0, 80) || "Tallan Kano Mart"
    },
    type: input.type,
    discountPercent: typeof input.discountPercent === "number" ? Math.max(0, Math.min(90, Math.round(input.discountPercent))) : void 0,
    code: input.code?.trim().toUpperCase().slice(0, 24),
    productId: input.productId?.trim(),
    vendor: input.vendor?.trim(),
    category: input.category?.trim(),
    active: true,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: startsAt.toISOString()
  };
  setStoredList(storageKeys.promotions, [promotion, ...getPromotions()]);
  return promotion;
}
function getPromotionForProduct(product) {
  return getActivePromotions().find((promotion) => {
    if (promotion.type === "featured_product" && promotion.productId === product.id) return true;
    if (promotion.productId && promotion.productId !== product.id) return false;
    if (promotion.vendor && promotion.vendor !== product.vendor) return false;
    if (promotion.category && promotion.category !== product.category.en.toLowerCase()) return false;
    return promotion.discountPercent || promotion.type === "flash_sale" || promotion.type === "seasonal_campaign";
  });
}
function getDiscountedPrice(amount, promotion) {
  if (!promotion?.discountPercent) return amount;
  return Math.max(0, Math.round(amount * (1 - promotion.discountPercent / 100)));
}

// src/frontend/orders.ts
var liveOrders = null;
function getLiveOrders() {
  return liveOrders;
}
async function fetchLiveOrders() {
  const res = await api.orders();
  liveOrders = res.orders;
  return liveOrders;
}
function getOrders() {
  return getStoredList(storageKeys.orders);
}
function getUserOrders() {
  const user = state.currentUser;
  if (!user) return [];
  return getOrders().filter((o) => o.customerPhone === user.phone);
}
function placeOrder(customerName, customerPhone, deliveryArea, paymentMethod, deliveryOption = "delivery", deliveryAddress = "", deliveryFee = 0) {
  const cartItems = getCartItems();
  if (cartItems.length === 0) return null;
  const orderItems = cartItems.map((item) => {
    const product = getCartProduct(item.productId);
    const basePrice = product ? parsePrice(product.price) : 0;
    const promotion = product ? getPromotionForProduct(product) : void 0;
    const priceValue = getDiscountedPrice(basePrice, promotion);
    const lineTotal = priceValue * item.quantity;
    const vendor = product?.vendor ?? "Unknown vendor";
    const commissionRate = getCommissionRateForVendor(vendor);
    const commissionAmount = calculateCommission(lineTotal, commissionRate);
    return {
      productId: item.productId,
      quantity: item.quantity,
      name: product?.name.en ?? item.productId,
      price: product?.price ?? "NGN 0",
      priceValue,
      vendor,
      lineTotal,
      commissionRate,
      commissionAmount,
      vendorPayout: lineTotal - commissionAmount
    };
  });
  const itemsSubtotal = getCartSubtotal();
  const subtotal = itemsSubtotal + deliveryFee;
  const paymentReference = `KM-PAY-${Date.now().toString().slice(-8)}`;
  const commissionTotal = orderItems.reduce((total, item) => total + item.commissionAmount, 0);
  const vendorPayoutTotal = orderItems.reduce((total, item) => total + item.vendorPayout, 0);
  const order = {
    id: `KM-${Date.now().toString().slice(-6)}`,
    items: orderItems,
    customerName: sanitizePlainText(customerName, 80),
    customerPhone: sanitizePlainText(customerPhone, 24),
    deliveryOption,
    deliveryAddress: sanitizePlainText(deliveryAddress, 160),
    deliveryArea: sanitizePlainText(deliveryArea, 100),
    deliveryFee,
    paymentMethod,
    paymentReference,
    paymentStatus: getPaymentStatusForMethod(paymentMethod),
    subtotal,
    commissionTotal,
    vendorPayoutTotal,
    status: "awaiting_confirmation",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const payment = createPaymentForOrder(order);
  order.paymentStatus = payment.status;
  const orders = getOrders();
  orders.unshift(order);
  setStoredList(storageKeys.orders, orders);
  clearCart();
  notifyMany([
    {
      audience: "customer",
      recipient: order.customerPhone,
      title: "Order placed",
      message: `Order ${order.id} has been placed.`,
      type: "order",
      orderId: order.id
    },
    {
      audience: "admin",
      title: "New order",
      message: `${order.id} is awaiting confirmation.`,
      type: "order",
      orderId: order.id
    },
    ...Array.from(new Set(order.items.map((item) => item.vendor))).map((vendor) => ({
      audience: "vendor",
      recipient: vendor,
      title: "New order",
      message: `${order.id} is awaiting vendor confirmation.`,
      type: "order",
      orderId: order.id
    }))
  ]);
  showToast({
    message: getCopy(`Order ${order.id} placed!`, `An sanya oda ${order.id}!`),
    duration: 4e3
  });
  return order;
}
function advanceOrderStatus(orderId) {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order || order.status === "delivered" || order.status === "cancelled") return order ?? null;
  const progression = order.deliveryOption === "pickup" ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"] : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
  const next = progression[progression.indexOf(order.status) + 1];
  if (!next) return order;
  order.status = next;
  if (next === "assigned_to_rider" && !order.deliveryPerson) {
    order.deliveryPerson = "Kano Mart rider";
  }
  order.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
  setStoredList(storageKeys.orders, orders);
  notifyMany([
    {
      audience: "customer",
      recipient: order.customerPhone,
      title: next === "delivered" ? "Order delivered" : "Order updated",
      message: `Order ${order.id}: ${getLocalizedValue(orderStatusLabels[next] ?? { en: next, ha: next })}.`,
      type: next === "delivered" ? "delivery" : "order",
      orderId: order.id
    },
    {
      audience: "admin",
      title: "Delivery status updated",
      message: `${order.id}: ${next}.`,
      type: "delivery",
      orderId: order.id
    }
  ]);
  if (next === "delivered" && order.paymentStatus === "paid") {
    settleDeliveredOrder(order.id);
  }
  return order;
}
function renderOrderStatusBadge(status) {
  const label = escapeHtml(getLocalizedValue(orderStatusLabels[status] ?? { en: status, ha: status }));
  return `<span class="order-status order-status-${status}">${label}</span>`;
}
function renderOrderTimeline(order) {
  const steps = order.deliveryOption === "pickup" ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"] : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
  const currentIndex = steps.indexOf(order.status);
  return `
    <ol class="order-timeline" aria-label="${getCopy("Order progress", "Ci gaban oda")}">
      ${steps.map((step, i) => {
    const done = i <= currentIndex;
    const label = escapeHtml(getLocalizedValue(orderStatusLabels[step] ?? { en: step, ha: step }));
    return `<li class="timeline-step${done ? " done" : ""}"><span>${label}</span></li>`;
  }).join("")}
    </ol>
  `;
}
function renderOrdersPanel() {
  if (liveOrders !== null && liveOrders.length > 0) {
    return liveOrders.slice(0, 10).map((order) => {
      const itemSummary = (order.items ?? []).map((i) => {
        const name2 = typeof i.name === "object" ? i.name.en ?? "" : String(i.name ?? i.productId ?? "");
        return `${escapeHtml(name2)} \xD7${i.quantity}`;
      }).join(", ");
      const paymentStatus = order.paymentStatus ?? "pending";
      const deliveryOption = order.deliveryOption ?? "delivery";
      const subtotal = order.subtotal ?? 0;
      const deliveryFee = order.deliveryFee ?? 0;
      return `
          <div class="order-card">
            <div class="order-card-header">
              <strong>${escapeHtml(order.id)}</strong>
              <span class="order-status order-status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
            </div>
            <p class="order-items">${itemSummary}</p>
            <div class="order-meta">
              <span>${escapeHtml(formatPrice(subtotal))}</span>
              <span>${escapeHtml(getCopy(`Payment: ${paymentStatus}`, `Biya: ${paymentStatus}`))}</span>
              <span>${escapeHtml(deliveryOption === "pickup" ? getCopy("Pickup", "Dauka") : getCopy(`Delivery fee: ${formatPrice(deliveryFee)}`, `Kudin kai kaya: ${formatPrice(deliveryFee)}`))}</span>
              <span>${escapeHtml(formatDate(order.createdAt))}</span>
            </div>
          </div>
        `;
    }).join("");
  }
  const orders = getUserOrders();
  if (orders.length === 0) {
    return `<p class="muted">${getCopy("No orders yet.", "Babu oda tukuna.")}</p>`;
  }
  return orders.slice(0, 10).map((order) => {
    const itemSummary = order.items.map((i) => `${escapeHtml(i.name)} \xD7${i.quantity}`).join(", ");
    const paymentStatus = order.paymentStatus ?? "pending";
    return `
        <div class="order-card">
          <div class="order-card-header">
            <strong>${escapeHtml(order.id)}</strong>
            ${renderOrderStatusBadge(order.status)}
          </div>
          <p class="order-items">${itemSummary}</p>
          <div class="order-meta">
            <span>${escapeHtml(formatPrice(order.subtotal))}</span>
            <span>${escapeHtml(getCopy(`Payment: ${paymentStatus}`, `Biya: ${paymentStatus}`))}</span>
            <span>${escapeHtml(order.deliveryOption === "pickup" ? getCopy("Pickup", "Dauka") : getCopy(`Delivery fee: ${formatPrice(order.deliveryFee || 0)}`, `Kudin kai kaya: ${formatPrice(order.deliveryFee || 0)}`))}</span>
            <span>${escapeHtml(formatDate(order.createdAt))}</span>
          </div>
          ${renderOrderTimeline(order)}
        </div>
      `;
  }).join("");
}

// src/backend/withdrawals.ts
function getWithdrawals() {
  return getStoredList(storageKeys.withdrawals);
}
function getPendingWithdrawalTotal(vendor) {
  return getWithdrawals().filter((withdrawal) => withdrawal.vendor === vendor && withdrawal.status === "pending").reduce((total, withdrawal) => total + withdrawal.amount, 0);
}
function getWithdrawableBalance(vendor) {
  return Math.max(0, getVendorAvailableBalance(vendor) - getPendingWithdrawalTotal(vendor));
}
function requestWithdrawal(vendor, amount) {
  const cleanVendor = vendor.trim();
  const cleanAmount = Math.round(amount);
  if (!cleanVendor || cleanAmount <= 0) return null;
  if (cleanAmount > getWithdrawableBalance(cleanVendor)) return null;
  const withdrawal = {
    id: createId(),
    vendor: cleanVendor,
    amount: cleanAmount,
    status: "pending",
    requestedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  setStoredList(storageKeys.withdrawals, [withdrawal, ...getWithdrawals()]);
  return withdrawal;
}
function approveWithdrawal(id, reviewNote = "") {
  const withdrawals = getWithdrawals();
  const withdrawal = withdrawals.find((item) => item.id === id);
  if (!withdrawal) return null;
  if (withdrawal.status === "approved") return withdrawal;
  if (withdrawal.status === "rejected") return null;
  if (withdrawal.amount > getVendorAvailableBalance(withdrawal.vendor)) return null;
  withdrawal.status = "approved";
  withdrawal.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  withdrawal.reviewNote = reviewNote.trim();
  setStoredList(storageKeys.withdrawals, withdrawals);
  recordWithdrawalDebit(withdrawal);
  return withdrawal;
}
function rejectWithdrawal(id, reviewNote = "") {
  const withdrawals = getWithdrawals();
  const withdrawal = withdrawals.find((item) => item.id === id);
  if (!withdrawal || withdrawal.status === "approved") return null;
  if (withdrawal.status === "rejected") return withdrawal;
  withdrawal.status = "rejected";
  withdrawal.reviewedAt = (/* @__PURE__ */ new Date()).toISOString();
  withdrawal.reviewNote = reviewNote.trim();
  setStoredList(storageKeys.withdrawals, withdrawals);
  return withdrawal;
}

// src/backend/analytics.ts
function recordProductView(productId) {
  const metrics = getStoredList(storageKeys.productMetrics);
  const existing = metrics.find((metric2) => metric2.productId === productId);
  if (existing) {
    existing.views += 1;
    existing.lastViewedAt = (/* @__PURE__ */ new Date()).toISOString();
    setStoredList(storageKeys.productMetrics, metrics);
    return existing;
  }
  const metric = {
    productId,
    views: 1,
    lastViewedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  setStoredList(storageKeys.productMetrics, [metric, ...metrics]);
  return metric;
}
function getProductMetrics() {
  return getStoredList(storageKeys.productMetrics);
}
function getMarketplaceAnalytics() {
  const orders = getStoredList(storageKeys.orders);
  const searches = getStoredList(storageKeys.searches);
  const customers = getStoredList(storageKeys.users).filter((user) => user.role === "customer");
  const vendors = getStoredList(storageKeys.vendors);
  const products2 = getAllProducts();
  const productName = (productId) => products2.find((product) => product.id === productId)?.name.en ?? productId;
  const sortMap = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([label, value]) => ({ label, value }));
  const sold = /* @__PURE__ */ new Map();
  const vendorSales = /* @__PURE__ */ new Map();
  orders.forEach((order) => {
    order.items.forEach((item) => {
      sold.set(productName(item.productId), (sold.get(productName(item.productId)) ?? 0) + item.quantity);
      vendorSales.set(item.vendor, (vendorSales.get(item.vendor) ?? 0) + item.lineTotal);
    });
  });
  const searchCounts = /* @__PURE__ */ new Map();
  searches.forEach((search) => searchCounts.set(search.query.toLowerCase(), (searchCounts.get(search.query.toLowerCase()) ?? 0) + 1));
  const viewed = /* @__PURE__ */ new Map();
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
    bestPerformingVendors: sortMap(vendorSales)
  };
}

// src/frontend/render.ts
function renderProductCard(product) {
  const name2 = product.name[state.language];
  const category = product.category[state.language];
  const subcategory = product.subcategory[state.language];
  const availability = product.availability[state.language];
  const wished = isWishlisted2(product.id);
  const avg = getAverageRating(product.id);
  const reviewCount = getProductReviews(product.id).length;
  const promotion = getPromotionForProduct(product);
  const basePrice = Number(product.price.replace(/[^0-9]/g, ""));
  const discountedPrice = getDiscountedPrice(basePrice, promotion);
  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="product-thumb" style="--accent: ${product.accent}">
        ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(name2)}" loading="lazy" />` : ""}
        <span>${escapeHtml(subcategory)}</span>
        <button type="button"
          class="wish-btn${wished ? " is-wishlisted" : ""}"
          data-wishlist="${escapeHtml(product.id)}"
          aria-label="${wished ? getCopy("Remove from wishlist", "Cire daga jerin da aka ajiye") : getCopy("Save to wishlist", "Ajiye zuwa jerin kaya")}"
          aria-pressed="${wished}">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="${wished ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>
          </svg>
        </button>
      </div>
      <h3>${escapeHtml(name2)}</h3>
      ${promotion ? `<span class="promo-badge">${escapeHtml(promotion.title[state.language])}${promotion.discountPercent ? ` - ${promotion.discountPercent}%` : ""}</span>` : ""}
      <p class="product-meta">
        <span>${escapeHtml(category)}</span>
        <span>${escapeHtml(product.vendor)}</span>
        <span>${escapeHtml(product.area)}</span>
      </p>
      ${reviewCount > 0 ? `
        <div class="card-rating">
          ${renderStars(avg)}
          <span class="rating-count">(${reviewCount})</span>
        </div>
      ` : ""}
      <p>${escapeHtml(availability)}</p>
      ${product.description?.[state.language] ? `<p>${escapeHtml(product.description[state.language])}</p>` : ""}
      <footer>
        <span class="price">
          ${promotion?.discountPercent ? `<del>${escapeHtml(product.price)}</del> ${escapeHtml(formatPrice(discountedPrice))}` : escapeHtml(product.price)}
        </span>
        <button type="button" data-add-to-cart="${escapeHtml(product.id)}">
          ${getCopy("Add", "Saka")}
        </button>
      </footer>
    </article>
  `;
}
function updateResultCopy(query, results) {
  elements.resultsTitle.textContent = getCopy("Search results", "Sakamakon bincike");
  elements.resultsIntro.textContent = getCopy(
    `Results related to "${query}" from trusted local vendors.`,
    `Sakamakon da ya shafi "${query}" daga amintattun dillalai.`
  );
  elements.resultStatus.hidden = false;
  elements.resultStatus.textContent = results.length === 0 ? getCopy("No result found. Search saved for Kano Mart.", "Ba a samu sakamako ba. An ajiye binciken.") : getCopy(
    `${results.length} result${results.length === 1 ? "" : "s"} found`,
    `An samu sakamako ${results.length}`
  );
}
function renderRankList(container, entries, emptyText) {
  if (entries.length === 0) {
    container.innerHTML = `<p class="muted">${escapeHtml(emptyText)}</p>`;
    return;
  }
  container.innerHTML = entries.slice(0, 5).map(
    ([label, count]) => `<div class="rank-row"><strong>${escapeHtml(label)}</strong><span>${count}</span></div>`
  ).join("");
}
function renderDemandTrends(history) {
  const entries = sortEntries(groupByValue(history, (item) => item.category));
  const max = entries[0]?.[1] || 1;
  if (entries.length === 0) {
    elements.demandTrends.innerHTML = `<p class="muted">${getCopy("No trends yet.", "Babu yanayi tukuna.")}</p>`;
    return;
  }
  elements.demandTrends.innerHTML = entries.slice(0, 6).map(([label, count]) => {
    const width = Math.max(10, Math.round(count / max * 100));
    return `
        <div class="trend-row">
          <div class="trend-label"><strong>${escapeHtml(localizeCategory(label))}</strong><span>${count}</span></div>
          <div class="trend-track"><span class="trend-fill" style="width: ${width}%"></span></div>
        </div>
      `;
  }).join("");
}
function renderRecords(history, vendors) {
  const approvedVendors = vendors.filter((vendor) => (vendor.status ?? "pending") === "approved");
  const wallets = getVendorWalletSummaries();
  const walletRows = wallets.slice(0, 4).map((wallet) => ({
    label: wallet.vendor,
    value: getCopy(
      `${formatPrice(wallet.availableBalance)} available`,
      `${formatPrice(wallet.availableBalance)} akwai`
    )
  }));
  const vendorRows = approvedVendors.slice(0, 3).map((vendor) => ({
    label: vendor.businessName,
    value: `${localizeCategory(vendor.category)} - ${vendor.area}`
  }));
  const defaultVendors = [
    { label: "Hajiya Ladi Kitchen", value: { en: "96% fulfilled orders", ha: "An cika oda 96%" } },
    { label: "Kantin Kwari Textiles", value: { en: "Fast stock updates", ha: "Saurin sabunta kaya" } },
    { label: "Back To School Kano", value: { en: "High school demand", ha: "Bukatar makaranta ta yi yawa" } }
  ];
  elements.vendorPerformance.innerHTML = [...walletRows, ...vendorRows, ...defaultVendors].slice(0, 4).map(
    (row) => `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(getLocalizedValue(row.value))}</span></div>`
  ).join("");
  const orders = getOrders();
  elements.orderRecords.innerHTML = orders.length > 0 ? orders.slice(0, 4).map(
    (order) => {
      const canAdvance = order.status !== "delivered" && order.status !== "cancelled";
      return `
                <div class="order-admin-row">
                  <div>
                    <strong>${escapeHtml(order.id)}</strong>
                    <span>${escapeHtml(`${formatPrice(order.subtotal)} - ${order.paymentStatus}`)}</span>
                  </div>
                  ${renderOrderStatusBadge(order.status)}
                  ${canAdvance ? `<button type="button" data-order-advance="${escapeHtml(order.id)}">${getCopy("Advance", "Ci gaba")}</button>` : `<span class="muted">${getCopy("Settled", "An kammala")}</span>`}
                </div>
              `;
    }
  ).join("") : demoOrders.map(
    (order) => `<div class="record-row"><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(getLocalizedValue(order.status))}</span></div>`
  ).join("");
  const paymentSummary = getPaymentSummary();
  const analytics = getMarketplaceAnalytics();
  const commissionSettings = getCommissionSettings();
  const paymentRows = [
    {
      label: getCopy("Paid volume", "Jimillar da aka biya"),
      value: `${formatPrice(paymentSummary.paidAmount)} - ${paymentSummary.paidCount}`
    },
    {
      label: getCopy("Pending payment", "Biyan da ke jira"),
      value: `${formatPrice(paymentSummary.pendingAmount)} - ${paymentSummary.pendingCount}`
    },
    {
      label: getCopy("Failed payment", "Biyan da ya gaza"),
      value: `${formatPrice(paymentSummary.failedAmount)} - ${paymentSummary.failedCount}`
    },
    {
      label: getCopy("Refunded", "An mayar"),
      value: `${formatPrice(paymentSummary.refundedAmount)} - ${paymentSummary.refundedCount}`
    },
    {
      label: getCopy("Platform commission", "Ribar dandali"),
      value: formatPrice(getPlatformCommissionTotal())
    }
  ];
  const paymentActionRows = getPayments().slice(0, 6).map((payment) => {
    const canConfirm = payment.status === "pending" || payment.status === "failed";
    const canFail = payment.status === "pending";
    const canRefund = payment.status === "paid";
    return `
        <div class="payment-admin-row">
          <div>
            <strong>${escapeHtml(payment.reference)}</strong>
            <span>${escapeHtml(`${payment.orderId} - ${payment.method} - ${formatPrice(payment.amount)}`)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(payment.status)}">${escapeHtml(payment.status)}</span>
          <div class="approval-actions">
            ${canConfirm ? `<button type="button" data-payment-action="confirm" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Confirm", "Tabbatar")}</button>` : ""}
            ${canFail ? `<button type="button" class="secondary-action" data-payment-action="fail" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Fail", "Gaza")}</button>` : ""}
            ${canRefund ? `<button type="button" class="secondary-action" data-payment-action="refund" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Refund", "Mayar")}</button>` : ""}
          </div>
        </div>
      `;
  }).join("");
  elements.paymentStatus.innerHTML = `
    ${paymentRows.map((payment) => `<div class="record-row"><strong>${escapeHtml(payment.label)}</strong><span>${escapeHtml(payment.value)}</span></div>`).join("")}
    ${paymentActionRows || `<p class="muted">${getCopy("No payments yet.", "Babu biya tukuna.")}</p>`}
  `;
  const withdrawals = getWithdrawals();
  elements.withdrawalQueue.innerHTML = withdrawals.length > 0 ? withdrawals.slice(0, 4).map((withdrawal) => {
    const canReview = withdrawal.status === "pending";
    return `
              <div class="withdrawal-row">
                <div>
                  <strong>${escapeHtml(withdrawal.vendor)}</strong>
                  <span>${escapeHtml(formatPrice(withdrawal.amount))}</span>
                </div>
                <span class="status-pill status-${escapeHtml(withdrawal.status)}">${escapeHtml(withdrawal.status)}</span>
                ${canReview ? `
                      <div class="approval-actions">
                        <button type="button" data-withdrawal-id="${escapeHtml(withdrawal.id)}" data-withdrawal-action="approved">${getCopy("Approve", "Amince")}</button>
                        <button type="button" class="secondary-action" data-withdrawal-id="${escapeHtml(withdrawal.id)}" data-withdrawal-action="rejected">${getCopy("Reject", "Ki")}</button>
                      </div>
                    ` : withdrawal.reviewedAt ? `<small>${escapeHtml(formatDate(withdrawal.reviewedAt))}</small>` : ""}
              </div>
            `;
  }).join("") : `<p class="muted">${getCopy("No withdrawal requests yet.", "Babu bukatar cire kudi tukuna.")}</p>`;
  const promotions = getPromotions();
  const analyticsRows = [
    [getCopy("Total sales", "Jimillar sayarwa"), formatPrice(analytics.totalSales)],
    [getCopy("Platform revenue", "Kudin dandali"), formatPrice(analytics.platformRevenue)],
    [getCopy("Total orders", "Jimillar ododi"), String(analytics.totalOrders)],
    [getCopy("Cancelled orders", "Ododin da aka soke"), String(analytics.cancelledOrders)],
    [getCopy("Customer growth", "Karin kwastomomi"), String(analytics.customerGrowth)],
    [getCopy("Vendor growth", "Karin dillalai"), String(analytics.vendorGrowth)]
  ];
  const renderAnalyticList = (title, rows) => `
    <div class="analytics-mini-list">
      <h4>${escapeHtml(title)}</h4>
      ${rows.length ? rows.map((row) => `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(String(row.value))}</span></div>`).join("") : `<p class="muted">${getCopy("No data yet.", "Babu bayanai tukuna.")}</p>`}
    </div>
  `;
  const analyticsEl = document.querySelector("#advancedAnalytics");
  if (analyticsEl) {
    analyticsEl.innerHTML = `
      <div class="advanced-kpi-grid">
        ${analyticsRows.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
      </div>
      <div class="advanced-analytics-grid">
        ${renderAnalyticList(getCopy("Most viewed products", "Kayayyakin da aka fi kallo"), analytics.mostViewedProducts)}
        ${renderAnalyticList(getCopy("Most searched items", "Abubuwan da aka fi nema"), analytics.mostSearchedItems)}
        ${renderAnalyticList(getCopy("Best-selling products", "Kayayyakin da suka fi sayuwa"), analytics.bestSellingProducts)}
        ${renderAnalyticList(getCopy("Best-performing vendors", "Dillalai mafi aiki"), analytics.bestPerformingVendors)}
      </div>
    `;
  }
  const controlsEl = document.querySelector("#phaseThreeControls");
  if (controlsEl) {
    controlsEl.innerHTML = `
      <div class="phase3-grid">
        <form id="commissionForm" class="phase3-card">
          <h4>${getCopy("Commission settings", "Saitin kwamishan")}</h4>
          <label>
            <span>${getCopy("Default commission (%)", "Kwamishan na asali (%)")}</span>
            <input type="number" min="0" max="50" step="1" name="defaultRate" value="${Math.round(commissionSettings.defaultRate * 100)}" />
          </label>
          <button type="submit">${getCopy("Save commission", "Ajiye kwamishan")}</button>
        </form>
        <form id="promotionForm" class="phase3-card">
          <h4>${getCopy("Promotion campaign", "Kamfen talla")}</h4>
          <label><span>${getCopy("Title", "Suna")}</span><input name="title" required placeholder="Ramadan food deals" /></label>
          <label><span>${getCopy("Type", "Nau'i")}</span>
            <select name="type">
              <option value="seasonal_campaign">Seasonal campaign</option>
              <option value="flash_sale">Flash sale</option>
              <option value="discount_code">Discount code</option>
              <option value="featured_product">Featured product</option>
              <option value="featured_vendor">Featured vendor</option>
            </select>
          </label>
          <label><span>${getCopy("Discount (%)", "Ragi (%)")}</span><input name="discountPercent" type="number" min="0" max="90" placeholder="10" /></label>
          <label><span>${getCopy("Code / vendor / product optional", "Code / dillali / kaya idan ana so")}</span><input name="target" placeholder="EIDFASHION" /></label>
          <button type="submit">${getCopy("Create promotion", "Kirkiri talla")}</button>
        </form>
        <div class="phase3-card">
          <h4>${getCopy("Active promotions", "Tallace-tallace masu aiki")}</h4>
          ${promotions.length ? promotions.slice(0, 6).map((promo) => `<div class="record-row"><strong>${escapeHtml(promo.title[state.language])}</strong><span>${escapeHtml(promo.type)}</span></div>`).join("") : `<p class="muted">${getCopy("No promotions yet.", "Babu talla tukuna.")}</p>`}
        </div>
      </div>
    `;
  }
  const subscriptionEl = document.querySelector("#vendorSubscriptionSummary");
  if (subscriptionEl) {
    const vendorRows2 = approvedVendors.slice(0, 8);
    subscriptionEl.innerHTML = vendorRows2.length > 0 ? vendorRows2.map((vendor) => {
      const plan = getVendorPlan(vendor.businessName);
      return `
                <div class="subscription-row">
                  <div><strong>${escapeHtml(vendor.businessName)}</strong><span>${escapeHtml(plan.name)} - ${formatPrice(plan.monthlyFee)} / ${Math.round(plan.commissionRate * 100)}%</span></div>
                  <select data-vendor-plan="${escapeHtml(vendor.businessName)}">
                    <option value="free"${plan.id === "free" ? " selected" : ""}>Free</option>
                    <option value="standard"${plan.id === "standard" ? " selected" : ""}>Standard</option>
                    <option value="premium"${plan.id === "premium" ? " selected" : ""}>Premium</option>
                  </select>
                </div>
              `;
    }).join("") : `<p class="muted">${getCopy("Approve vendors to assign plans.", "Amince da dillalai domin ba su plan.")}</p>`;
  }
  const reviews = getAllReviews().filter((review) => !review.hidden).slice(0, 6);
  elements.reviewModeration.innerHTML = reviews.length > 0 ? reviews.map(
    (review) => `
              <div class="review-admin-row">
                <div>
                  <strong>${escapeHtml(`${review.rating}/5 - ${review.reviewerName}`)}</strong>
                  <span>${escapeHtml(review.comment)}</span>
                </div>
                <button type="button" class="secondary-action" data-review-action="hide" data-review-id="${escapeHtml(review.id)}">
                  ${getCopy("Remove", "Cire")}
                </button>
              </div>
            `
  ).join("") : `<p class="muted">${getCopy("No visible reviews.", "Babu ra'ayi a fili.")}</p>`;
}
function renderVendorApprovals(vendors) {
  if (vendors.length === 0) {
    elements.vendorApprovals.innerHTML = `<p class="muted">${getCopy("No vendor applications yet.", "Babu bukatar dillalai tukuna.")}</p>`;
    return;
  }
  const statusWeight = { pending: 0, approved: 1, rejected: 2 };
  elements.vendorApprovals.innerHTML = [...vendors].sort((a, b) => {
    const statusA = a.status ?? "pending";
    const statusB = b.status ?? "pending";
    return statusWeight[statusA] - statusWeight[statusB] || b.createdAt.localeCompare(a.createdAt);
  }).slice(0, 8).map((vendor) => {
    const status = vendor.status ?? "pending";
    const statusLabel = status === "approved" ? getCopy("Approved", "An amince") : status === "rejected" ? getCopy("Rejected", "An ki") : getCopy("Pending", "Ana dubawa");
    const canReview = status === "pending";
    return `
        <div class="vendor-approval-row">
          <div>
            <strong>${escapeHtml(vendor.businessName)}</strong>
            <span>${escapeHtml(vendor.area)} - ${escapeHtml(localizeCategory(vendor.category))} - ${escapeHtml(vendor.phone)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
          ${canReview ? `
                <div class="approval-actions">
                  <button type="button" data-vendor-id="${escapeHtml(vendor.id)}" data-vendor-action="approved">
                    ${getCopy("Approve", "Amince")}
                  </button>
                  <button type="button" class="secondary-action" data-vendor-id="${escapeHtml(vendor.id)}" data-vendor-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                </div>
              ` : vendor.reviewedAt ? `<small>${escapeHtml(formatDate(vendor.reviewedAt))}</small>` : ""}
        </div>
      `;
  }).join("");
}
function renderProductModeration() {
  const productStatusWeight = { pending: 0, hidden: 1, rejected: 2, approved: 3 };
  const allProducts = getAllProducts();
  const pendingProducts = allProducts.filter((p) => getProductStatus(p.id) === "pending");
  const otherProducts = allProducts.filter((p) => getProductStatus(p.id) !== "pending").sort((a, b) => productStatusWeight[getProductStatus(a.id)] - productStatusWeight[getProductStatus(b.id)]);
  const maxOthers = Math.max(0, 12 - pendingProducts.length);
  const visibleProducts = [...pendingProducts, ...otherProducts.slice(0, maxOthers)];
  if (visibleProducts.length === 0) {
    elements.productModeration.innerHTML = `<p class="muted">${getCopy("No products to moderate yet.", "Babu kaya da za a duba tukuna.")}</p>`;
    return;
  }
  elements.productModeration.innerHTML = visibleProducts.map((product) => {
    const status = getProductStatus(product.id);
    const statusLabel = status === "approved" ? getCopy("Approved", "An amince") : status === "pending" ? getCopy("Pending", "Ana dubawa") : status === "hidden" ? getCopy("Hidden", "An boye") : getCopy("Rejected", "An ki");
    const isVisible = status === "approved";
    return `
        <div class="product-moderation-row">
          <div class="moderation-product-thumb" style="--accent: ${product.accent}" aria-hidden="true"></div>
          <div>
            <strong>${escapeHtml(product.name[state.language])}</strong>
            <span>${escapeHtml(product.vendor)} - ${escapeHtml(product.category[state.language])}</span>
          </div>
          <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
          <div class="approval-actions">
            ${isVisible ? `
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="hidden">
                    ${getCopy("Hide", "Boye")}
                  </button>
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                ` : `
                  <button type="button" data-product-id="${escapeHtml(product.id)}" data-product-action="approved">
                    ${getCopy("Approve", "Amince")}
                  </button>
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                `}
          </div>
        </div>
      `;
  }).join("");
}
function renderAdminDashboard() {
  const history = getStoredList(storageKeys.searches);
  const vendors = getVendorRequests();
  const failed = history.filter((item) => item.resultCount === 0);
  const popular = sortEntries(groupByValue(history, (item) => item.query.toLowerCase()));
  const failedPopular = sortEntries(groupByValue(failed, (item) => item.query.toLowerCase()));
  const vendorCounts = getVendorStatusCounts(vendors);
  const productCounts = getProductStatusCounts();
  const orders = getOrders();
  elements.totalSearches.textContent = String(getUserProfiles().filter((user) => user.role === "customer").length);
  elements.failedSearches.textContent = String(vendors.length);
  elements.savedVendors.textContent = String(vendorCounts.pending);
  elements.topDemand.textContent = `${productCounts.approved} / ${orders.length}`;
  renderRankList(elements.popularSearches, popular, getCopy("No searches yet.", "Babu bincike tukuna."));
  renderRankList(
    elements.failedSearchList,
    failedPopular,
    getCopy("No failed searches yet.", "Babu binciken da ya gaza tukuna.")
  );
  renderDemandTrends(history);
  renderVendorApprovals(vendors);
  renderProductModeration();
  renderRecords(history, vendors);
  elements.searchHistoryTable.innerHTML = history.length === 0 ? `<tr><td colspan="5">${getCopy("No search history yet.", "Babu tarihin bincike tukuna.")}</td></tr>` : history.slice(0, 20).map((item) => {
    const failedClass = item.resultCount === 0 ? " failed" : "";
    const status = item.resultCount === 0 ? getCopy("Saved demand", "An ajiye bukata") : getCopy("Matched", "An samu");
    return `
              <tr>
                <td>${escapeHtml(item.query)}</td>
                <td>${item.resultCount}</td>
                <td>${escapeHtml(localizeCategory(item.category))}</td>
                <td><span class="status-pill${failedClass}">${escapeHtml(status)}</span></td>
                <td>${escapeHtml(formatDate(item.createdAt))}</td>
              </tr>
            `;
  }).join("");
}

// src/frontend/admin.ts
function exportSearchHistory() {
  const history = getStoredList(storageKeys.searches);
  if (history.length === 0) {
    alert(getCopy("No search history to export.", "Babu tarihin bincike da za a fitar."));
    return;
  }
  const rows = [
    ["Query", "Language", "Results", "Category", "Status", "Time"],
    ...history.map((item) => [
      item.query,
      item.language,
      item.resultCount,
      item.category,
      item.status,
      item.createdAt
    ])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kano-mart-search-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}
function clearPrototypeData() {
  const ok = window.confirm(
    getCopy(
      "Clear all saved prototype data? This includes searches, vendors, cart, orders, wishlist, and reviews.",
      "A goge dukkan bayanan gwaji? Wannan ya hada da bincike, dillalai, kwando, oda, jerin bukata, da ra'ayoyi."
    )
  );
  if (!ok) return;
  [
    storageKeys.searches,
    storageKeys.vendors,
    storageKeys.liveVendors,
    storageKeys.cart,
    storageKeys.orders,
    storageKeys.payments,
    storageKeys.walletLedger,
    storageKeys.withdrawals,
    storageKeys.reviews,
    storageKeys.wishlist,
    storageKeys.vendorProducts,
    storageKeys.liveProducts,
    storageKeys.users,
    storageKeys.session,
    storageKeys.adminSession
  ].forEach((key) => localStorage.removeItem(key));
  state.cartCount = 0;
  state.currentUser = null;
  state.adminAuthenticated = false;
  elements.cartCountEl.textContent = "0";
  syncCart();
  syncWishlistCount();
  renderAdminDashboard();
  window.dispatchEvent(new CustomEvent("kanoMart:signed-out"));
}

// src/frontend/checkout.ts
var DEFAULT_DELIVERY_FEE = 1200;
function buildCheckoutModal() {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "checkoutModal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "checkoutTitle");
  const user = state.currentUser;
  const items = getCartItems();
  const subtotal = getCartSubtotal();
  const itemsHtml = items.map((item) => {
    const product = getCartProduct(item.productId);
    if (!product) return "";
    const name2 = escapeHtml(product.name[state.language]);
    const lineTotal = escapeHtml(formatPrice(
      parseInt(product.price.replace(/[^0-9]/g, ""), 10) * item.quantity
    ));
    return `<div class="checkout-item"><span>${name2} \xD7${item.quantity}</span><span>${lineTotal}</span></div>`;
  }).join("");
  el.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="checkoutTitle">${getCopy("Checkout", "Biyan kudi")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div id="checkoutFormView">
        <div class="checkout-summary">
          ${itemsHtml}
          <div class="checkout-item"><span>${getCopy("Estimated delivery fee", "Kudin kai kaya")}</span><span>${escapeHtml(formatPrice(DEFAULT_DELIVERY_FEE))}</span></div>
          <div class="checkout-total">
            <strong>${getCopy("Total", "Jimla")}</strong>
            <strong>${escapeHtml(formatPrice(subtotal + DEFAULT_DELIVERY_FEE))}</strong>
          </div>
        </div>
        <form id="checkoutForm" class="checkout-form" novalidate>
          <label>
            <span>${getCopy("Full name", "Cikakken suna")}</span>
            <input type="text" name="customerName" value="${escapeHtml(user?.name || "")}" required autocomplete="name" />
          </label>
          <label>
            <span>${getCopy("Phone number", "Lambar waya")}</span>
            <input type="tel" name="customerPhone" value="${escapeHtml(user?.phone || "")}"
              required pattern="^(\\+234|0)[7-9][0-1]\\d{8}$" autocomplete="tel"
              placeholder="08012345678" />
          </label>
          <label>
            <span>${getCopy("Delivery or pickup", "Kai kaya ko dauka")}</span>
            <select name="deliveryOption" required>
              <option value="delivery">${getCopy("Delivery", "Kai kaya")}</option>
              <option value="pickup">${getCopy("Pickup", "Dauka")}</option>
            </select>
          </label>
          <label>
            <span>${getCopy("Delivery address", "Adireshin kai kaya")}</span>
            <input type="text" name="deliveryAddress" value="${escapeHtml(user?.deliveryAddress || "")}"
              placeholder="${getCopy("Street, house number, landmark", "Titi, lambar gida, alama")}" />
          </label>
          <label>
            <span>${getCopy("Delivery area", "Yankin isarwa")}</span>
            <input type="text" name="deliveryArea" required
              placeholder="${getCopy("e.g. Sabon Gari, Tarauni", "misali Sabon Gari, Tarauni")}" />
          </label>
          <label>
            <span>${getCopy("Payment method", "Hanyar biya")}</span>
            <select name="paymentMethod" required>
              <option value="" disabled selected>${getCopy("Choose", "Zaba")}</option>
              <option value="pay_on_delivery">${getCopy("Pay on delivery", "Biya idan an kawo")}</option>
              <option value="manual_transfer">${getCopy("Manual bank transfer", "Tura kudi ta banki")}</option>
              <option value="card">${getCopy("Card payment (later online gateway)", "Biyan kati daga baya")}</option>
              <option value="ussd">${getCopy("USSD (later online gateway)", "USSD daga baya")}</option>
              <option value="wallet">${getCopy("Wallet (later)", "Wallet daga baya")}</option>
            </select>
          </label>
          <button type="submit" class="checkout-submit">${getCopy("Place order", "Sanya oda")}</button>
          <p class="form-message" id="checkoutError" role="alert"></p>
        </form>
      </div>
      <div id="checkoutSuccessView" hidden class="checkout-success">
        <div class="success-icon" aria-hidden="true">\u2713</div>
        <h3>${getCopy("Order placed!", "An sanya oda!")}</h3>
        <p id="checkoutOrderId" class="muted"></p>
        <p class="muted">${getCopy("We will confirm your order shortly.", "Za mu tabbatar da odanka nan ba da jimawa ba.")}</p>
        <button type="button" class="checkout-done">${getCopy("Done", "Kammala")}</button>
      </div>
    </div>
  `;
  return el;
}
function openCheckoutModal() {
  const existing = document.getElementById("checkoutModal");
  if (existing) existing.remove();
  const modal = buildCheckoutModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
  modal.querySelector("input[name='customerName']")?.focus();
  modal.querySelector(".modal-close")?.addEventListener("click", () => closeCheckoutModal());
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeCheckoutModal();
  });
  modal.querySelector("#checkoutForm")?.addEventListener("submit", (e) => {
    void handleCheckoutSubmit(e);
  });
  async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = form.querySelector("button[type='submit']");
    const data = new FormData(form);
    const errorEl = modal.querySelector("#checkoutError");
    const deliveryOption = String(data.get("deliveryOption") || "delivery") === "pickup" ? "pickup" : "delivery";
    const deliveryAddress = String(data.get("deliveryAddress") || "");
    const deliveryArea = String(data.get("deliveryArea") || "");
    const paymentMethod = String(data.get("paymentMethod") || "");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = getCopy("Placing order\u2026", "Ana sanya oda\u2026");
    }
    errorEl.textContent = "";
    if (state.currentUser?.token) {
      try {
        const result = await api.checkout({
          deliveryOption,
          deliveryAddress,
          deliveryArea,
          paymentMethod
        });
        clearCart();
        modal.querySelector("#checkoutFormView").hidden = true;
        const successView2 = modal.querySelector("#checkoutSuccessView");
        successView2.hidden = false;
        modal.querySelector("#checkoutOrderId").textContent = getCopy(
          `Order ID: ${result.order.id} - Payment ${result.order.paymentStatus ?? "pending"}`,
          `Lambar oda: ${result.order.id} - Biya ${result.order.paymentStatus ?? "pending"}`
        );
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = getCopy("Place order", "Sanya oda");
        }
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message) {
          errorEl.textContent = message;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = getCopy("Place order", "Sanya oda");
          }
          return;
        }
      }
    }
    const order = placeOrder(
      String(data.get("customerName") || ""),
      String(data.get("customerPhone") || ""),
      deliveryArea,
      paymentMethod,
      deliveryOption,
      deliveryAddress,
      deliveryOption === "pickup" ? 0 : DEFAULT_DELIVERY_FEE
    );
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = getCopy("Place order", "Sanya oda");
    }
    if (!order) {
      errorEl.textContent = getCopy("Cart is empty.", "Kwandona a fanko.");
      return;
    }
    modal.querySelector("#checkoutFormView").hidden = true;
    const successView = modal.querySelector("#checkoutSuccessView");
    successView.hidden = false;
    modal.querySelector("#checkoutOrderId").textContent = getCopy(
      `Order ID: ${order.id} - Payment ${order.paymentStatus}`,
      `Lambar oda: ${order.id} - Biya ${order.paymentStatus}`
    );
  }
  modal.querySelector(".checkout-done")?.addEventListener("click", () => closeCheckoutModal());
}
function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
}

// src/frontend/auth.ts
var MOCK_OTP = "123456";
function sessionFromApi(response) {
  const user = response.user;
  return {
    id: user.id,
    token: response.token,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
    role: user.role,
    vendorStatus: user.vendorStatus,
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function syncApiLogin(identifier, password) {
  if (!password) return null;
  try {
    const response = await api.login(identifier, password);
    saveApiToken(response.token);
    return sessionFromApi(response);
  } catch {
    return null;
  }
}
async function syncApiRegistration(input) {
  if (input.password.length < 8) return null;
  try {
    const response = await api.register(input);
    saveApiToken(response.token);
    return sessionFromApi(response);
  } catch (error) {
    const existing = await syncApiLogin(input.phone, input.password);
    if (existing) return existing;
    throw error;
  }
}
function saveSession(session) {
  state.currentUser = session;
  if (session.token) saveApiToken(session.token);
  state.adminAuthenticated = session.role === "admin";
  localStorage.setItem(storageKeys.session, JSON.stringify(session));
  if (session.role === "admin") {
    localStorage.setItem(storageKeys.adminSession, (/* @__PURE__ */ new Date()).toISOString());
  } else {
    localStorage.removeItem(storageKeys.adminSession);
  }
  syncUserButton();
  window.dispatchEvent(new CustomEvent("kanoMart:signed-in", { detail: session }));
}
function signOut() {
  void api.logout().catch(() => void 0);
  state.currentUser = null;
  state.adminAuthenticated = false;
  clearApiToken();
  localStorage.removeItem(storageKeys.session);
  localStorage.removeItem(storageKeys.adminSession);
  syncUserButton();
  closeUserPanel();
  window.dispatchEvent(new CustomEvent("kanoMart:signed-out"));
  showToast({ message: getCopy("Signed out.", "An fita."), type: "info" });
}
function syncUserButton() {
  const user = state.currentUser;
  if (user) {
    elements.userButtonLabel.textContent = user.name || user.phone;
    elements.userButton.setAttribute("aria-label", getCopy("My account", "Asusuna"));
  } else {
    elements.userButtonLabel.textContent = getCopy("Sign in", "Shiga");
    elements.userButton.setAttribute("aria-label", getCopy("Sign in", "Shiga"));
  }
}
function buildAuthModal() {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "authModal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "authModalTitle");
  el.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="authModalTitle">${getCopy("Sign in to Kano Mart", "Shiga Kano Mart")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div id="authPhasePhone" class="auth-phase">
        <p class="muted">${getCopy("Enter your phone number to receive a one-time code.", "Shigar da lambar wayarka domin karban lambar shiga.")}</p>
        <form id="authPhoneForm" novalidate>
          <label>
            <span>${getCopy("Email or phone number", "Email ko lambar waya")}</span>
            <input type="text" id="authPhone" name="phone" placeholder="08012345678 or name@email.com"
              required autocomplete="username" />
          </label>
          <button type="submit">${getCopy("Send code", "Aika lambar")}</button>
          <p class="form-message" id="authPhoneError" role="alert"></p>
        </form>
      </div>
      <div id="authPhaseOtp" class="auth-phase" hidden>
        <p class="muted" id="authOtpHint"></p>
        <form id="authOtpForm" novalidate>
          <label>
            <span>${getCopy("One-time code", "Lambar shiga")}</span>
            <input type="text" id="authOtp" name="otp" maxlength="6" pattern="\\d{6}"
              inputmode="numeric" autocomplete="one-time-code" required placeholder="${getCopy("6-digit code", "Lambar lamba 6")}" />
          </label>
          <label id="authLoginPasswordWrap" hidden>
            <span>${getCopy("Password", "Kalmar sirri")}</span>
            <input type="password" id="authLoginPassword" name="loginPassword" autocomplete="current-password" />
          </label>
          <div id="authSignupFields" class="auth-signup-fields" hidden>
            <div class="form-grid-two">
              <label>
                <span>${getCopy("First name", "Sunan farko")}</span>
                <input type="text" id="authFirstName" name="firstName" autocomplete="given-name" minlength="2" />
              </label>
              <label>
                <span>${getCopy("Last name", "Sunan karshe")}</span>
                <input type="text" id="authLastName" name="lastName" autocomplete="family-name" minlength="2" />
              </label>
            </div>
            <label>
              <span>${getCopy("Email address", "Adireshin email")}</span>
              <input type="email" id="authEmail" name="email" autocomplete="email" />
            </label>
            <label>
              <span>${getCopy("Password", "Kalmar sirri")}</span>
              <input type="password" id="authPassword" name="password" minlength="8" autocomplete="new-password" />
            </label>
            <label>
              <span>${getCopy("Delivery address", "Adireshin isarwa")}</span>
              <input type="text" id="authDeliveryAddress" name="deliveryAddress" autocomplete="street-address" />
            </label>
            <label>
              <span>${getCopy("Preferred language", "Yaren da ka fi so")}</span>
              <select id="authPreferredLanguage" name="preferredLanguage">
                <option value="en">English</option>
                <option value="ha">Hausa</option>
              </select>
            </label>
            <label>
              <span>${getCopy("Account type", "Nau'in asusu")}</span>
              <select id="authAccountType" name="accountType">
                <option value="customer">${getCopy("Customer", "Kwastoma")}</option>
                <option value="vendor">${getCopy("Vendor / seller", "Dan kasuwa")}</option>
              </select>
            </label>
            <div id="authVendorFields" class="auth-vendor-fields" hidden>
              <label>
                <span>${getCopy("Business name", "Sunan kasuwanci")}</span>
                <input type="text" id="authBusinessName" name="businessName" autocomplete="organization" />
              </label>
              <label>
                <span>${getCopy("Market area", "Yankin kasuwa")}</span>
                <input type="text" id="authArea" name="area" placeholder="${getCopy("Kantin Kwari, Tarauni...", "Kantin Kwari, Tarauni...")}" />
              </label>
              <label>
                <span>${getCopy("Main category", "Babban rukuni")}</span>
                <select id="authCategory" name="category">
                  <option value="food">${getCopy("Food", "Abinci")}</option>
                  <option value="fashion">${getCopy("Fashion", "Kaya")}</option>
                  <option value="children">${getCopy("Children", "Yara")}</option>
                  <option value="essentials">${getCopy("Essentials", "Kayan yau da kullum")}</option>
                </select>
              </label>
            </div>
          </div>
          <button type="submit">${getCopy("Verify", "Tabbatar")}</button>
          <p class="form-message" id="authOtpError" role="alert"></p>
        </form>
        <button type="button" class="link-button" id="authBack">${getCopy("\u2190 Change number", "\u2190 Canza lambar")}</button>
      </div>
    </div>
  `;
  return el;
}
function openAuthModal(prefill) {
  const existing = document.getElementById("authModal");
  if (existing) existing.remove();
  const modal = buildAuthModal();
  document.body.appendChild(modal);
  wireAuthModal(modal);
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
  if (prefill?.phone) {
    const phoneInput = modal.querySelector("#authPhone");
    if (phoneInput) phoneInput.value = prefill.phone;
  }
  if (prefill?.role === "vendor") {
    const accountType = modal.querySelector("#authAccountType");
    if (accountType) accountType.value = "vendor";
  }
  if (prefill?.businessName) {
    const businessNameInput = modal.querySelector("#authBusinessName");
    if (businessNameInput) businessNameInput.value = prefill.businessName;
  }
  if (prefill?.area) {
    const areaInput = modal.querySelector("#authArea");
    if (areaInput) areaInput.value = prefill.area;
  }
  if (prefill?.category) {
    const categorySelect = modal.querySelector("#authCategory");
    if (categorySelect) categorySelect.value = prefill.category;
  }
  modal.querySelector("#authPhone")?.focus();
}
function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
}
function wireAuthModal(modal) {
  modal.querySelector(".modal-close")?.addEventListener("click", closeAuthModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });
  const phoneForm = modal.querySelector("#authPhoneForm");
  const otpForm = modal.querySelector("#authOtpForm");
  const phonePhase = modal.querySelector("#authPhasePhone");
  const otpPhase = modal.querySelector("#authPhaseOtp");
  const otpHint = modal.querySelector("#authOtpHint");
  const phoneError = modal.querySelector("#authPhoneError");
  const otpError = modal.querySelector("#authOtpError");
  const signupFields = modal.querySelector("#authSignupFields");
  const vendorFields = modal.querySelector("#authVendorFields");
  const accountType = modal.querySelector("#authAccountType");
  let pendingPhone = "";
  let needsSignup = false;
  function setSignupRequired(required) {
    signupFields.hidden = !required;
    modal.querySelectorAll("#authFirstName, #authLastName, #authEmail, #authPassword, #authDeliveryAddress").forEach((input) => {
      input.required = required;
    });
    accountType.required = required;
    setVendorRequired(required && accountType.value === "vendor");
  }
  function setVendorRequired(required) {
    vendorFields.hidden = !required;
    modal.querySelectorAll(
      "#authBusinessName, #authArea, #authCategory"
    ).forEach((input) => {
      input.required = required;
    });
  }
  phoneForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const identifier = (modal.querySelector("#authPhone")?.value || "").trim();
    if (!identifier) return;
    const emailProfile = identifier.includes("@") ? findUserProfileByEmail(identifier) : null;
    pendingPhone = emailProfile?.phone || normalizePhone(identifier);
    needsSignup = requiresSignup(pendingPhone);
    setSignupRequired(needsSignup);
    const loginPasswordWrap = modal.querySelector("#authLoginPasswordWrap");
    if (loginPasswordWrap) loginPasswordWrap.hidden = needsSignup || !findUserProfileByPhone(pendingPhone)?.passwordHash && !isAdminPhone(pendingPhone);
    otpHint.textContent = getCopy(
      isAdminPhone(pendingPhone) ? `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}. Enter an admin password of at least 8 characters.` : needsSignup ? `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}. Complete the first-time profile after the code.` : `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}`,
      isAdminPhone(pendingPhone) ? `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}. Shigar da kalmar admin akalla haruffa 8.` : needsSignup ? `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}. Kammala bayanan farko bayan lambar.` : `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}`
    );
    phonePhase.hidden = true;
    otpPhase.hidden = false;
    modal.querySelector("#authOtp")?.focus();
  });
  accountType.addEventListener("change", () => {
    setVendorRequired(needsSignup && accountType.value === "vendor");
  });
  otpForm.addEventListener("submit", (e) => {
    void handleOtpSubmit(e);
  });
  async function handleOtpSubmit(e) {
    e.preventDefault();
    const submitBtn = otpForm.querySelector("button[type='submit']");
    const otp = (modal.querySelector("#authOtp")?.value || "").trim();
    if (otp !== MOCK_OTP) {
      otpError.textContent = getCopy("Invalid code. Try: 123456", "Lambar ba daidai ba. Gwada: 123456");
      return;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = getCopy("Signing in\u2026", "Ana shiga\u2026");
    }
    let apiSession = null;
    if (needsSignup) {
      const firstName = (modal.querySelector("#authFirstName")?.value || "").trim();
      const lastName = (modal.querySelector("#authLastName")?.value || "").trim();
      const email = (modal.querySelector("#authEmail")?.value || "").trim();
      const password = (modal.querySelector("#authPassword")?.value || "").trim();
      const deliveryAddress = (modal.querySelector("#authDeliveryAddress")?.value || "").trim();
      const preferredLanguage = modal.querySelector("#authPreferredLanguage")?.value === "ha" ? "ha" : "en";
      const selectedType = accountType.value === "vendor" ? "vendor" : "customer";
      const businessName = (modal.querySelector("#authBusinessName")?.value || "").trim();
      const area = (modal.querySelector("#authArea")?.value || "").trim();
      const category = modal.querySelector("#authCategory")?.value || "essentials";
      if (!firstName || !lastName || !email || !password || !deliveryAddress || selectedType === "vendor" && (!businessName || !area)) {
        otpError.textContent = getCopy(
          "Complete the required sign-up details.",
          "Kammala muhimman bayanan rajista."
        );
        return;
      }
      if (password.length < 8) {
        otpError.textContent = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta kasance akalla haruffa 8.");
        return;
      }
      saveUserProfile({
        phone: pendingPhone,
        firstName,
        lastName,
        email,
        password,
        accountType: selectedType,
        deliveryAddress,
        preferredLanguage,
        businessName,
        area,
        category
      });
      try {
        apiSession = await syncApiRegistration({
          phone: pendingPhone,
          firstName,
          lastName,
          email,
          password,
          role: selectedType,
          deliveryAddress,
          preferredLanguage,
          businessName,
          area,
          category
        });
      } catch {
        showToast({
          message: getCopy("Signed in locally. Live account sync needs backend storage.", "An shiga a gida. Ana bukatar ajiyar backend."),
          type: "info"
        });
      }
    } else {
      const profile = findUserProfileByPhone(pendingPhone);
      const password = (modal.querySelector("#authLoginPassword")?.value || "").trim();
      if (isAdminPhone(pendingPhone) && password.length < 8) {
        otpError.textContent = getCopy("Enter an admin password of at least 8 characters.", "Shigar da kalmar admin akalla haruffa 8.");
        return;
      }
      if (profile?.passwordHash && !verifyPassword(pendingPhone, password)) {
        otpError.textContent = getCopy("Incorrect password.", "Kalmar sirri ba daidai ba.");
        return;
      }
      apiSession = await syncApiLogin(pendingPhone, password);
      if (!apiSession && isAdminPhone(pendingPhone)) {
        try {
          apiSession = await syncApiRegistration({
            phone: pendingPhone,
            firstName: "Admin",
            lastName: "User",
            password,
            role: "customer"
          });
        } catch {
          showToast({
            message: getCopy("Signed in locally. Live admin sync is unavailable.", "An shiga a gida. Ha\u0257in admin live bai samu ba."),
            type: "info"
          });
        }
      }
      if (!apiSession && profile && password.length >= 8) {
        try {
          apiSession = await syncApiRegistration({
            phone: pendingPhone,
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            password,
            role: profile.role,
            deliveryAddress: profile.deliveryAddress,
            preferredLanguage: profile.preferredLanguage
          });
        } catch {
          showToast({
            message: getCopy("Signed in locally. Live account sync is unavailable.", "An shiga a gida. Ha\u0257in asusun live bai samu ba."),
            type: "info"
          });
        }
      }
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = getCopy("Verify", "Tabbatar");
    }
    otpError.textContent = "";
    const session = apiSession ?? createSessionForPhone(pendingPhone);
    saveSession(session);
    closeAuthModal();
    const roleCopy = session.role === "admin" ? getCopy("Admin verified.", "An tabbatar da admin.") : session.role === "vendor" ? getCopy("Vendor account detected.", "An gano asusun dan kasuwa.") : getCopy("Signed in successfully!", "An shiga cikin nasara!");
    showToast({ message: roleCopy });
  }
  modal.querySelector("#authBack")?.addEventListener("click", () => {
    phonePhase.hidden = false;
    otpPhase.hidden = true;
    setSignupRequired(false);
    phoneError.textContent = "";
    otpError.textContent = "";
    modal.querySelector("#authPhone")?.focus();
  });
}
function buildUserPanel() {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "userPanel";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "userPanelTitle");
  const user = state.currentUser;
  el.innerHTML = `
    <div class="modal-box modal-box-wide">
      <div class="modal-header">
        <h2 id="userPanelTitle">${getCopy("My account", "Asusuna")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div class="user-info">
        <p><strong>${escapeHtml(user.name)}</strong> \xB7 ${escapeHtml(user.phone)} \xB7 ${escapeHtml(user.role)}</p>
        <button type="button" class="link-button" id="signOutBtn">${getCopy("Sign out", "Fita")}</button>
      </div>
      <form id="profileUpdateForm" class="auth-phase" novalidate>
        <div class="form-grid-two">
          <label>
            <span>${getCopy("Full name", "Cikakken suna")}</span>
            <input type="text" name="name" value="${escapeHtml(user.name)}" required />
          </label>
          <label>
            <span>${getCopy("Email", "Email")}</span>
            <input type="email" name="email" value="${escapeHtml(user.email || "")}" />
          </label>
        </div>
        ${user.role === "vendor" ? `<label>
          <span>${getCopy("Shop address (pickup location)", "Adireshin shago (don karbar kaya)")}</span>
          <input type="text" name="deliveryAddress" value="${escapeHtml(user.deliveryAddress || "")}" />
        </label>` : `<label>
          <span>${getCopy("Delivery address", "Adireshin isarwa")}</span>
          <input type="text" name="deliveryAddress" value="${escapeHtml(user.deliveryAddress || "")}" />
        </label>`}
        <label>
          <span>${getCopy("Preferred language", "Yaren da ka fi so")}</span>
          <select name="preferredLanguage">
            <option value="en"${user.preferredLanguage === "ha" ? "" : " selected"}>English</option>
            <option value="ha"${user.preferredLanguage === "ha" ? " selected" : ""}>Hausa</option>
          </select>
        </label>
        <button type="submit">${getCopy("Update profile", "Sabunta bayanai")}</button>
        <p class="form-message" id="profileUpdateMessage" role="status"></p>
      </form>
      <h3>${getCopy("My orders", "Odana")}</h3>
      <div id="userOrdersList">${renderOrdersPanel()}</div>
    </div>
  `;
  return el;
}
function openUserPanel() {
  if (!state.currentUser) {
    window.location.hash = "login";
    return;
  }
  const existing = document.getElementById("userPanel");
  if (existing) {
    existing.hidden = false;
    requestAnimationFrame(() => existing.classList.add("modal-visible"));
    return;
  }
  const panel = buildUserPanel();
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add("modal-visible"));
  if (state.currentUser.role === "customer" && state.currentUser.token) {
    fetchLiveOrders().then(() => {
      const listEl = panel.querySelector("#userOrdersList");
      if (listEl) listEl.innerHTML = renderOrdersPanel();
    }).catch(() => void 0);
  }
  panel.querySelector(".modal-close")?.addEventListener("click", closeUserPanel);
  panel.addEventListener("click", (e) => {
    if (e.target === panel) closeUserPanel();
  });
  panel.querySelector("#signOutBtn")?.addEventListener("click", signOut);
  panel.querySelector("#profileUpdateForm")?.addEventListener("submit", (event) => {
    void handleProfileUpdate(event);
  });
  async function handleProfileUpdate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name2 = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "");
    const deliveryAddress = String(data.get("deliveryAddress") || "");
    const preferredLanguage = data.get("preferredLanguage") === "ha" ? "ha" : "en";
    const [firstName, ...rest] = name2.split(/\s+/);
    const lastName = rest.join(" ");
    if (state.currentUser?.token) {
      try {
        const result = await api.updateMe({ name: name2, email, deliveryAddress, preferredLanguage });
        const updated2 = { ...state.currentUser, ...result.user, token: state.currentUser.token };
        saveSession(updated2);
      } catch {
      }
    }
    const updated = updateUserProfile(state.currentUser.phone, {
      firstName: firstName || state.currentUser.firstName,
      lastName: lastName || state.currentUser.lastName,
      email,
      deliveryAddress,
      preferredLanguage
    });
    if (updated && !state.currentUser?.token) saveSession(createSessionForPhone(updated.phone));
    const message = panel.querySelector("#profileUpdateMessage");
    if (message) message.textContent = getCopy("Profile updated.", "An sabunta bayanai.");
  }
}
function closeUserPanel() {
  const panel = document.getElementById("userPanel");
  if (!panel) return;
  panel.classList.remove("modal-visible");
  panel.addEventListener("transitionend", () => panel.remove(), { once: true });
}

// src/frontend/admin-gate.ts
function isAdminUnlocked() {
  return state.currentUser?.role === "admin";
}
function renderAdminGate() {
  if (isAdminUnlocked()) {
    elements.adminGate.hidden = true;
    elements.adminContent.hidden = false;
  } else {
    elements.adminGate.hidden = false;
    elements.adminContent.hidden = true;
  }
}

// src/frontend/frontend-data.ts
var PRODUCT_PAGE_SIZE = 8;
var searchCache = /* @__PURE__ */ new Map();
function getCachedSearchResults(query) {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;
  const results = getSearchResults(query);
  searchCache.set(key, results);
  return results;
}
function paginateProducts(products2, visibleCount) {
  const nextCount = Math.max(PRODUCT_PAGE_SIZE, visibleCount);
  return {
    visibleProducts: products2.slice(0, nextCount),
    hasMore: products2.length > nextCount
  };
}
function renderProductSkeletons(count = PRODUCT_PAGE_SIZE) {
  return Array.from(
    { length: count },
    () => `
      <article class="product-card product-skeleton" aria-hidden="true">
        <div class="product-thumb"></div>
        <h3></h3>
        <p class="product-meta"><span></span><span></span></p>
        <footer><span class="price"></span><button type="button" tabindex="-1"></button></footer>
      </article>
    `
  ).join("");
}

// src/frontend/live-api.ts
var categoryLabels = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" }
};
function formatApiPrice(amount) {
  return `NGN ${Math.max(0, Number(amount) || 0).toLocaleString("en-NG")}`;
}
function mapApiProduct(product) {
  const nameEn = product.name?.en || product.name?.ha || "Product";
  const nameHa = product.name?.ha || product.name?.en || nameEn;
  const category = categoryLabels[product.category] ?? {
    en: product.category || "Essentials",
    ha: product.category || "Kayan yau da kullum"
  };
  return {
    id: product.id,
    name: { en: nameEn, ha: nameHa },
    description: {
      en: product.description?.en || "",
      ha: product.description?.ha || product.description?.en || ""
    },
    category,
    subcategory: { en: "Live vendor product", ha: "Kayan dillali live" },
    price: formatApiPrice(product.price),
    quantityAvailable: product.quantityAvailable ?? 0,
    imageDataUrl: product.imageUrl,
    vendor: product.vendorName || "Kano Mart vendor",
    vendorPhone: product.vendorPhone,
    area: product.area || "Kano",
    availability: (product.quantityAvailable ?? 0) > 0 ? { en: "Available now", ha: "Akwai yanzu" } : { en: "Out of stock", ha: "Ya kare" },
    listingStatus: product.listingStatus ?? "active",
    moderationStatus: product.moderationStatus,
    accent: "#176b4d",
    tags: [nameEn, nameHa, product.category, product.vendorName, product.area, ...product.tags ?? []].filter(Boolean).map((item) => String(item).toLowerCase())
  };
}
function mapApiVendorApplication(application) {
  return {
    id: application.id,
    businessName: application.businessName,
    phone: application.phone,
    area: application.area,
    category: application.category,
    status: application.status,
    reviewedAt: application.reviewedAt,
    reviewNote: application.adminNote,
    createdAt: application.createdAt
  };
}
async function refreshLiveProducts(params = {}) {
  const response = await api.products(params);
  const products2 = response.products.map(mapApiProduct);
  setLiveProducts(products2);
  return products2;
}
async function refreshLiveVendorProducts() {
  const response = await api.vendorProducts();
  const products2 = response.products.map(mapApiProduct);
  setLiveVendorProducts(products2);
  return products2;
}
async function refreshLiveAdminQueues() {
  const [vendors, products2] = await Promise.all([
    api.adminVendorApplications().catch(() => ({ applications: [] })),
    api.adminProducts().catch(() => ({ products: [] }))
  ]);
  if (vendors.applications.length) setLiveVendorRequests(vendors.applications.map(mapApiVendorApplication));
  if (products2.products.length) {
    setLiveProducts(products2.products.map(mapApiProduct));
    for (const product of products2.products) {
      if (product.moderationStatus) {
        moderateProduct(product.id, product.moderationStatus, "Synced from live admin API");
      }
    }
  }
}
var liveAdminData = null;
function getLiveAdminData() {
  return liveAdminData;
}
async function fetchLiveAdminData() {
  const [ordersRes, paymentsRes, reviewsRes, promotionsRes, payoutsRes, analyticsRes, usersRes] = await Promise.all([
    api.adminOrders().catch(() => ({ orders: [] })),
    api.adminPayments().catch(() => ({ payments: [] })),
    api.adminReviews().catch(() => ({ reviews: [] })),
    api.adminPromotions().catch(() => ({ promotions: [] })),
    api.adminPayouts().catch(() => ({ payouts: [] })),
    api.adminAnalytics().catch(() => ({ analytics: null })),
    api.adminUsers().catch(() => ({ users: [] }))
  ]);
  liveAdminData = {
    orders: ordersRes.orders,
    payments: paymentsRes.payments,
    reviews: reviewsRes.reviews,
    promotions: promotionsRes.promotions,
    payouts: payoutsRes.payouts,
    analytics: analyticsRes.analytics,
    users: usersRes.users
  };
  return liveAdminData;
}
var liveVendorData = null;
function getLiveVendorData() {
  return liveVendorData;
}
async function fetchLiveVendorData() {
  const [ordersRes, reviewsRes, walletRes] = await Promise.all([
    api.vendorOrders().catch(() => ({ orders: [] })),
    api.vendorReviews().catch(() => ({ reviews: [] })),
    api.vendorWallet().catch(() => ({ wallet: null, payouts: [] }))
  ]);
  liveVendorData = {
    orders: ordersRes.orders,
    reviews: reviewsRes.reviews,
    wallet: walletRes.wallet,
    payouts: walletRes.payouts
  };
  return liveVendorData;
}
var liveNotifications = [];
function getLiveNotifications() {
  return liveNotifications;
}
async function fetchLiveNotifications() {
  const res = await api.notifications().catch(() => ({ notifications: [] }));
  liveNotifications = res.notifications;
  return liveNotifications;
}
var liveCategories = [];
async function fetchLiveCategories() {
  const res = await api.categories().catch(() => ({ categories: [] }));
  liveCategories = res.categories;
  return liveCategories;
}
async function refreshSession() {
  const res = await api.me().catch(() => null);
  return res?.user ?? null;
}
var liveVendorApplication = null;
function getLiveVendorApplication() {
  return liveVendorApplication;
}
async function fetchLiveVendorApplication() {
  const res = await api.vendorApplication().catch(() => null);
  liveVendorApplication = res?.application ?? null;
  return liveVendorApplication;
}

// src/frontend/auth-pages.ts
function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
function isValidPhone(v) {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}
function validateLogin(id, pw) {
  const e = {};
  if (!id.trim()) e.identifier = "Email or phone number is required.";
  else if (id.includes("@") && !isValidEmail(id)) e.identifier = "Enter a valid email address.";
  if (!pw) e.password = "Password is required.";
  else if (pw.length < 8) e.password = "Password must be at least 8 characters.";
  return e;
}
function validateCustomer(d) {
  const e = {};
  if (!d.fullName?.trim()) e.fullName = "Full name is required.";
  if (!d.email?.trim()) e.email = "Email address is required.";
  else if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
  if (!d.phone?.trim()) e.phone = "Phone number is required.";
  else if (!isValidPhone(d.phone)) e.phone = "Enter a valid Nigerian phone number (at least 10 digits).";
  if (!d.password) e.password = "Password is required.";
  else if (d.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (d.password !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
  if (!d.terms) e.terms = "You must accept the terms and conditions to continue.";
  return e;
}
function validateVendor(d) {
  const e = {};
  if (!d.businessName?.trim()) e.businessName = "Business or store name is required.";
  if (!d.ownerName?.trim()) e.ownerName = "Owner full name is required.";
  if (!d.email?.trim()) e.email = "Email address is required.";
  else if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
  if (!d.phone?.trim()) e.phone = "Phone number is required.";
  else if (!isValidPhone(d.phone)) e.phone = "Enter a valid Nigerian phone number (at least 10 digits).";
  if (!d.category) e.category = "Please select your business category.";
  if (!d.area?.trim()) e.area = "Business location or area is required.";
  if (!d.password) e.password = "Password is required.";
  else if (d.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (d.password !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
  if (!d.terms) e.terms = "You must accept the terms and conditions to continue.";
  return e;
}
function applyErrors(form, errors) {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
  form.querySelectorAll("[data-field]").forEach((el) => el.classList.remove("has-error"));
  for (const [field, msg] of Object.entries(errors)) {
    const errEl = form.querySelector(`[data-error="${field}"]`);
    const fieldEl = form.querySelector(`[data-field="${field}"]`);
    if (errEl) {
      errEl.textContent = msg;
      errEl.hidden = false;
    }
    if (fieldEl) fieldEl.classList.add("has-error");
  }
}
function clearErrors(form) {
  form.querySelectorAll(".field-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
  form.querySelectorAll("[data-field]").forEach((el) => el.classList.remove("has-error"));
  const fe = form.querySelector(".auth-form-error");
  if (fe) fe.textContent = "";
}
function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = label;
  btn.classList.toggle("is-loading", loading);
}
function wirePasswordToggles(root) {
  root.querySelectorAll(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling;
      if (!input || input.tagName !== "INPUT") return;
      const showing = input.type !== "password";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      btn.classList.toggle("is-showing", !showing);
      const eyeOpen = btn.querySelector(".eye-open");
      const eyeClosed = btn.querySelector(".eye-closed");
      eyeOpen?.toggleAttribute("hidden", !showing);
      eyeClosed?.toggleAttribute("hidden", showing);
    });
  });
}
function wireRoleTabs(root, onChange) {
  root.querySelectorAll("[data-role-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll("[data-role-tab]").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      onChange(tab.dataset.roleTab ?? "customer");
    });
  });
}
function buildSession(user, token) {
  return {
    id: user.id,
    token,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    name: user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone),
    role: user.role,
    vendorStatus: user.vendorStatus,
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt ?? (/* @__PURE__ */ new Date()).toISOString()
  };
}
function initLoginPage() {
  const page = document.getElementById("loginPage");
  if (!page) return;
  let currentRole = "customer";
  wirePasswordToggles(page);
  wireRoleTabs(page, (role) => {
    currentRole = role;
    updateLoginRoleHint(page, role);
  });
  const form = page.querySelector("#loginForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitLogin(form, currentRole);
  });
}
function updateLoginRoleHint(page, role) {
  const hint = page.querySelector(".auth-role-hint");
  if (!hint) return;
  hint.textContent = role === "vendor" ? "Sign in to access your vendor dashboard and manage your store." : "Sign in to shop from trusted local vendors around Kano.";
}
async function submitLogin(form, role) {
  clearErrors(form);
  const data = new FormData(form);
  const identifier = String(data.get("identifier") ?? "").trim();
  const password = String(data.get("password") ?? "");
  const errors = validateLogin(identifier, password);
  if (Object.keys(errors).length) {
    applyErrors(form, errors);
    form.querySelector(".has-error input")?.focus();
    return;
  }
  const btn = form.querySelector("#loginSubmitBtn");
  const formErr = form.querySelector(".auth-form-error");
  setLoading(btn, true, "Signing in\u2026");
  try {
    const res = await api.login(identifier, password);
    saveSession(buildSession(res.user, res.token));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign in failed. Please check your details and try again.";
    if (formErr) formErr.textContent = msg;
    setLoading(btn, false, "Sign in");
  }
}
function initSignupPage() {
  const page = document.getElementById("signupPage");
  if (!page) return;
  const hashRole = window.location.hash.split("/")[1];
  let currentRole = hashRole === "vendor" ? "vendor" : "customer";
  wirePasswordToggles(page);
  wireRoleTabs(page, (role) => {
    currentRole = role;
    applySignupRole(page, role);
  });
  if (currentRole === "vendor") {
    page.querySelectorAll("[data-role-tab]").forEach((tab) => {
      const isVendor = tab.dataset.roleTab === "vendor";
      tab.classList.toggle("is-active", isVendor);
      tab.setAttribute("aria-selected", String(isVendor));
    });
  }
  applySignupRole(page, currentRole);
  const form = page.querySelector("#signupForm");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitSignup(form, currentRole);
  });
}
function applySignupRole(page, role) {
  page.querySelectorAll("[data-customer-only]").forEach((el) => {
    el.hidden = role !== "customer";
  });
  page.querySelectorAll("[data-vendor-only]").forEach((el) => {
    el.hidden = role !== "vendor";
  });
  const hint = page.querySelector(".auth-role-hint");
  if (hint) {
    hint.textContent = role === "vendor" ? "Create your store and start selling to real customers in Kano." : "Join thousands of customers shopping from trusted local vendors.";
  }
  const btn = page.querySelector("#signupSubmitBtn");
  if (btn && !btn.disabled) {
    btn.textContent = role === "vendor" ? "Create vendor account" : "Create my account";
  }
  const brandSub = page.querySelector("#signupBrandSub");
  if (brandSub) {
    brandSub.textContent = role === "vendor" ? "Set up your store in minutes and reach thousands of customers across Kano." : "Create your account in minutes and start shopping from trusted local vendors.";
  }
}
async function submitSignup(form, role) {
  clearErrors(form);
  const data = new FormData(form);
  const fields = {};
  for (const [k, v] of data.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  fields.terms = data.get("terms") ? "yes" : "";
  const errors = role === "vendor" ? validateVendor(fields) : validateCustomer(fields);
  if (Object.keys(errors).length) {
    applyErrors(form, errors);
    form.querySelector(".has-error input, .has-error select")?.scrollIntoView({ behavior: "smooth", block: "center" });
    form.querySelector(".has-error input, .has-error select")?.focus();
    return;
  }
  const btn = form.querySelector("#signupSubmitBtn");
  const formErr = form.querySelector(".auth-form-error");
  setLoading(btn, true, "Creating account\u2026");
  try {
    const [firstName, ...rest] = (role === "vendor" ? fields.ownerName : fields.fullName).trim().split(/\s+/);
    const lastName = rest.join(" ");
    const payload = role === "vendor" ? { phone: fields.phone, email: fields.email, password: fields.password, firstName, lastName, role: "vendor", businessName: fields.businessName, area: fields.area, category: fields.category } : { phone: fields.phone, email: fields.email, password: fields.password, firstName, lastName, role: "customer" };
    const res = await api.register(payload);
    saveSession(buildSession(res.user, res.token));
    showToast({
      message: role === "vendor" ? getCopy("Vendor account created! Your application is under review.", "An \u0199ir\u0199iri asusun dillali! Ana duba bu\u0199atarka.") : getCopy("Account created! Welcome to Kano Mart.", "An \u0199ir\u0199iri asusu! Barka da zuwa Kano Mart.")
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign up failed. Please try again.";
    if (formErr) formErr.textContent = msg;
    const defaultLabel = role === "vendor" ? "Create vendor account" : "Create my account";
    setLoading(btn, false, defaultLabel);
  }
}

// src/frontend/router/dashboard-routes.ts
var dashboardRoutes = [
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
  { role: "admin", path: "admin/system-health", page: "admin", label: "System health", description: "API, DB, storage, email" }
];
function getDashboardRoute(path) {
  return dashboardRoutes.find((route) => route.path === path);
}
function getDashboardRoutesForRole(role) {
  return dashboardRoutes.filter((route) => route.role === role);
}
function getDefaultDashboardRoute(role) {
  if (role === "admin") return "admin/overview";
  if (role === "vendor") return "vendor/overview";
  if (role === "customer") return "customer/overview";
  return "home";
}
function getRoutePage(path) {
  if (path === "my-orders") return "orders";
  if (path === "results" || path === "categories") return "catalog";
  if (path.startsWith("p/")) return "product";
  if (path.startsWith("v/")) return "vendorpage";
  if (path === "sell") return "sell";
  return getDashboardRoute(path)?.page ?? (path.split("/")[0] || "home");
}

// src/frontend/services/dashboard-data.ts
function getCustomerDashboardData(user) {
  const liveOrders2 = getLiveOrders();
  const orders = liveOrders2?.length ? liveOrders2.filter((order) => order.customerUserId === user.id || order.customerPhone === user.phone).map((order) => ({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus ?? "pending",
    total: order.subtotal ?? 0,
    createdAt: order.createdAt,
    items: order.items?.map((item) => item.name?.en ?? item.productId).filter(Boolean) ?? []
  })) : getOrders().filter((order) => order.customerPhone === user.phone).map((order) => ({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.subtotal,
    createdAt: order.createdAt,
    items: order.items.map((item) => item.name)
  }));
  const wishlistIds = getWishlist();
  const recommended = getCatalogProducts().filter((product) => !wishlistIds.includes(product.id)).sort((a, b) => (b.quantityAvailable ?? 0) - (a.quantityAvailable ?? 0)).slice(0, 4);
  const notifications = getLiveNotifications().filter((item) => item.audience === "customer").slice(0, 5);
  return {
    orders,
    activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).slice(0, 3),
    recentPurchases: orders.slice(0, 4),
    wishlistCount: wishlistIds.length,
    cartCount: getCartItems().reduce((total, item) => total + item.quantity, 0),
    cartSubtotal: getCartSubtotal(),
    recommended,
    notifications
  };
}
function getVendorDashboardData(user) {
  const live = getLiveVendorData();
  const app = getLiveVendorApplication();
  const vendor = findVendorByPhone(user.phone);
  const businessName = app?.businessName || vendor?.businessName || user.name;
  const liveOrders2 = live?.orders ?? [];
  const localOrders = getOrders().filter((order) => order.items.some((item) => item.vendor === businessName));
  const orders = liveOrders2.length ? liveOrders2.map((order) => ({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus ?? "pending",
    total: order.subtotal ?? 0,
    createdAt: order.createdAt
  })) : localOrders.map((order) => ({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.items.filter((item) => item.vendor === businessName).reduce((sum, item) => sum + item.lineTotal, 0),
    createdAt: order.createdAt
  }));
  const products2 = getProductsForVendor(user.phone);
  const wallet = live?.wallet ?? getVendorWalletSummaries().find((summary) => summary.vendor === businessName) ?? null;
  const reviews = live?.reviews ?? getAllReviews().filter((review) => review.vendor === businessName);
  const lowStock = products2.filter((product) => (product.quantityAvailable ?? 0) <= 3);
  const paidSales = orders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + order.total, 0);
  return {
    businessName,
    approvalStatus: app?.status ?? user.vendorStatus ?? vendor?.status ?? "pending",
    approvalNote: app?.adminNote ?? vendor?.reviewNote,
    products: products2,
    orders,
    pendingOrders: orders.filter((order) => ["awaiting_confirmation", "preparing_order"].includes(order.status)),
    lowStock,
    topProducts: [...products2].sort((a, b) => parsePrice(b.price) - parsePrice(a.price)).slice(0, 5),
    wallet,
    payouts: live?.payouts ?? [],
    reviews: reviews.slice(0, 5),
    paidSales
  };
}
function getAdminDashboardData() {
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
  const activeVendors = live ? live.users.filter((user) => user.role === "vendor" && user.vendorStatus === "approved").length : vendorCounts.approved;
  const pendingVendorApprovals = live ? live.users.filter((user) => user.role === "vendor" && user.vendorStatus === "pending").length : vendorCounts.pending;
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
      products: getAllProducts().length
    },
    revenue: {
      total: totalRevenue,
      paid: analytics?.totalSales ?? paymentSummary.paidAmount,
      pending: paymentSummary.pendingAmount,
      refunded: paymentSummary.refundedAmount,
      commission: getPlatformCommissionTotal()
    }
  };
}
function productToMiniMeta(product) {
  return `${product.vendor} - ${product.price} - ${(product.quantityAvailable ?? 0).toLocaleString()} in stock`;
}

// src/frontend/components/dashboard/primitives.ts
function renderStatusBadge(status, label = status) {
  const normalized = String(status || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  return `<span class="dash-status dash-status-${escapeHtml(normalized)}">${escapeHtml(label.replace(/_/g, " "))}</span>`;
}
function renderStatCard(stat) {
  return `
    <article class="dash-stat-card" data-tone="${escapeHtml(stat.tone ?? "neutral")}">
      <span>${escapeHtml(stat.label)}</span>
      <strong>${escapeHtml(String(stat.value))}</strong>
      ${stat.detail ? `<small>${escapeHtml(stat.detail)}</small>` : ""}
    </article>
  `;
}
function renderStatGrid(stats) {
  return `<div class="dash-stat-grid">${stats.map(renderStatCard).join("")}</div>`;
}
function renderEmptyState(title, body, action) {
  return `
    <div class="dash-empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${action ? renderDashboardAction(action) : ""}
    </div>
  `;
}
function renderDashboardAction(action) {
  const tone = action.tone ?? "primary";
  if (action.href || action.route) {
    const href = action.href ?? `#${action.route}`;
    return `<a class="dash-action dash-action-${tone}" href="${escapeHtml(href)}"${action.route ? ` data-route="${escapeHtml(action.route)}"` : ""}>${escapeHtml(action.label)}</a>`;
  }
  return `<button class="dash-action dash-action-${tone}" type="button"${action.id ? ` id="${escapeHtml(action.id)}"` : ""}>${escapeHtml(action.label)}</button>`;
}
function renderDashboardHeader(input) {
  return `
    <header class="dash-page-header">
      <div>
        <p class="dash-eyebrow">${escapeHtml(input.eyebrow)}</p>
        <h2>${escapeHtml(input.title)}</h2>
        <p>${escapeHtml(input.description)}</p>
      </div>
      ${input.actions?.length ? `<div class="dash-header-actions">${input.actions.map(renderDashboardAction).join("")}</div>` : ""}
    </header>
  `;
}
function renderPanel(input) {
  return `
    <section class="dash-panel ${escapeHtml(input.className ?? "")}">
      <div class="dash-panel-heading">
        <div>
          ${input.eyebrow ? `<span>${escapeHtml(input.eyebrow)}</span>` : ""}
          <h3>${escapeHtml(input.title)}</h3>
        </div>
        ${input.action ? renderDashboardAction({ ...input.action, tone: input.action.tone ?? "secondary" }) : ""}
      </div>
      <div class="dash-panel-body">${input.body}</div>
    </section>
  `;
}
function renderMiniRows(rows, empty) {
  if (rows.length === 0) return renderEmptyState(empty.title, empty.body, empty.action);
  return `
    <div class="dash-mini-list">
      ${rows.map(
    (row) => `
            <article class="dash-mini-row">
              <div>
                <strong>${escapeHtml(row.title)}</strong>
                ${row.meta ? `<span>${escapeHtml(row.meta)}</span>` : ""}
              </div>
              ${row.value ? `<b>${escapeHtml(row.value)}</b>` : ""}
              ${row.status ? renderStatusBadge(row.status) : ""}
              ${row.action ? renderDashboardAction({ ...row.action, tone: row.action.tone ?? "secondary" }) : ""}
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderMoney(amount) {
  return formatPrice(Math.max(0, Number(amount ?? 0) || 0));
}

// src/frontend/components/dashboard/role-nav.ts
function renderRoleDashboardNav(role, currentPath) {
  const routes2 = getDashboardRoutesForRole(role);
  return `
    <nav class="dash-role-nav" aria-label="${escapeHtml(role)} dashboard sections">
      ${routes2.map(
    (route) => `
            <a href="#${escapeHtml(route.path)}" data-route="${escapeHtml(route.path)}" class="${route.path === currentPath ? "is-active" : ""}">
              <strong>${escapeHtml(route.label)}</strong>
              <span>${escapeHtml(route.description)}</span>
            </a>
          `
  ).join("")}
    </nav>
  `;
}

// src/frontend/pages/customer/overview.ts
function renderCustomerOverview(user, currentPath = "customer/overview") {
  const data = getCustomerDashboardData(user);
  const firstName = user.firstName || user.name.split(" ")[0] || "there";
  return `
    <div class="dash-shell dash-shell-customer">
      ${renderDashboardHeader({
    eyebrow: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
    title: `${getCopy("Welcome back", "Barka da dawowar")}, ${firstName}`,
    description: getCopy("Track active orders, continue shopping, review saved products, and handle support from one clean dashboard.", "Bi diddigin ododi masu aiki, ci gaba da siyayya, duba kayanda aka ajiye, da sarrafa tallafi daga allon sarrafa guda \u0257aya mai tsabta."),
    actions: [
      { label: getCopy("Shop catalog", "Saya daga jerin kaya"), route: "catalog" },
      { label: getCopy("Open cart", "Bu\u0257e kwandon saya"), id: "customerCartBtn", tone: "secondary" }
    ]
  })}

      ${renderRoleDashboardNav("customer", currentPath)}

      ${renderStatGrid([
    { label: getCopy("Active orders", "Ododi masu aiki"), value: data.activeOrders.length, detail: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`, tone: "info" },
    { label: getCopy("Cart subtotal", "Jimlar kwandon saya"), value: renderMoney(data.cartSubtotal), detail: `${data.cartCount} ${getCopy("items ready", "kaya a shirye")}`, tone: "success" },
    { label: getCopy("Wishlist", "Jerin abubuwan da ake so"), value: data.wishlistCount, detail: getCopy("Saved products", "Kayan da aka ajiye"), tone: "warning" },
    { label: getCopy("Unread updates", "Sanarwa da ba a karanta ba"), value: data.notifications.filter((item) => !item.readAt).length, detail: getCopy("Notifications", "Sanarwa"), tone: "neutral" }
  ])}

      <div class="dash-overview-grid">
        ${renderPanel({
    eyebrow: getCopy("Fulfillment", "Cika oda"),
    title: getCopy("Active orders", "Ododi masu aiki"),
    action: { label: getCopy("View all", "Duba duka"), route: "customer/orders" },
    body: renderMiniRows(
      data.activeOrders.map((order) => ({
        title: order.id,
        meta: `${order.items.slice(0, 2).join(", ") || getCopy("Order items", "Kayan oda")} - ${formatDate(order.createdAt)}`,
        value: renderMoney(order.total),
        status: order.status
      })),
      {
        title: getCopy("No active orders", "Babu ododi masu aiki"),
        body: getCopy("Start shopping and your live delivery timeline will appear here.", "Fara siyayya kuma jadawalin isar da kaya naka mai rai zai bayyana a nan."),
        action: { label: getCopy("Browse products", "Duba kaya"), route: "catalog" }
      }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Discovery", "Bincike"),
    title: getCopy("Recommended products", "Kayan da aka ba da shawara"),
    action: { label: getCopy("Shop more", "Saya \u0199ari"), route: "catalog" },
    body: data.recommended.length ? `<div class="dash-product-rail">${data.recommended.map(
      (product) => `
                    <article class="dash-product-card">
                      <div class="dash-product-thumb" style="--accent: ${escapeHtml(product.accent)}">
                        ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(getLocalizedValue(product.name))}" loading="lazy" />` : ""}
                      </div>
                      <strong>${escapeHtml(getLocalizedValue(product.name))}</strong>
                      <span>${escapeHtml(product.vendor)}</span>
                      <b>${escapeHtml(product.price)}</b>
                    </article>
                  `
    ).join("")}</div>` : renderEmptyState(getCopy("No recommendations yet", "Babu shawara tukuna"), getCopy("Search or save products to improve recommendations.", "Nemi ko ajiye kaya don inganta shawarwari."), { label: getCopy("Search catalog", "Nemi kaya"), route: "catalog" })
  })}

        ${renderPanel({
    eyebrow: getCopy("Saved shopping", "Siyayya da aka ajiye"),
    title: getCopy("Wishlist and cart", "Jerin abubuwan da ake so da kwandon saya"),
    body: `
            <div class="dash-action-stack">
              <button class="dash-command-card" type="button" id="customerWishlistBtn">
                <strong>${getCopy("Wishlist summary", "Ta\u0199aitaccen jerin abubuwan da ake so")}</strong>
                <span>${data.wishlistCount} ${getCopy("saved products waiting for review.", "kayan da aka ajiye suna jiran duba.")}</span>
              </button>
              <button class="dash-command-card" type="button" id="customerCartBtnSecondary">
                <strong>${getCopy("Cart checkout", "Biyan ku\u0257in kwandon saya")}</strong>
                <span>${data.cartCount} ${getCopy("items", "kaya")} - ${renderMoney(data.cartSubtotal)}</span>
              </button>
              <a class="dash-command-card" href="#customer/profile" data-route="customer/profile">
                <strong>${getCopy("Profile and delivery", "Bayani na sirri da isarwa")}</strong>
                <span>${getCopy("Keep your address, language, and contact details current.", "Kiyaye adireshin ka, yare, da bayanin hul\u0257a.")}</span>
              </a>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Recent activity", "Ayyukan kwanan nan"),
    title: getCopy("Purchases and notifications", "Siyayya da sanarwa"),
    body: `
            ${renderMiniRows(
      data.recentPurchases.slice(0, 3).map((order) => ({
        title: order.id,
        meta: `${formatDate(order.createdAt)} - ${getCopy("payment", "biya")} ${order.paymentStatus}`,
        value: renderMoney(order.total),
        status: order.status
      })),
      { title: getCopy("No purchases yet", "Babu siyayya tukuna"), body: getCopy("Completed orders will appear here for easy reordering.", "Ododi da aka kammala za su bayyana a nan don sake oda cikin sau\u0199i.") }
    )}
            <div class="dash-notification-stack">
              ${data.notifications.length ? data.notifications.map(
      (item) => `
                          <article>
                            <strong>${escapeHtml(item.title)}</strong>
                            <span>${escapeHtml(item.message)}</span>
                            ${item.readAt ? renderStatusBadge("read", getCopy("Read", "An karanta")) : renderStatusBadge("unread", getCopy("Unread", "Ba a karanta ba"))}
                          </article>
                        `
    ).join("") : renderEmptyState(getCopy("No notifications", "Babu sanarwa"), getCopy("Order, payment, and support updates will appear here.", "Sabuntawa na oda, biya, da tallafi za su bayyana a nan."))}
            </div>
          `
  })}
      </div>
    </div>
  `;
}

// src/frontend/pages/vendor/overview.ts
function renderApprovalBanner(status, note) {
  if (status === "approved") {
    return `
      <div class="dash-alert dash-alert-success">
        <strong>${getCopy("Store approved", "An amince da shago")}</strong>
        <span>${getCopy("Your products can be submitted for catalog moderation and orders can flow to this workspace.", "Ana iya aika kayanka don duba jerin kaya kuma ododi za su iya zuwa wannan wurin aiki.")}</span>
      </div>
    `;
  }
  const rejected = status === "rejected";
  return `
    <div class="dash-alert ${rejected ? "dash-alert-danger" : "dash-alert-warning"}">
      <strong>${rejected ? getCopy("Store needs attention", "Shago yana bu\u0199atar kulawa") : getCopy("Store approval pending", "Amincewa da shago na jira")}</strong>
      <span>${escapeHtml(note || (rejected ? getCopy("Review your business details and contact support before resubmitting.", "Duba bayanan kasuwancinka ka tuntubi tallafi kafin sake aika.") : getCopy("You can prepare products, but publishing is limited until admin approval.", "Kana iya shirya kaya, amma buga yana iyakantacce har admin ya amince.")))}</span>
    </div>
  `;
}
function renderVendorOverview(user, currentPath = "vendor/overview") {
  const data = getVendorDashboardData(user);
  return `
    <div class="dash-shell dash-shell-vendor">
      ${renderDashboardHeader({
    eyebrow: getCopy("Vendor workspace", "Wurin aiki na dillali"),
    title: data.businessName,
    description: getCopy("Manage products, inventory, orders, revenue, payouts, reviews, analytics, and store readiness.", "Kula da kaya, ajiya, ododi, ku\u0257in shiga, biyan ku\u0257i, ra'ayoyi, nazari, da shirye-shiryen shago."),
    actions: [
      { label: getCopy("Add product", "Saka kaya"), href: "#vendorProductForm" },
      { label: getCopy("Request payout", "Neman biya"), route: "vendor/payouts", tone: "secondary" }
    ]
  })}

      ${renderRoleDashboardNav("vendor", currentPath)}

      <div class="vendor-dash-header dash-hidden-compat">
        <div class="vendor-dash-title">
          <p class="eyebrow">${getCopy("Vendor workspace", "Wurin aiki na dillali")}</p>
          <h2 id="vendorDashBusinessName">${escapeHtml(data.businessName)}</h2>
        </div>
        <span class="vendor-status-badge" id="vendorStatusBadge" data-status="${escapeHtml(data.approvalStatus)}">${escapeHtml(data.approvalStatus)}</span>
      </div>

      ${renderApprovalBanner(data.approvalStatus, data.approvalNote)}

      ${renderStatGrid([
    { label: getCopy("Total sales", "Jimillar siyarwa"), value: renderMoney(data.paidSales), detail: getCopy("Paid order value", "Darajar oda da aka biya"), tone: "success" },
    { label: getCopy("Pending orders", "Ododi da ke jira"), value: data.pendingOrders.length, detail: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`, tone: "warning" },
    { label: getCopy("Low stock", "\u0198arancin ajiya"), value: data.lowStock.length, detail: getCopy("Products at 3 or fewer units", "Kaya da ke da na\xFAra 3 ko \u0199asa da haka"), tone: data.lowStock.length ? "danger" : "neutral" },
    { label: getCopy("Available payout", "Biya da ake da shi"), value: renderMoney(data.wallet?.availableBalance), detail: `${renderMoney(data.wallet?.pendingBalance)} ${getCopy("pending", "jira")}`, tone: "info" }
  ])}

      <div class="dash-overview-grid">
        ${renderPanel({
    eyebrow: getCopy("Fulfillment", "Cika oda"),
    title: getCopy("Recent orders", "Ododi na kwanan nan"),
    action: { label: getCopy("Orders", "Ododi"), route: "vendor/orders" },
    body: renderMiniRows(
      data.orders.slice(0, 6).map((order) => ({
        title: order.id,
        meta: `${formatDate(order.createdAt)} - ${getCopy("payment", "biya")} ${order.paymentStatus}`,
        value: renderMoney(order.total),
        status: order.status
      })),
      { title: getCopy("No vendor orders yet", "Babu ododi na dillali tukuna"), body: getCopy("New paid and pending orders will appear here when customers buy your products.", "Ododi sabbi da wa\u0257anda aka biya da wa\u0257anda ke jira za su bayyana a nan sa'ad da kwastoma suka sayi kayanka.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Inventory", "Ajiya"),
    title: getCopy("Low stock products", "Kaya da \u0199arancin ajiya"),
    action: { label: getCopy("Inventory", "Ajiya"), route: "vendor/inventory" },
    body: renderMiniRows(
      data.lowStock.slice(0, 5).map((product) => ({
        title: getLocalizedValue(product.name),
        meta: productToMiniMeta(product),
        status: (product.quantityAvailable ?? 0) === 0 ? "out_of_stock" : "low_stock"
      })),
      { title: getCopy("Inventory is healthy", "Ajiya tana cikin lafiya"), body: getCopy("Products with low or empty stock will be highlighted here.", "Kaya da ke da \u0199arancin ajiya ko babu za a nuna su a nan.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Catalog", "Jerin kaya"),
    title: getCopy("Top products", "Kayan da suka fi"),
    action: { label: getCopy("Products", "Kaya"), route: "vendor/products" },
    body: renderMiniRows(
      data.topProducts.map((product) => ({
        title: getLocalizedValue(product.name),
        meta: productToMiniMeta(product),
        status: product.moderationStatus ?? product.listingStatus ?? "active"
      })),
      { title: getCopy("No products yet", "Babu kaya tukuna"), body: getCopy("Add your first product with price, stock, image, and bilingual description.", "\u0198ara kayan farko tare da farashin, ajiya, hoto, da bayani mai harsuna biyu.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Payouts", "Biyan ku\u0257i"),
    title: getCopy("Wallet and settlement", "Walat da tantancewa"),
    action: { label: getCopy("Payouts", "Biyan ku\u0257i"), route: "vendor/payouts" },
    body: `
            <div class="dash-money-stack">
              <article><span>${getCopy("Available", "Da ake da shi")}</span><strong>${renderMoney(data.wallet?.availableBalance)}</strong></article>
              <article><span>${getCopy("Pending", "Jira")}</span><strong>${renderMoney(data.wallet?.pendingBalance)}</strong></article>
              <article><span>${getCopy("Commission paid", "Kwamiti da aka biya")}</span><strong>${renderMoney(data.wallet?.totalCommission)}</strong></article>
            </div>
            ${data.payouts.length ? renderMiniRows(
      data.payouts.slice(0, 3).map((payout) => ({
        title: payout.id,
        meta: `${payout.bankName ?? getCopy("Bank", "Banki")} - ${payout.requestedAt ? formatDate(payout.requestedAt) : getCopy("requested", "an nema")}`,
        value: renderMoney(payout.amount),
        status: payout.status
      })),
      { title: getCopy("No payout requests", "Babu bu\u0199atun biya"), body: getCopy("Request payouts once your available balance is ready.", "Nemi biyan ku\u0257i da zarar ku\u0257in da ake da shi ya shirya.") }
    ) : renderEmptyState(getCopy("No payout requests", "Babu bu\u0199atun biya"), getCopy("Settlement requests and admin decisions will appear here.", "Bu\u0199atun tantancewa da yanke shawara na admin za su bayyana a nan."))}
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Feedback", "Ra'ayi"),
    title: getCopy("Latest reviews", "Ra'ayoyi na kwanan nan"),
    action: { label: getCopy("Reviews", "Ra'ayoyi"), route: "vendor/reviews" },
    body: renderMiniRows(
      data.reviews.map((review) => ({
        title: `${review.rating}/5 - ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
        meta: review.comment,
        status: review.hidden ? "hidden" : "visible"
      })),
      { title: getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), body: getCopy("Customer reviews will help you monitor quality and trust.", "Ra'ayoyin kwastoma za su taimaka maka ka sa ido kan inganci da amana.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Manage", "Sarrafa"),
    title: getCopy("Product operations", "Ayyukan kaya"),
    className: "dash-panel-wide",
    body: `
            <div class="vendor-product-manager dash-embedded-manager" aria-labelledby="vendor-products-title">
              <div class="vendor-product-heading">
                <div>
                  <span>${getCopy("Seller catalog", "Jerin kayan mai siyarwa")}</span>
                  <h3 id="vendor-products-title">${getCopy("Add and manage products", "\u0198ara da sarrafa kaya")}</h3>
                </div>
                <p>${getCopy("Products are submitted for admin moderation before appearing in the public catalog.", "Ana aika kaya don duba admin kafin su bayyana a cikin jerin kayan jama'a.")}</p>
              </div>
              <div class="vendor-product-gate" id="vendorProductGate" role="status" aria-live="polite"></div>
              <form class="vendor-product-form" id="vendorProductForm" novalidate>
                <label><span>Product name (English)</span><input type="text" name="productName" minlength="2" maxlength="90" required placeholder="e.g. Plain black jallabiya" /></label>
                <label><span>Product name (Hausa)</span><input type="text" name="productNameHa" minlength="2" maxlength="90" placeholder="misali Jallabiya baki" /></label>
                <label><span>Description (English)</span><input type="text" name="descriptionEn" maxlength="240" placeholder="Short product description" /></label>
                <label><span>Description (Hausa)</span><input type="text" name="descriptionHa" maxlength="240" placeholder="Takaitaccen bayanin kaya" /></label>
                <label><span>Value / price</span><input type="text" inputmode="numeric" name="productValue" required placeholder="e.g. 15000" autocomplete="off" /></label>
                <label><span>Quantity available</span><input type="number" name="quantityAvailable" min="0" step="1" required placeholder="10" /></label>
                <label><span>Category</span><select name="productCategory" required><option value="food">Food</option><option value="fashion">Fashion</option><option value="children">Children</option><option value="essentials">Essentials</option></select></label>
                <label><span>Product picture</span><input type="file" name="productImage" accept="image/png,image/jpeg,image/webp" required /><small>JPEG, PNG, or WebP. Large phone photos are optimized before upload.</small></label>
                <button type="submit">Add product</button>
                <p class="form-message" id="vendorProductMessage" role="status" aria-live="polite"></p>
              </form>
              <div class="vendor-products-list" id="vendorProductsList" aria-live="polite"></div>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Compatibility", "Daidaitawa"),
    title: getCopy("Order queue and notifications", "Layin oda da sanarwa"),
    className: "dash-panel-wide",
    body: `<div class="vendor-commerce-list" id="vendorCommerceList" aria-live="polite"></div>`
  })}
      </div>
    </div>
  `;
}

// src/frontend/pages/admin/overview.ts
function renderAdminOverview(currentPath = "admin/overview") {
  const data = getAdminDashboardData();
  const pendingPayments = data.payments.filter((payment) => payment.status === "pending");
  const failedPayments = data.payments.filter((payment) => payment.status === "failed");
  const recentOrders = data.orders.slice(0, 6);
  return `
    <div class="dash-shell dash-shell-admin">
      ${renderDashboardHeader({
    eyebrow: getCopy("Marketplace control room", "Cibiyar kula da kasuwa"),
    title: getCopy("Admin dashboard", "Allon admin"),
    description: getCopy("Control users, vendors, products, approvals, orders, payments, disputes, categories, reports, audit logs, and system health.", "Kula da masu amfani, dillalai, kaya, amincewa, ododi, biyan ku\u0257i, rikice-rikice, rukunai, rahotanni, tarihin aiki, da lafiyar tsarin."),
    actions: [
      { label: getCopy("Vendor approvals", "Amincewa da dillalai"), route: "admin/vendors" },
      { label: getCopy("System health", "Lafiyar tsarin"), route: "admin/system-health", tone: "secondary" }
    ]
  })}

      ${renderRoleDashboardNav("admin", currentPath)}

      ${renderStatGrid([
    { label: getCopy("Total users", "Jimillar masu amfani"), value: data.counts.totalUsers, detail: getCopy("Registered accounts", "Asusun da aka yi rajista"), tone: "info" },
    { label: getCopy("Active vendors", "Dillalan da ke aiki"), value: data.counts.activeVendors, detail: `${data.counts.pendingVendorApprovals} ${getCopy("pending vendor approvals", "amincewa da dillalai ke jira")}`, tone: "success" },
    { label: getCopy("Pending approvals", "Amincewa da ke jira"), value: data.counts.pendingVendorApprovals + data.counts.pendingProductApprovals, detail: getCopy("Vendor and product queues", "Layukan dillalai da kaya"), tone: "warning" },
    { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: `${renderMoney(data.revenue.total)} GMV`, tone: "neutral" },
    { label: getCopy("Revenue", "Ku\u0257in shiga"), value: renderMoney(data.revenue.paid), detail: `${renderMoney(data.revenue.commission)} ${getCopy("commission", "kwamiti")}`, tone: "success" },
    { label: getCopy("Payment issues", "Matsalolin biya"), value: data.counts.failedPayments, detail: `${pendingPayments.length} ${getCopy("pending payments", "biyan ku\u0257i da ke jira")}`, tone: data.counts.failedPayments ? "danger" : "neutral" },
    { label: getCopy("Disputes", "Rikice-rikice"), value: data.counts.disputes, detail: getCopy("Requires dispute endpoint", "Ana bu\u0199atar hanyar rikice-rikice"), tone: "neutral" },
    { label: getCopy("System alerts", "Garga\u0257in tsarin"), value: data.counts.systemAlerts, detail: getCopy("Health checks pending", "Duba lafiyar tsarin na jira"), tone: "neutral" }
  ])}

      <div class="dash-overview-grid">
        ${renderPanel({
    eyebrow: getCopy("Approvals", "Amincewa"),
    title: getCopy("Priority queues", "Layukan da suka fi muhimmanci"),
    action: { label: getCopy("Review vendors", "Duba dillalai"), route: "admin/vendors" },
    body: `
            <div class="dash-queue-grid">
              <article>
                <span>${getCopy("Vendor approvals", "Amincewa da dillalai")}</span>
                <strong>${data.counts.pendingVendorApprovals}</strong>
                <small>${getCopy("New sellers waiting for review", "Sabbin masu siyarwa na jiran duba")}</small>
              </article>
              <article>
                <span>${getCopy("Product moderation", "Duba kayan")}</span>
                <strong>${data.counts.pendingProductApprovals}</strong>
                <small>${getCopy("Listings waiting for catalog approval", "Kayan da ke jiran amincewa a cikin jerin")}</small>
              </article>
              <article>
                <span>${getCopy("Payout requests", "Bu\u0199atun biya")}</span>
                <strong>${data.payouts.filter((payout) => payout.status === "pending").length}</strong>
                <small>${getCopy("Vendor settlement decisions", "Yanke shawara kan biyan dillalai")}</small>
              </article>
            </div>
            <div class="dash-legacy-queues">
              <div class="vendor-approval-list" id="vendorApprovals"></div>
              <div class="product-moderation-list" id="productModeration"></div>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Finance", "Ku\u0257i"),
    title: getCopy("Revenue and payment control", "Kula da ku\u0257in shiga da biyan ku\u0257i"),
    action: { label: getCopy("Payments", "Biyan ku\u0257i"), route: "admin/payments" },
    body: `
            <div class="dash-money-stack">
              <article><span>${getCopy("Paid volume", "Adadin da aka biya")}</span><strong>${renderMoney(data.revenue.paid)}</strong></article>
              <article><span>${getCopy("Pending", "Jira")}</span><strong>${renderMoney(data.revenue.pending)}</strong></article>
              <article><span>${getCopy("Refunded", "An mayar da ku\u0257i")}</span><strong>${renderMoney(data.revenue.refunded)}</strong></article>
              <article><span>${getCopy("Commission", "Kwamiti")}</span><strong>${renderMoney(data.revenue.commission)}</strong></article>
            </div>
            ${renderMiniRows(
      [...failedPayments, ...pendingPayments].slice(0, 5).map((payment) => ({
        title: payment.reference ?? payment.id,
        meta: `${payment.orderId} - ${payment.method ?? getCopy("payment", "biya")} - ${formatDate(payment.createdAt)}`,
        value: renderMoney(payment.amount),
        status: payment.status
      })),
      { title: getCopy("No payment exceptions", "Babu matsalolin biya"), body: getCopy("Pending, failed, and refunded payment actions will appear here.", "Ayyukan biya da ke jira, wa\u0257anda suka gaza, da wa\u0257anda aka mayar da su za su bayyana a nan.") }
    )}
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Orders", "Ododi"),
    title: getCopy("Recent platform activity", "Ayyukan dandali na kwanan nan"),
    action: { label: getCopy("Orders", "Ododi"), route: "admin/orders" },
    body: renderMiniRows(
      recentOrders.map((order) => ({
        title: order.id,
        meta: `${"customerName" in order ? order.customerName : order.customerPhone ?? getCopy("Customer", "Kwastoma")} - ${formatDate(order.createdAt)}`,
        value: renderMoney(order.subtotal),
        status: order.status
      })),
      { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here once checkout starts.", "Ododi na kwastoma za su bayyana a nan da zarar biyan ku\u0257i ya fara.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Catalog", "Jerin kaya"),
    title: getCopy("Products, categories, and reports", "Kaya, rukunai, da rahotanni"),
    action: { label: getCopy("Reports", "Rahotanni"), route: "admin/reports" },
    body: `
            <div class="dash-action-stack">
              <a class="dash-command-card" href="#admin/products" data-route="admin/products">
                <strong>${getCopy("Product control", "Kula da kaya")}</strong>
                <span>${data.counts.products} ${getCopy("products across approved, pending, hidden, and rejected states.", "kaya a cikin yanayin da aka amince, na jira, \u0253oye, da wa\u0257anda aka \u0199i.")}</span>
              </a>
              <a class="dash-command-card" href="#admin/categories" data-route="admin/categories">
                <strong>${getCopy("Categories", "Rukunai")}</strong>
                <span>${getCopy("Manage bilingual taxonomy, search terms, and category merchandising.", "Kula da rarrabuwar harsuna biyu, kalmomi na bincike, da siyar da rukunai.")}</span>
              </a>
              <a class="dash-command-card" href="#admin/reports" data-route="admin/reports">
                <strong>${getCopy("Growth reports", "Rahotannin girma")}</strong>
                <span>${getCopy("Track customer growth, vendor growth, popular searches, and best sellers.", "Bi diddigin girmar kwastoma, girmar dillalai, bincike na yau da kullum, da mafi siyarwa.")}</span>
              </a>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Risk", "Ha\u0257ari"),
    title: getCopy("Reviews, disputes, and audit trail", "Ra'ayoyi, rikice-rikice, da tarihin aiki"),
    action: { label: getCopy("Audit logs", "Tarihin aiki"), route: "admin/audit-logs" },
    body: `
            ${renderMiniRows(
      data.reviews.filter((review) => !review.hidden).slice(0, 5).map((review) => ({
        title: `${review.rating}/5 - ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
        meta: review.comment,
        status: "visible"
      })),
      { title: getCopy("No visible review risks", "Babu ha\u0257arin ra'ayoyi da ake gani"), body: getCopy("Review moderation and dispute queues will appear here.", "Duba ra'ayoyi da layukan rikice-rikice za su bayyana a nan.") }
    )}
            <div class="dash-system-list">
              <article><strong>${getCopy("Disputes", "Rikice-rikice")}</strong><span>${getCopy("Endpoint required: /admin/disputes", "Ana bu\u0199atar hanyar: /admin/disputes")}</span></article>
              <article><strong>${getCopy("Audit logs", "Tarihin aiki")}</strong><span>${getCopy("Endpoint required: /admin/audit-logs", "Ana bu\u0199atar hanyar: /admin/audit-logs")}</span></article>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Infrastructure", "Ababen more rayuwa"),
    title: getCopy("System health", "Lafiyar tsarin"),
    action: { label: getCopy("Health", "Lafiya"), route: "admin/system-health" },
    body: `
            <div class="dash-health-grid">
              <article data-state="ok"><strong>API</strong><span>${getCopy("Health endpoint available", "Hanyar lafiya tana akwai")}</span></article>
              <article data-state="ok"><strong>${getCopy("Database", "Bayanan")}</strong><span>${getCopy("Reported by /api/health", "An ruwaito ta /api/health")}</span></article>
              <article data-state="pending"><strong>${getCopy("Blob storage", "Ajiyar fayiloli")}</strong><span>${getCopy("Add admin health probe", "\u0198ara binciken lafiyar admin")}</span></article>
              <article data-state="pending"><strong>${getCopy("Email", "Imel")}</strong><span>${getCopy("Add delivery provider status", "\u0198ara matsayin mai isar da imel")}</span></article>
            </div>
            ${renderEmptyState(getCopy("No critical alerts", "Babu garga\u0257i mai mahimmanci"), getCopy("System alerts will show here once health probes and logging are connected.", "Garga\u0257in tsarin za su bayyana a nan da zarar an ha\u0257a binciken lafiya da yin log."))}
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Legacy operations", "Ayyukan da suka gabata"),
    title: getCopy("Existing admin controls", "Madafun admin da ake da su"),
    className: "dash-panel-wide",
    body: `
            <div class="dash-legacy-admin-grid">
              <div hidden>
                <span id="totalSearches"></span>
                <span id="failedSearches"></span>
                <span id="savedVendors"></span>
                <span id="topDemand"></span>
              </div>
              <div class="record-list" id="paymentStatus"></div>
              <div class="withdrawal-list" id="withdrawalQueue"></div>
              <div class="record-list" id="orderRecords"></div>
              <div class="review-moderation-list" id="reviewModeration"></div>
              <div id="vendorSubscriptionSummary"></div>
              <div id="advancedAnalytics"></div>
              <div id="phaseThreeControls"></div>
              <div id="popularSearches" hidden></div>
              <div id="failedSearchList" hidden></div>
              <div id="demandTrends" hidden></div>
              <table hidden><tbody id="searchHistoryTable"></tbody></table>
            </div>
          `
  })}
      </div>
    </div>
  `;
}

// src/i18n/index.ts
var _lang = "en";
function setI18nLang(lang) {
  _lang = lang;
}
function applyLanguageToDOM(lang) {
  _lang = lang;
  document.querySelectorAll("[data-en][data-ha]").forEach((node) => {
    if (node.matches(".sidebar-nav a, .sidebar-vendor-cta")) return;
    node.textContent = node.dataset[lang] ?? "";
  });
  document.querySelectorAll("[data-alt-en][data-alt-ha]").forEach((node) => {
    node.alt = lang === "en" ? node.dataset.altEn ?? "" : node.dataset.altHa ?? "";
  });
  document.querySelectorAll("[data-aria-en][data-aria-ha]").forEach((node) => {
    node.setAttribute("aria-label", lang === "en" ? node.dataset.ariaEn ?? "" : node.dataset.ariaHa ?? "");
  });
  document.querySelectorAll("[data-placeholder-en][data-placeholder-ha]").forEach((node) => {
    node.placeholder = lang === "en" ? node.dataset.placeholderEn ?? "" : node.dataset.placeholderHa ?? "";
  });
}

// node_modules/@vercel/analytics/dist/index.mjs
var initQueue = () => {
  if (window.va) return;
  window.va = function a(...params) {
    if (!window.vaq) window.vaq = [];
    window.vaq.push(params);
  };
};
var name = "@vercel/analytics";
var version = "2.0.1";
function isBrowser() {
  return typeof window !== "undefined";
}
function detectEnvironment() {
  try {
    const env = "development";
    if (env === "development" || env === "test") {
      return "development";
    }
  } catch {
  }
  return "production";
}
function setMode(mode = "auto") {
  if (mode === "auto") {
    window.vam = detectEnvironment();
    return;
  }
  window.vam = mode;
}
function getMode() {
  const mode = isBrowser() ? window.vam : detectEnvironment();
  return mode || "production";
}
function isDevelopment() {
  return getMode() === "development";
}
function getScriptSrc(props) {
  if (props.scriptSrc) {
    return makeAbsolute(props.scriptSrc);
  }
  if (isDevelopment()) {
    return "https://va.vercel-scripts.com/v1/script.debug.js";
  }
  if (props.basePath) {
    return makeAbsolute(`${props.basePath}/insights/script.js`);
  }
  return "/_vercel/insights/script.js";
}
function loadProps(explicitProps, confString) {
  var _a;
  let props = explicitProps;
  if (confString) {
    try {
      props = {
        ...(_a = JSON.parse(confString)) == null ? void 0 : _a.analytics,
        ...explicitProps
      };
    } catch {
    }
  }
  setMode(props.mode);
  const dataset = {
    sdkn: name + (props.framework ? `/${props.framework}` : ""),
    sdkv: version
  };
  if (props.disableAutoTrack) {
    dataset.disableAutoTrack = "1";
  }
  if (props.viewEndpoint) {
    dataset.viewEndpoint = makeAbsolute(props.viewEndpoint);
  }
  if (props.eventEndpoint) {
    dataset.eventEndpoint = makeAbsolute(props.eventEndpoint);
  }
  if (props.sessionEndpoint) {
    dataset.sessionEndpoint = makeAbsolute(props.sessionEndpoint);
  }
  if (isDevelopment() && props.debug === false) {
    dataset.debug = "false";
  }
  if (props.dsn) {
    dataset.dsn = props.dsn;
  }
  if (props.endpoint) {
    dataset.endpoint = props.endpoint;
  } else if (props.basePath) {
    dataset.endpoint = makeAbsolute(`${props.basePath}/insights`);
  }
  return {
    beforeSend: props.beforeSend,
    src: getScriptSrc(props),
    dataset
  };
}
function makeAbsolute(url) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/") ? url : `/${url}`;
}
function inject(props = {
  debug: true
}, confString) {
  var _a;
  if (!isBrowser()) return;
  const { beforeSend, src, dataset } = loadProps(props, confString);
  initQueue();
  if (beforeSend) {
    (_a = window.va) == null ? void 0 : _a.call(window, "beforeSend", beforeSend);
  }
  if (document.head.querySelector(`script[src*="${src}"]`)) return;
  const script = document.createElement("script");
  script.src = src;
  for (const [key, value] of Object.entries(dataset)) {
    script.dataset[key] = value;
  }
  script.defer = true;
  script.onerror = () => {
    const errorMessage = isDevelopment() ? "Please check if any ad blockers are enabled and try again." : "Be sure to enable Web Analytics for your project and deploy again. See https://vercel.com/docs/analytics/quickstart for more information.";
    console.log(
      `[Vercel Web Analytics] Failed to load script from ${src}. ${errorMessage}`
    );
  };
  document.head.appendChild(script);
}

// src/frontend/app.ts
var routes = /* @__PURE__ */ new Set(["home", "customer", "catalog", "payments", "vendor", "orders", "admin", "login", "signup", "sell"]);
var AUTH_ROUTES = /* @__PURE__ */ new Set(["login", "signup"]);
var SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";
var VENDOR_IMAGE_MAX_SOURCE_BYTES = 8e6;
var VENDOR_IMAGE_MAX_DATA_URL_LENGTH = 7e5;
var VENDOR_IMAGE_MAX_EDGE = 1400;
var VENDOR_IMAGE_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];
var VENDOR_IMAGE_EDGE_STEPS = [1400, 1200, 1e3, 800, 640];
var VENDOR_PRODUCT_CATEGORIES = /* @__PURE__ */ new Set(["food", "fashion", "children", "essentials"]);
function getCurrentRoute() {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  if (raw.startsWith("p/")) return raw;
  if (raw.startsWith("v/")) return raw;
  if (getDashboardRoute(raw)) return raw;
  return routes.has(raw) ? raw : "home";
}
function getVisitorRole() {
  return state.currentUser?.role ?? "guest";
}
function getDefaultRouteForRole(role = getVisitorRole()) {
  return getDefaultDashboardRoute(role);
}
function canAccessRoute(route) {
  const role = getVisitorRole();
  const dashboardRoute = getDashboardRoute(route);
  if (dashboardRoute) return dashboardRoute.role === role;
  if (route === "admin") return role === "admin";
  if (route === "customer") return role === "customer";
  if (route === "orders") return role === "customer";
  if (route.startsWith("p/") || route.startsWith("v/") || route === "sell") return true;
  if (AUTH_ROUTES.has(route)) return role === "guest";
  return true;
}
function setRoute(route = getCurrentRoute()) {
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
  document.querySelectorAll("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === pageRoute;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const linkRoute = link.dataset.route ?? "";
    const isActive = linkRoute === nextRoute || linkRoute === pageRoute || nextRoute.startsWith(`${linkRoute}/`);
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
  document.body.classList.toggle("is-auth-route", AUTH_ROUTES.has(nextRoute));
  document.body.classList.toggle("on-home", pageRoute === "home");
  const currentRole = getVisitorRole();
  document.body.classList.toggle("is-guest", currentRole === "guest");
  document.body.classList.toggle("is-customer", currentRole === "customer");
  document.body.classList.toggle("is-vendor", currentRole === "vendor");
  document.body.classList.toggle("is-admin", currentRole === "admin");
  if (pageRoute === "product") renderProductPage(nextRoute.replace("p/", ""));
  if (pageRoute === "vendorpage") renderVendorStorefront(nextRoute.replace("v/", ""));
  renderActiveDashboardRoute(nextRoute);
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
}
function syncRoleNavigation() {
  const role = getVisitorRole();
  const user = state.currentUser;
  const roleLabel = document.querySelector("#sidebarRoleName");
  const workspaceTitle = document.querySelector("#sidebarWorkspaceTitle");
  const roleHint = document.querySelector("#sidebarRoleHint");
  const accountName = document.querySelector("#sidebarAccountName");
  const accountMeta = document.querySelector("#sidebarAccountMeta");
  const accountAvatar = document.querySelector("#sidebarAccountAvatar");
  const sidebarCartCount = document.querySelector("#sidebarCartCount");
  const sidebarWishlistCount = document.querySelector("#sidebarWishlistCount");
  const profile = {
    guest: {
      label: "Guest",
      title: "Marketplace",
      hint: "Sign in to unlock your dashboard.",
      meta: "Sign in with mobile number",
      avatar: "?"
    },
    customer: {
      label: "Customer",
      title: "Customer workspace",
      hint: "Orders, cart, wishlist, and checkout.",
      meta: user?.phone ?? "Customer account",
      avatar: user?.name?.slice(0, 1).toUpperCase() || "C"
    },
    vendor: {
      label: "Vendor",
      title: "Seller workspace",
      hint: user?.vendorStatus === "approved" ? "Store approved and ready." : "Approval status is pending.",
      meta: user?.vendorStatus ? `Vendor: ${user.vendorStatus}` : "Vendor account",
      avatar: user?.name?.slice(0, 1).toUpperCase() || "V"
    },
    admin: {
      label: "Admin",
      title: "Operations control",
      hint: "Approvals, finance, orders, and risk.",
      meta: "Verified admin number",
      avatar: "A"
    }
  }[role] ?? {
    label: "Guest",
    title: "Marketplace",
    hint: "Sign in to unlock your dashboard.",
    meta: "Sign in with mobile number",
    avatar: "?"
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
  document.querySelectorAll("[data-roles]").forEach((node) => {
    const allowed = (node.dataset.roles || "").split(/\s+/).filter(Boolean);
    node.hidden = !allowed.includes(role);
  });
  if (!canAccessRoute(getCurrentRoute())) {
    setRoute(getDefaultRouteForRole(role));
  }
}
function openSidebar() {
  elements.appSidebar.classList.add("is-open");
  elements.sidebarOverlay.hidden = false;
  document.body.classList.add("sidebar-open");
  elements.sidebarClose.focus();
}
function closeSidebar() {
  elements.appSidebar.classList.remove("is-open");
  elements.sidebarOverlay.hidden = true;
  document.body.classList.remove("sidebar-open");
}
function setSidebarCollapsed(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  elements.sidebarCollapse.setAttribute("aria-pressed", String(collapsed));
  elements.sidebarCollapse.setAttribute(
    "aria-label",
    collapsed ? getCopy("Expand sidebar", "Bude gefen menu") : getCopy("Collapse sidebar", "Takaita gefen menu")
  );
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "true" : "false");
}
function syncSidebarLabels() {
  document.querySelectorAll(".sidebar-nav a[data-en][data-ha]").forEach((link) => {
    const label = link.dataset[state.language] || "";
    const text = link.querySelector(".sidebar-title");
    if (text) text.textContent = label;
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
  });
  document.querySelectorAll(".sidebar-vendor-cta[data-en][data-ha]").forEach((link) => {
    const label = link.dataset[state.language] || "";
    const text = link.querySelector(".sidebar-text");
    if (text) text.textContent = label;
    link.setAttribute("aria-label", label);
    link.setAttribute("title", label);
  });
}
function renderProductResults(products2 = state.lastResults) {
  const { visibleProducts, hasMore } = paginateProducts(products2, state.visibleProductCount);
  elements.resultsGrid.innerHTML = visibleProducts.map(renderProductCard).join("");
  elements.emptyState.hidden = products2.length > 0;
  elements.loadMoreProducts.hidden = !hasMore;
  syncAllWishlistButtons();
}
function renderLoadingProducts() {
  elements.resultStatus.hidden = false;
  elements.resultStatus.textContent = getCopy("Loading products...", "Ana loda kaya...");
  elements.resultsGrid.innerHTML = renderProductSkeletons();
  elements.emptyState.hidden = true;
  elements.loadMoreProducts.hidden = true;
}
function renderCatalogPreview(resetPage = true) {
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
async function refreshLiveCatalog() {
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
    renderAdminDashboard2();
  } catch {
  }
}
async function refreshLiveAdminDashboard() {
  if (state.currentUser?.role !== "admin" || !state.currentUser.token) return;
  try {
    await Promise.all([
      refreshLiveAdminQueues(),
      fetchLiveAdminData()
    ]);
    if (state.lastQuery) {
      state.lastResults = getSearchResults(state.lastQuery);
      updateResultCopy(state.lastQuery, state.lastResults);
      renderProductResults();
    } else {
      renderCatalogPreview(false);
    }
    renderAdminDashboard2();
  } catch (error) {
    console.warn("[KanoMart] Live admin sync failed \u2014 showing local data:", error);
    renderAdminDashboard2();
  }
}
function renderProductPage(productId) {
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
  const name2 = escapeHtml(product.name[lang]);
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
        <small>\u2605 ${profile.rating.toFixed(1)} \xB7 ${profile.totalOrders} ${getCopy("orders", "oda")} \xB7 ${getCopy("Verified since", "Tabbatacce tun")} ${profile.since}</small>
      </div>
      <a href="#v/${encodeURIComponent(product.vendor)}" data-route-vendor="${encodeURIComponent(product.vendor)}" class="pdp-vendor-link">${getCopy("Visit store \u2192", "Ziyarci shago \u2192")}</a>
    </div>` : "";
  const imgHtml = product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${name2}" class="pdp-main-img" />` : `<div class="pdp-main-img pdp-img-placeholder" style="--accent:${product.accent ?? "#176b4d"}">${escapeHtml(product.subcategory[lang])}</div>`;
  section.innerHTML = `
    <div class="pdp-breadcrumb">
      <a href="#home" data-route="home">${getCopy("Home", "Gida")}</a>
      <span aria-hidden="true">\u203A</span>
      <a href="#catalog" data-route="catalog">${getCopy("Browse", "Bincika")}</a>
      <span aria-hidden="true">\u203A</span>
      <strong>${name2}</strong>
    </div>
    <div class="pdp-body">
      <div class="pdp-gallery">${imgHtml}</div>
      <div class="pdp-info">
        <small class="pdp-vendor-meta">${vendor} \xB7 ${area}</small>
        <h1 class="pdp-name">${name2}</h1>
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
  section.querySelector("[data-pdp-add]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!state.currentUser) {
      openAuthModal();
      return;
    }
    addToCart(btn.dataset.pdpAdd);
    elements.cartCountEl.textContent = String(state.cartCount);
    btn.textContent = getCopy("Added!", "An saka!");
    window.setTimeout(() => {
      btn.textContent = getCopy("Add to cart", "Saka a kwando");
    }, 1400);
  });
  section.querySelector("[data-pdp-wish]")?.addEventListener("click", (e) => {
    const btn = e.currentTarget;
    if (!state.currentUser) {
      openAuthModal();
      return;
    }
    toggleWishlist(btn.dataset.pdpWish, product.name[lang]);
    syncWishlistCount();
    const now = typeof isWishlisted === "function" ? isWishlisted(product.id) : false;
    btn.classList.toggle("is-wishlisted", now);
    btn.setAttribute("aria-pressed", String(now));
  });
  section.querySelector("[data-route-vendor]")?.addEventListener("click", (e) => {
    e.preventDefault();
    const slug = e.currentTarget.dataset.routeVendor || "";
    window.location.hash = `v/${slug}`;
    setRoute(`v/${slug}`);
  });
}
function renderVendorStorefront(vendorSlug) {
  const section = document.getElementById("vendorPage");
  if (!section) return;
  const decodedSlug = decodeURIComponent(vendorSlug);
  const profile = vendorProfiles[decodedSlug];
  const products2 = getCatalogProducts().filter((p) => p.vendor === decodedSlug);
  const lang = state.language;
  if (!profile && products2.length === 0) {
    section.innerHTML = `
      <div class="pdp-not-found">
        <h1>${getCopy("Store not found", "Ba a sami shago ba")}</h1>
        <a href="#catalog" data-route="catalog">${getCopy("Back to catalog", "Koma kasuwa")}</a>
      </div>`;
    return;
  }
  const vendorName = escapeHtml(profile?.name ?? decodedSlug);
  const rating = profile ? `\u2605 ${profile.rating.toFixed(1)}` : "";
  const orders = profile ? `${profile.totalOrders} ${getCopy("orders", "oda")}` : "";
  const since = profile ? `${getCopy("Verified since", "Tabbatacce tun")} ${profile.since}` : "";
  const productsHtml = products2.length ? products2.map(renderProductCard).join("") : `<p class="muted">${getCopy("No products listed yet.", "Babu kaya da aka saka tukuna.")}</p>`;
  section.innerHTML = `
    <div class="pdp-breadcrumb">
      <a href="#home" data-route="home">${getCopy("Home", "Gida")}</a>
      <span aria-hidden="true">\u203A</span>
      <span>${getCopy("Vendors", "Dillalai")}</span>
      <span aria-hidden="true">\u203A</span>
      <strong>${vendorName}</strong>
    </div>
    <div class="vendor-storefront-header">
      <div class="vsf-avatar">${escapeHtml(vendorName.slice(0, 2).toUpperCase())}</div>
      <div class="vsf-info">
        <h1>${vendorName}</h1>
        <div class="vsf-meta">${[rating, orders, since].filter(Boolean).join(" \xB7 ")}</div>
        ${profile?.area ? `<small class="muted">${escapeHtml(profile.area ?? "")}</small>` : ""}
      </div>
    </div>
    <div class="vsf-products">
      <h2>${getCopy("Products", "Kaya")} <span class="vsf-count">(${products2.length})</span></h2>
      <div class="product-grid" id="vendorStorefrontGrid">${productsHtml}</div>
    </div>`;
  syncAllWishlistButtons();
}
function renderActiveDashboardRoute(route = getCurrentRoute()) {
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
    renderAdminDashboard2(route);
  }
}
function renderCustomerDashboard(route = getCurrentRoute()) {
  const user = state.currentUser;
  if (!user || user.role !== "customer") return;
  const section = document.querySelector("#customer");
  if (!section) return;
  section.innerHTML = renderCustomerOverview(user, route);
}
function renderOrdersPage() {
  const ordersList = document.querySelector("#myOrdersList");
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
function renderLanguageSensitiveViews() {
  syncUserButton();
  syncRoleNavigation();
  renderActiveDashboardRoute();
  renderOrdersPage();
  renderCartPanel();
  const userOrdersList = document.querySelector("#userOrdersList");
  if (userOrdersList) userOrdersList.innerHTML = renderOrdersPanel();
  if (document.querySelector("#wishlistModal")) openWishlistPanel();
}
async function refreshLiveVendorDashboard() {
  if (state.currentUser?.role !== "vendor" || !state.currentUser.token) return;
  try {
    const [, , application] = await Promise.all([
      refreshLiveVendorProducts(),
      fetchLiveVendorData(),
      fetchLiveVendorApplication()
    ]);
    if (application?.status) syncCurrentVendorStatus(application.status);
    renderVendorDashboard();
  } catch {
  }
}
function performSearch(rawQuery) {
  const query = rawQuery.trim();
  if (!query) return;
  state.lastQuery = query;
  state.visibleProductCount = PRODUCT_PAGE_SIZE;
  renderLoadingProducts();
  document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => {
    const results = getCachedSearchResults(query);
    saveSearch(query, results);
    state.lastResults = results;
    updateResultCopy(query, results);
    renderProductResults(results);
    renderAdminDashboard2();
  }, 180);
}
function setLanguage(language) {
  state.language = language;
  localStorage.setItem(storageKeys.language, language);
  document.documentElement.lang = language;
  document.title = getCopy(
    "Kano Mart | Local Marketplace for Kano",
    "Kano Mart | Kasuwar Kano ta yanar gizo"
  );
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
  applyLanguageToDOM(language);
  syncSidebarLabels();
}
function handleVendorRequestSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.vendorForm);
  const businessName = sanitizePlainText(String(formData.get("businessName") || ""), 80);
  const phone = sanitizePlainText(String(formData.get("phone") || ""), 24);
  const area = sanitizePlainText(String(formData.get("area") || ""), 80);
  const category = sanitizePlainText(String(formData.get("category") || ""), 40);
  if (!businessName) {
    elements.vendorMessage.textContent = getCopy("Business name is required.", "Ana bu\u0199atar sunan kasuwanci.");
    return;
  }
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    elements.vendorMessage.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci.");
    return;
  }
  if (!area) {
    elements.vendorMessage.textContent = getCopy("Market area is required.", "Ana bu\u0199atar yankin kasuwa.");
    return;
  }
  if (!category) {
    elements.vendorMessage.textContent = getCopy("Please select a category.", "Da fatan za a za\u0253i rukuni.");
    return;
  }
  elements.vendorMessage.textContent = getCopy(
    "Complete your sign-up to submit the request.",
    "Kammala rajistarka domin tura bu\u0199atar."
  );
  openAuthModal({ phone, role: "vendor", businessName, area, category });
}
function createVendorFormError(code) {
  const error = new Error(code);
  error.name = "VendorProductFormError";
  return error;
}
function readImageAsDataUrl(file) {
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
function loadImageElement(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(createVendorFormError("image_decode_failed")), { once: true });
    image.src = dataUrl;
  });
}
function normalizeVendorImageName(fileName, mimeType) {
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const base = sanitizePlainText(fileName.replace(/\.[^.]+$/, ""), 70).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${base || "product-image"}.${ext}`;
}
function drawVendorImage(image, maxEdge, quality) {
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
async function prepareVendorProductImage(file) {
  const allowedMimeTypes = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!allowedMimeTypes.has(file.type)) throw createVendorFormError("unsupported_image");
  const sourceDataUrl = await readImageAsDataUrl(file);
  if (sourceDataUrl.length <= VENDOR_IMAGE_MAX_DATA_URL_LENGTH) {
    const mimeType = file.type;
    return {
      dataUrl: sourceDataUrl,
      fileName: normalizeVendorImageName(file.name, mimeType),
      mimeType,
      originalBytes: file.size,
      finalBytes: sourceDataUrl.length,
      compressed: false
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
          compressed: true
        };
      }
    }
  }
  throw createVendorFormError("compressed_image_too_large");
}
function getEffectiveVendorStatus() {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return "pending";
  const application = getLiveVendorApplication();
  const localVendor = findVendorByPhone(user.phone);
  return application?.status ?? user.vendorStatus ?? localVendor?.status ?? "pending";
}
function syncCurrentVendorStatus(status) {
  const user = state.currentUser;
  if (!user || user.role !== "vendor" || user.vendorStatus === status) return;
  user.vendorStatus = status;
  localStorage.setItem(storageKeys.session, JSON.stringify(user));
  syncRoleNavigation();
}
function syncSessionFromApiUser(user) {
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
    createdAt: user.createdAt ?? current.createdAt
  };
  localStorage.setItem(storageKeys.session, JSON.stringify(state.currentUser));
  syncUserButton();
  syncRoleNavigation();
  renderActiveDashboardRoute();
}
function setVendorProductMessage(message, text, stateName = "info") {
  if (!message) return;
  message.textContent = text;
  message.dataset.state = stateName;
}
function getVendorGateCopy(status, hasToken) {
  if (!hasToken) {
    return {
      title: getCopy("Sign in again to submit products", "Sake shiga domin tura kaya"),
      body: getCopy(
        "Your session is missing live API access. Sign out and sign in again before adding products.",
        "Zaman shiga bai da damar API live. Fita ka sake shiga kafin saka kaya."
      ),
      submit: getCopy("Sign in required", "Ana bukatar shiga")
    };
  }
  if (status === "approved") {
    return {
      title: getCopy("Store approved", "An amince da shago"),
      body: getCopy(
        "New products are submitted to admin review before they appear in the customer catalog.",
        "Sabbin kaya za su je wajen admin kafin su bayyana a kasuwar kwastoma."
      ),
      submit: getCopy("Add product", "Saka kaya")
    };
  }
  if (status === "rejected") {
    return {
      title: getCopy("Store not approved", "Ba a amince da shago ba"),
      body: getCopy(
        "Your vendor application was not approved. Contact support before adding products.",
        "Ba a amince da rajistar dillali ba. Tuntubi tallafi kafin saka kaya."
      ),
      submit: getCopy("Store not approved", "Ba a amince ba")
    };
  }
  return {
    title: getCopy("Vendor approval pending", "Ana jiran amincewar dillali"),
    body: getCopy(
      "Admin must approve your store before products can be submitted. You can browse the dashboard while waiting.",
      "Admin sai ya amince da shagonsa kafin a tura kaya. Za ka iya duba dashboard yayin jira."
    ),
    submit: getCopy("Waiting for approval", "Ana jiran amincewa")
  };
}
function renderVendorProductGate() {
  const form = document.querySelector("#vendorProductForm");
  const gate = document.querySelector("#vendorProductGate");
  const message = document.querySelector("#vendorProductMessage");
  const submit = form?.querySelector('button[type="submit"]') ?? null;
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
  form.querySelectorAll("input, select, button").forEach((control) => {
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
function renderVendorDashHeader() {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const vendor = findVendorByPhone(user.phone);
  const businessName = vendor?.businessName || user.name;
  const status = getEffectiveVendorStatus();
  const nameEl = document.querySelector("#vendorDashBusinessName");
  if (nameEl) nameEl.textContent = businessName;
  const badge = document.querySelector("#vendorStatusBadge");
  if (badge) {
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.dataset.status = status;
  }
}
function renderVendorDashboard(route = getCurrentRoute()) {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const dashboard = document.querySelector(".vendor-dashboard");
  if (!dashboard) return;
  dashboard.innerHTML = renderVendorOverview(user, route);
  renderVendorProducts();
  renderVendorProductGate();
  renderVendorCommerce();
}
function renderVendorProducts() {
  const list = document.querySelector("#vendorProductsList");
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
  list.innerHTML = vendorProducts.map((product) => {
    const modStatus = product.moderationStatus;
    const listStatus = product.listingStatus ?? "active";
    const moderationBadge = modStatus === "pending" ? `<span class="status-pill status-pending-review">${getCopy("Awaiting review", "Ana duba")}</span>` : modStatus === "rejected" ? `<span class="status-pill status-rejected">${getCopy("Rejected", "An ki")}</span>` : modStatus === "hidden" ? `<span class="status-pill status-hidden">${getCopy("Hidden by admin", "Admin ya \u0253oye")}</span>` : null;
    const listingBadge = moderationBadge ? "" : (() => {
      const label = listStatus === "active" ? getCopy("Active", "Yana aiki") : listStatus === "out_of_stock" ? getCopy("Out of stock", "Ya kare") : getCopy("Taken down", "An cire");
      return `<span class="status-pill status-${escapeHtml(listStatus)}">${escapeHtml(label)}</span>`;
    })();
    const actions = moderationBadge ? `<span class="muted small">${getCopy("Pending admin approval", "Admin yana duba tukuna")}</span>` : listStatus === "active" ? `
            <button type="button" data-vendor-product-action="out_of_stock" data-vendor-product-id="${escapeHtml(product.id)}">
              ${getCopy("Out of stock", "Ya kare")}
            </button>
            <button type="button" data-vendor-product-action="taken_down" data-vendor-product-id="${escapeHtml(product.id)}">
              ${getCopy("Take down", "Cire")}
            </button>
          ` : `
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
  }).join("");
}
function renderVendorCommerce() {
  const list = document.querySelector("#vendorCommerceList");
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
        ${canMarkReady ? `<button type="button" data-vendor-order-ready="${escapeHtml(order.id)}">${getCopy("Mark ready", "Yi alamar a shirye")}</button>` : `<span class="status-pill status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>`}
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
        ${notifications.length ? notifications.map(
    (notification) => `
                    <div class="notification-row">
                      <strong>${escapeHtml(notification.title)}</strong>
                      <span>${escapeHtml(notification.message)}</span>
                      <small>${escapeHtml(formatDate(notification.createdAt))}</small>
                    </div>
                  `
  ).join("") : `<p class="muted">${getCopy("No vendor notifications yet.", "Babu sanarwar dillali tukuna.")}</p>`}
      </div>
    </div>
  `;
}
function renderAdminDashboard2(route = getCurrentRoute()) {
  if (state.currentUser?.role !== "admin") {
    renderAdminDashboard();
    return;
  }
  if (elements.adminContent) {
    elements.adminContent.innerHTML = renderAdminOverview(route);
    refreshLegacyAdminElementRefs();
  }
  renderAdminDashboard();
}
function refreshLegacyAdminElementRefs() {
  const assign = (key, selector) => {
    const node = document.querySelector(selector);
    if (node) {
      elements[String(key)] = node;
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
function setVendorProductFormBusy(form, busy, label) {
  const submit = form.querySelector('button[type="submit"]');
  form.querySelectorAll("input, select, button").forEach((control) => {
    control.disabled = busy;
  });
  if (submit) {
    submit.setAttribute("aria-busy", String(busy));
    submit.textContent = busy ? label ?? getCopy("Submitting...", "Ana turawa...") : submit.dataset.idleText || getCopy("Add product", "Saka kaya");
  }
}
function firstValidationDetail(details) {
  if (!details || typeof details !== "object") return "";
  for (const value of Object.values(details)) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}
function getVendorProductErrorCopy(error) {
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
      const messages = {
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
        )
      };
      return messages[error.message] ?? getCopy("Could not prepare the image. Try another photo.", "Ba a iya shirya hoton ba. Gwada wani hoto.");
    }
    return error.message;
  }
  return getCopy("Could not add product. Check the details and try again.", "Ba a iya saka kaya ba. Duba bayanai ka sake gwadawa.");
}
async function handleVendorProductSubmit(event) {
  event.preventDefault();
  const form = event.target instanceof HTMLFormElement ? event.target : event.currentTarget instanceof HTMLFormElement ? event.currentTarget : null;
  const message = document.querySelector("#vendorProductMessage");
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
  const name2 = sanitizePlainText(String(data.get("productName") || ""), 90);
  const nameHa = sanitizePlainText(String(data.get("productNameHa") || ""), 90);
  const descriptionEn = sanitizePlainText(String(data.get("descriptionEn") || ""), 240);
  const descriptionHa = sanitizePlainText(String(data.get("descriptionHa") || ""), 240);
  const category = sanitizePlainText(String(data.get("productCategory") || "essentials"), 40);
  const rawPriceStr = String(data.get("productValue") ?? "").replace(/[^\d.]/g, "");
  const priceValue = rawPriceStr ? Number(rawPriceStr) : 0;
  const quantityAvailable = Number(data.get("quantityAvailable") || 0);
  if (name2.length < 2) {
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
  if (!(image instanceof File) || !image.name || image.size === 0) {
    setVendorProductMessage(message, getCopy(
      "Please choose a product image (JPEG, PNG, or WebP).",
      "Da fatan za a za\u0253i hoton kaya (JPEG, PNG, ko WebP)."
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
      name: name2,
      nameHa,
      descriptionEn,
      descriptionHa,
      priceValue,
      quantityAvailable,
      category,
      imageDataUrl: preparedImage.dataUrl
    };
    setVendorProductFormBusy(form, true, getCopy("Uploading...", "Ana lodawa..."));
    setVendorProductMessage(message, getCopy("Uploading image...", "Ana loda hoto..."), "info");
    const upload = await api.uploadVendorImage({
      fileName: preparedImage.fileName,
      mimeType: preparedImage.mimeType,
      dataUrl: preparedImage.dataUrl
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
      tags: [productInput.name, productInput.category, productInput.area]
    });
    form.reset();
    await Promise.all([refreshLiveCatalog(), refreshLiveVendorDashboard()]).catch(() => void 0);
    const compressionCopy = preparedImage.compressed ? getCopy(" Image optimized for upload.", " An rage hoton domin turawa.") : "";
    const currentMessage = document.querySelector("#vendorProductMessage") ?? message;
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
      duration: 3e3
    });
    renderVendorProducts();
    renderVendorProductGate();
    renderVendorCommerce();
    renderCatalogPreview();
    renderAdminDashboard2();
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
function applyLocalVendorDecision(id, action) {
  const vendor = reviewVendorRequest(
    id,
    action,
    action === "approved" ? "Approved from prototype admin dashboard" : "Rejected from prototype admin dashboard"
  );
  if (!vendor) return false;
  createNotification({
    audience: "vendor",
    recipient: vendor.businessName,
    title: action === "approved" ? "Vendor approved" : "Vendor rejected",
    message: `${vendor.businessName} was ${action}.`,
    type: "vendor"
  });
  renderAdminDashboard2();
  showToast({
    message: action === "approved" ? getCopy(`${vendor.businessName} approved.`, `An amince da ${vendor.businessName}.`) : getCopy(`${vendor.businessName} rejected.`, `An ki ${vendor.businessName}.`),
    type: action === "approved" ? "success" : "info"
  });
  return true;
}
function applyLocalProductDecision(productId, productAction) {
  const record = moderateProduct(productId, productAction, "Updated from prototype admin dashboard");
  if (!record) return false;
  createNotification({
    audience: "vendor",
    title: productAction === "approved" ? "Product approved" : "Product review updated",
    message: `Product ${productId} is now ${productAction}.`,
    type: "product"
  });
  if (state.lastQuery) {
    state.lastResults = getSearchResults(state.lastQuery);
    updateResultCopy(state.lastQuery, state.lastResults);
    renderProductResults();
  } else {
    renderCatalogPreview();
  }
  renderAdminDashboard2();
  renderVendorCommerce();
  showToast({
    message: getCopy("Product moderation updated.", "An sabunta duba kayan."),
    type: productAction === "approved" ? "success" : "info"
  });
  return true;
}
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(elements.searchInput.value);
});
document.addEventListener("click", (event) => {
  const button = event.target?.closest("[data-query-en][data-query-ha]");
  if (!button) return;
  const query = button.dataset[state.language === "ha" ? "queryHa" : "queryEn"] || "";
  elements.searchInput.value = query;
  window.location.hash = "catalog";
  setRoute("catalog");
  performSearch(query);
});
document.addEventListener("click", (event) => {
  const link = event.target?.closest("[data-route]");
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
document.querySelector("#sidebarAccountAction")?.addEventListener("click", openUserPanel);
elements.resultsGrid.addEventListener("click", (event) => {
  const target = event.target;
  const wishBtn = target?.closest("[data-wishlist]");
  if (wishBtn) {
    if (!state.currentUser) {
      openAuthModal();
      return;
    }
    const id = wishBtn.dataset.wishlist;
    const product = state.lastResults.find((p) => p.id === id);
    toggleWishlist(id, product?.name[state.language] ?? id);
    syncWishlistCount();
    syncRoleNavigation();
    return;
  }
  const addBtn = target?.closest("[data-add-to-cart]");
  if (addBtn) {
    if (!state.currentUser) {
      openAuthModal();
      return;
    }
    addToCart(addBtn.dataset.addToCart);
    elements.cartCountEl.textContent = String(state.cartCount);
    syncRoleNavigation();
    addBtn.textContent = getCopy("Added", "An saka");
    window.setTimeout(() => {
      addBtn.textContent = getCopy("Add", "Saka");
    }, 1200);
    return;
  }
  const card = target?.closest(".product-card");
  if (card?.dataset.productId) {
    const productId = card.dataset.productId;
    recordProductView(productId);
    renderAdminDashboard2();
    window.location.hash = `p/${productId}`;
    setRoute(`p/${productId}`);
  }
});
elements.cartItemsEl.addEventListener("click", (event) => {
  const target = event.target;
  const dec = target?.closest("[data-qty-dec]");
  const inc = target?.closest("[data-qty-inc]");
  const rem = target?.closest("[data-remove]");
  if (dec) updateQuantity(dec.dataset.qtyDec, -1);
  if (inc) updateQuantity(inc.dataset.qtyInc, 1);
  if (rem) removeFromCart(rem.dataset.remove);
});
document.querySelectorAll(".cart-button").forEach((button) => {
  button.addEventListener("click", () => {
    renderCartPanel();
    openCart();
  });
});
document.querySelectorAll(".wishlist-button").forEach((button) => {
  button.addEventListener("click", openWishlistPanel);
});
document.addEventListener("click", (event) => {
  const button = event.target?.closest("#customerCartBtn, #customerCartBtnSecondary");
  if (!button) return;
  renderCartPanel();
  openCart();
});
document.addEventListener("click", (event) => {
  const button = event.target?.closest("#customerWishlistBtn");
  if (!button) return;
  openWishlistPanel();
});
elements.cartOverlay.addEventListener("click", closeCart);
document.querySelector(".cart-close")?.addEventListener("click", closeCart);
elements.checkoutButton.addEventListener("click", () => {
  if (!state.currentUser) {
    openAuthModal();
    return;
  }
  closeCart();
  openCheckoutModal();
});
elements.languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language === "ha" ? "ha" : "en"));
});
elements.vendorForm.addEventListener("submit", handleVendorRequestSubmit);
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form?.id !== "vendorProductForm") return;
  void handleVendorProductSubmit(event);
});
document.addEventListener("click", (event) => {
  const button = event.target?.closest("[data-vendor-product-action]");
  if (!button?.closest("#vendorProductsList")) return;
  const productId = button?.dataset.vendorProductId;
  const action = button?.dataset.vendorProductAction;
  if (!productId || action !== "active" && action !== "out_of_stock" && action !== "taken_down") return;
  setVendorProductListingStatus(productId, action);
  renderVendorProducts();
  renderVendorProductGate();
  renderVendorCommerce();
  renderCatalogPreview(false);
  renderAdminDashboard2();
  showToast({
    message: action === "active" ? getCopy("Product restored to catalog.", "An mayar da kaya kasuwa.") : getCopy("Product removed from active catalog.", "An cire kaya daga kasuwa."),
    type: action === "active" ? "success" : "info"
  });
  if (state.currentUser?.token) {
    api.updateVendorProduct(productId, action).catch((error) => {
      showToast({ message: getVendorProductErrorCopy(error), type: "error", duration: 3500 });
    });
  }
});
document.addEventListener("click", (event) => {
  const button = event.target?.closest("[data-vendor-order-ready]");
  if (!button?.closest("#vendorCommerceList")) return;
  const orderId = button?.dataset.vendorOrderReady;
  if (!orderId) return;
  const order = advanceOrderStatus(orderId);
  renderVendorCommerce();
  renderAdminDashboard2();
  showToast({
    message: getCopy("Order marked ready for pickup or delivery.", "An nuna oda a shirye domin dauka ko kaiwa."),
    type: "success"
  });
});
elements.exportSearches.addEventListener("click", exportSearchHistory);
elements.clearSearches.addEventListener("click", clearPrototypeData);
elements.adminContent.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id === "commissionForm") {
    event.preventDefault();
    const data = new FormData(form);
    saveCommissionSettings({ defaultRate: Number(data.get("defaultRate") || 10) / 100 });
    renderAdminDashboard2();
    showToast({ message: getCopy("Commission settings saved.", "An ajiye saitin kwamishan."), type: "success" });
    return;
  }
  if (form.id === "promotionForm") {
    event.preventDefault();
    const data = new FormData(form);
    const target = sanitizePlainText(String(data.get("target") || ""), 80);
    const type = String(data.get("type") || "seasonal_campaign");
    const titleText = sanitizePlainText(String(data.get("title") || ""), 80);
    const discountPercent = Number(data.get("discountPercent") || 0) || void 0;
    createPromotion({
      title: titleText,
      type,
      discountPercent,
      code: type === "discount_code" ? target : void 0,
      vendor: type === "featured_vendor" ? target : void 0,
      productId: type === "featured_product" ? target : void 0,
      category: type === "seasonal_campaign" || type === "flash_sale" ? target.toLowerCase() : void 0
    });
    if (state.currentUser?.token) {
      api.createAdminPromotion({
        title: { en: titleText, ha: titleText },
        type,
        discountPercent: discountPercent ?? 1,
        code: type === "discount_code" ? target || void 0 : void 0,
        productId: type === "featured_product" ? target || void 0 : void 0,
        vendorUserId: type === "featured_vendor" ? target || void 0 : void 0,
        category: type === "seasonal_campaign" || type === "flash_sale" ? target.toLowerCase() || void 0 : void 0,
        active: true
      }).catch(() => void 0);
    }
    form.reset();
    renderCatalogPreview(false);
    renderAdminDashboard2();
    showToast({ message: getCopy("Promotion created.", "An kirkiri talla."), type: "success" });
  }
});
elements.adminContent.addEventListener("change", (event) => {
  const select = event.target?.closest("[data-vendor-plan]");
  const vendor = select?.dataset.vendorPlan;
  const planId = select?.value;
  if (!vendor || !planId || !["free", "standard", "premium"].includes(planId)) return;
  setVendorSubscription(vendor, planId);
  renderAdminDashboard2();
  showToast({ message: getCopy("Vendor plan updated.", "An sabunta plan din dillali."), type: "success" });
});
elements.adminContent.addEventListener("click", (event) => {
  const vendorPerformanceRow = event.target?.closest("#vendorPerformance .record-row");
  if (vendorPerformanceRow && !event.target?.closest("button")) {
    const vendor = vendorPerformanceRow.querySelector("strong")?.textContent?.trim() || "";
    const wallet = getVendorWalletSummaries().find((summary) => summary.vendor === vendor);
    if (wallet && wallet.availableBalance > 0) {
      const withdrawal = requestWithdrawal(wallet.vendor, wallet.availableBalance);
      if (withdrawal) {
        renderAdminDashboard2();
        showToast({
          message: getCopy("Withdrawal request created.", "An kirkiri bukatar cire kudi."),
          type: "success"
        });
      }
      return;
    }
  }
  const button = event.target?.closest("[data-vendor-action]");
  if (button) {
    const id = button.dataset.vendorId;
    const action = button.dataset.vendorAction;
    if (!id || action !== "approved" && action !== "rejected") return;
    if (state.currentUser?.role === "admin" && state.currentUser.token) {
      button.disabled = true;
      api.updateVendorApplication(id, {
        status: action,
        adminNote: `Updated from Kano Mart live admin dashboard`
      }).then(async () => {
        await refreshLiveAdminDashboard();
        showToast({
          message: action === "approved" ? getCopy("Live vendor approved.", "An amince da dillali live.") : getCopy("Live vendor rejected.", "An ki dillali live."),
          type: action === "approved" ? "success" : "info"
        });
      }).catch(() => {
        applyLocalVendorDecision(id, action);
      }).finally(() => {
        button.disabled = false;
      });
      return;
    }
    applyLocalVendorDecision(id, action);
    return;
  }
  const productButton = event.target?.closest("[data-product-action]");
  if (!productButton) {
    const reviewButton = event.target?.closest("[data-review-action]");
    if (reviewButton?.dataset.reviewId) {
      const review = hideReview(reviewButton.dataset.reviewId);
      if (!review) return;
      if (state.currentUser?.token) {
        api.updateAdminReview(reviewButton.dataset.reviewId, { hidden: true }).catch(() => void 0);
      }
      renderAdminDashboard2();
      showToast({
        message: getCopy("Review removed from public listings.", "An cire ra'ayi daga fili."),
        type: "info"
      });
      return;
    }
    const paymentButton = event.target?.closest("[data-payment-action]");
    if (paymentButton?.dataset.paymentId) {
      const action2 = paymentButton.dataset.paymentAction;
      const payment = action2 === "confirm" ? confirmPayment(paymentButton.dataset.paymentId) : action2 === "fail" ? failPayment(paymentButton.dataset.paymentId) : action2 === "refund" ? refundPayment(paymentButton.dataset.paymentId) : null;
      if (!payment) return;
      if (state.currentUser?.token) {
        const apiStatus = action2 === "confirm" ? "paid" : action2 === "fail" ? "failed" : action2 === "refund" ? "refunded" : null;
        if (apiStatus) {
          api.updateAdminPayment(paymentButton.dataset.paymentId, {
            status: apiStatus
          }).catch(() => void 0);
        }
      }
      renderAdminDashboard2();
      renderVendorCommerce();
      showToast({
        message: getCopy(`Payment ${payment.status}.`, `Biya ${payment.status}.`),
        type: payment.status === "paid" ? "success" : "info"
      });
      return;
    }
    const orderButton = event.target?.closest("[data-order-advance]");
    if (orderButton?.dataset.orderAdvance) {
      const order = advanceOrderStatus(orderButton.dataset.orderAdvance);
      if (!order) return;
      if (state.currentUser?.token) {
        api.updateAdminOrder(orderButton.dataset.orderAdvance, { status: order.status }).catch(() => void 0);
      }
      renderAdminDashboard2();
      renderVendorCommerce();
      showToast({
        message: getCopy(`Order ${order.id}: ${order.status}`, `Oda ${order.id}: ${order.status}`),
        type: order.status === "delivered" ? "success" : "info"
      });
      return;
    }
    const withdrawalButton = event.target?.closest("[data-withdrawal-action]");
    if (!withdrawalButton?.dataset.withdrawalId) return;
    const action = withdrawalButton.dataset.withdrawalAction;
    const withdrawal = action === "approved" ? approveWithdrawal(withdrawalButton.dataset.withdrawalId, "Approved from prototype admin dashboard") : action === "rejected" ? rejectWithdrawal(withdrawalButton.dataset.withdrawalId, "Rejected from prototype admin dashboard") : null;
    if (!withdrawal) return;
    if (state.currentUser?.token && (action === "approved" || action === "rejected")) {
      api.updateAdminPayout(withdrawalButton.dataset.withdrawalId, {
        status: action,
        adminNote: action === "approved" ? "Approved from admin dashboard" : "Rejected from admin dashboard"
      }).catch(() => void 0);
    }
    renderAdminDashboard2();
    renderVendorCommerce();
    showToast({
      message: getCopy(`Withdrawal ${withdrawal.status}.`, `Cire kudi ${withdrawal.status}.`),
      type: withdrawal.status === "approved" ? "success" : "info"
    });
    return;
  }
  const productId = productButton.dataset.productId;
  const productAction = productButton.dataset.productAction;
  if (!productId || productAction !== "approved" && productAction !== "hidden" && productAction !== "rejected") return;
  if (state.currentUser?.role === "admin" && state.currentUser.token) {
    productButton.disabled = true;
    api.updateAdminProduct(productId, {
      status: productAction,
      reviewNote: "Updated from Kano Mart live admin dashboard"
    }).then(async () => {
      await refreshLiveAdminDashboard();
      showToast({
        message: getCopy("Live product moderation updated.", "An sabunta duba kayan live."),
        type: productAction === "approved" ? "success" : "info"
      });
    }).catch(() => {
      applyLocalProductDecision(productId, productAction);
    }).finally(() => {
      productButton.disabled = false;
    });
    return;
  }
  applyLocalProductDecision(productId, productAction);
});
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
  if (e.key === "Escape") closeSidebar();
});
document.querySelector("#adminContent")?.addEventListener("click", (e) => {
  const btn = e.target?.closest("[data-admin-tab]");
  if (!btn) return;
  const tab = btn.dataset.adminTab;
  document.querySelectorAll(".admin-tab-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.adminTab === tab);
    b.setAttribute("aria-selected", String(b.dataset.adminTab === tab));
  });
  document.querySelectorAll(".admin-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== tab;
  });
});
document.querySelector(".vendor-dashboard")?.addEventListener("click", (e) => {
  const btn = e.target?.closest("[data-vendor-tab]");
  if (!btn) return;
  const tab = btn.dataset.vendorTab;
  document.querySelectorAll(".vendor-tab-btn").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.vendorTab === tab);
    b.setAttribute("aria-selected", String(b.dataset.vendorTab === tab));
  });
  document.querySelectorAll(".vendor-tab-panel").forEach((panel) => {
    panel.hidden = panel.dataset.vendorPanel !== tab;
  });
});
var APP_DATA_VERSION = "v2-postgres";
if (localStorage.getItem("kanoMart.dataVersion") !== APP_DATA_VERSION) {
  const keysToPreserve = /* @__PURE__ */ new Set(["kanoMart.dataVersion", "kanoMart.language", SIDEBAR_COLLAPSED_KEY]);
  Object.keys(localStorage).filter((k) => !keysToPreserve.has(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("kanoMart.dataVersion", APP_DATA_VERSION);
}
syncCart();
syncWishlistCount();
setLanguage(state.language);
syncUserButton();
renderAdminGate();
renderAdminDashboard2();
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
if (state.currentUser?.token) {
  void refreshSession().then(syncSessionFromApiUser).catch(() => void 0);
}
void fetchLiveCategories();
initLoginPage();
initSignupPage();
renderCustomerDashboard();
renderOrdersPage();
var scheduleEnhancements = "requestIdleCallback" in window ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 }) : (callback) => window.setTimeout(callback, 350);
scheduleEnhancements(() => {
  import("./frontend-enhancements-NTNUIWUZ.js").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});
inject();
