import {
  createId,
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
  isValidEmail,
  isValidPhone,
  localizeCategory,
  localizeStatus,
  normalize,
  normalizePhone,
  orderStatusLabels,
  parsePrice,
  products,
  renderStars,
  reviewVendorRequest,
  sanitizePlainText,
  seedReviews,
  setActiveLanguageButtons,
  setLiveVendorRequests,
  setStoredList,
  sortEntries,
  state,
  storageKeys,
  updateUserProfile,
  vendorProfiles
} from "./chunk-SI4ADJFE.js";

// ../backend/src/products.ts
var categoryCopy = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" }
};
function sanitizeProductText(value, maxLength = 120) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function formatProductPrice(amount) {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}
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
var seedCatalogEnabled = true;
function setSeedCatalogEnabled(enabled) {
  seedCatalogEnabled = enabled;
}
function getAllProducts() {
  const seen = /* @__PURE__ */ new Set();
  const seedProducts = seedCatalogEnabled ? products : [];
  return [...seedProducts, ...getLiveProducts(), ...getVendorProducts()].filter((product) => {
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
function saveVendorProduct(input) {
  const name = sanitizeProductText(input.name, 90);
  const category = categoryCopy[input.category] ?? categoryCopy.essentials;
  const product = {
    id: createId(),
    name: { en: name, ha: sanitizeProductText(input.nameHa || name, 90) },
    description: {
      en: sanitizeProductText(input.descriptionEn || "", 240),
      ha: sanitizeProductText(input.descriptionHa || input.descriptionEn || "", 240)
    },
    category,
    subcategory: { en: "Vendor product", ha: "Kayan dan kasuwa" },
    price: formatProductPrice(Math.max(0, input.priceValue)),
    quantityAvailable: Math.max(0, Number(input.quantityAvailable ?? 1)),
    imageDataUrl: input.imageDataUrl,
    vendor: sanitizeProductText(input.vendor, 80),
    vendorPhone: sanitizeProductText(input.vendorPhone, 24),
    area: sanitizeProductText(input.area || "Kano", 80),
    availability: Number(input.quantityAvailable ?? 1) > 0 ? { en: "Available now", ha: "Akwai yanzu" } : { en: "Out of stock", ha: "Ya kare" },
    listingStatus: Number(input.quantityAvailable ?? 1) > 0 ? "active" : "out_of_stock",
    // New products always start pending — admin must approve before they appear in catalog
    moderationStatus: "pending",
    accent: "#177a63",
    tags: [name, input.category, input.vendor, input.area].filter(Boolean).map((item) => item.toLowerCase())
  };
  setStoredList(storageKeys.vendorProducts, [product, ...getVendorProducts()]);
  const records = getProductModerationRecords();
  const pendingRecord = {
    productId: product.id,
    status: "pending",
    reviewedAt: (/* @__PURE__ */ new Date()).toISOString(),
    reviewNote: ""
  };
  setStoredList(storageKeys.productModeration, [pendingRecord, ...records]);
  return product;
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

// src/search.ts
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

// src/toast.ts
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

// src/api-client.ts
var DEFAULT_API_BASE_URL = "/api";
var API_TOKEN_KEY = "kanoMart.apiToken";
var API_TOKEN_EXPIRY_KEY = "kanoMart.apiTokenExpiry";
var DEFAULT_REQUEST_TIMEOUT_MS = 2e4;
function isLocalDevHost() {
  const host = globalThis.location?.hostname ?? "";
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
function getApiBaseUrl() {
  if (!isLocalDevHost()) return DEFAULT_API_BASE_URL;
  const configured = globalThis.localStorage?.getItem("kanoMart.apiBaseUrl")?.trim();
  return configured || DEFAULT_API_BASE_URL;
}
function getApiToken() {
  return globalThis.localStorage?.getItem(API_TOKEN_KEY) ?? "";
}
function saveApiToken(token, expiresAt) {
  if (!token) return;
  globalThis.localStorage?.setItem(API_TOKEN_KEY, token);
  if (expiresAt) globalThis.localStorage?.setItem(API_TOKEN_EXPIRY_KEY, expiresAt);
}
function clearApiToken() {
  globalThis.localStorage?.removeItem(API_TOKEN_KEY);
  globalThis.localStorage?.removeItem(API_TOKEN_EXPIRY_KEY);
}
function isApiTokenExpired() {
  const expiry = globalThis.localStorage?.getItem(API_TOKEN_EXPIRY_KEY);
  if (!expiry) return false;
  return Date.now() >= new Date(expiry).getTime();
}
function dispatchSessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kanoMart:sessionExpired"));
  }
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
  if (token && isApiTokenExpired()) {
    clearApiToken();
    dispatchSessionExpired();
    throw new ApiRequestError("Your session has expired. Please sign in again.", {
      status: 401,
      code: "session_expired"
    });
  }
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
    if (response.status === 401) {
      clearApiToken();
      dispatchSessionExpired();
    }
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

// src/wishlist.ts
function getWishlist() {
  return getStoredList(storageKeys.wishlist);
}
function isWishlisted(productId) {
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

// ../backend/src/notifications.ts
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

// src/reviews.ts
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
function addReview(productId, reviewerName, rating, comment) {
  const stored = getStoredList(storageKeys.reviews);
  const product = products.find((item) => item.id === productId);
  const review = {
    id: createId(),
    productId,
    vendor: product?.vendor,
    reviewerName,
    rating,
    comment,
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  stored.unshift(review);
  setStoredList(storageKeys.reviews, stored);
  if (product) {
    createNotification({
      audience: "vendor",
      recipient: product.vendor,
      title: "New product review",
      message: `${product.name.en} received a ${review.rating}-star review.`,
      type: "review"
    });
  }
  if (getApiToken()) {
    api.createReview({ productId, rating, comment }).catch(() => void 0);
  }
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
function renderReviewList(productId) {
  const reviews = getProductReviews(productId).slice(0, 5);
  if (reviews.length === 0) return "";
  return reviews.map(
    (r) => `
      <div class="review-item">
        <div class="review-header">
          <span class="review-stars">${renderStars(r.rating)}</span>
          <strong>${escapeHtml(r.reviewerName)}</strong>
          <span class="review-date">${escapeHtml(formatDate(r.createdAt))}</span>
        </div>
        <p>${escapeHtml(r.comment)}</p>
      </div>
    `
  ).join("");
}
function renderReviewForm(productId) {
  return `
    <form class="review-form" id="reviewForm" data-product-id="${escapeHtml(productId)}">
      <h4>${getCopy("Write a review", "Rubuta sakamako")}</h4>
      <label>
        <span>${getCopy("Your name", "Sunanka")}</span>
        <input type="text" name="reviewerName" required minlength="2" />
      </label>
      <fieldset class="star-fieldset">
        <legend>${getCopy("Rating", "Daraj\u0430")}</legend>
        ${[5, 4, 3, 2, 1].map(
    (n) => `
          <label class="star-label">
            <input type="radio" name="rating" value="${n}" required />
            <span aria-hidden="true">\u2605</span>
          </label>
        `
  ).join("")}
      </fieldset>
      <label>
        <span>${getCopy("Comment", "Ra'ayi")}</span>
        <textarea name="comment" required minlength="10" rows="3"></textarea>
      </label>
      <button type="submit">${getCopy("Submit review", "Aika sakamako")}</button>
      <p class="form-message" id="reviewMessage" role="status"></p>
    </form>
  `;
}

// ../backend/src/marketplace-settings.ts
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
function getVendorSubscriptionRevenue() {
  return getVendorSubscriptions().reduce((total, subscription) => {
    if (subscription.status !== "active") return total;
    const plan = vendorSubscriptionPlans.find((item) => item.id === subscription.planId);
    return total + (plan?.monthlyFee ?? 0);
  }, 0);
}

// ../backend/src/wallet.ts
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

// ../backend/src/payments.ts
function getPayments() {
  return getStoredList(storageKeys.payments);
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

// src/live-api.ts
var liveProducts = [];
function getLiveProducts2() {
  return liveProducts;
}
function mergeLiveProducts(products2) {
  if (!products2.length) return;
  const byId = new Map(liveProducts.map((p) => [p.id, p]));
  for (const product of products2) byId.set(product.id, product);
  liveProducts = [...byId.values()];
  setLiveProducts(liveProducts);
}
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
    tags: [nameEn, nameHa, product.category, product.vendorName, product.area, ...product.tags ?? []].filter(Boolean).map((item) => String(item).toLowerCase()),
    createdAt: product.createdAt
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
  liveProducts = products2;
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
async function markNotificationRead(id) {
  await api.markNotificationRead(id).catch(() => void 0);
  const notification = liveNotifications.find((n) => n.id === id);
  if (notification) notification.readAt = (/* @__PURE__ */ new Date()).toISOString();
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

// src/cart.ts
function getCartItems() {
  return getStoredList(storageKeys.cart);
}
function getCartProduct(productId) {
  return getLiveProducts2().find((p) => p.id === productId) ?? getProductById(productId);
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
async function hydrateCartFromServer() {
  if (!state.currentUser?.token || state.currentUser.role !== "customer") return;
  let serverItems;
  try {
    const { cart } = await api.cart();
    mergeLiveProducts(cart.items.flatMap((i) => i.product ? [mapApiProduct(i.product)] : []));
    serverItems = cart.items;
  } catch {
    return;
  }
  const merged = /* @__PURE__ */ new Map();
  for (const item of serverItems) {
    merged.set(item.productId, {
      productId: item.productId,
      quantity: item.quantity,
      addedAt: item.addedAt ?? (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  for (const item of getCartItems()) {
    const existing = merged.get(item.productId);
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
    else merged.set(item.productId, item);
  }
  const items = [...merged.values()];
  setStoredList(storageKeys.cart, items);
  syncCart();
  await Promise.all(
    items.map((item) => {
      const server = serverItems.find((s) => s.productId === item.productId);
      if (server && server.quantity === item.quantity) return Promise.resolve();
      return api.addCartItem(item.productId, item.quantity).then(() => void 0, () => void 0);
    })
  );
}
async function reconcileCartWithServer() {
  const local = getCartItems();
  const { cart } = await api.cart();
  const failures = [];
  for (const item of local) {
    const server = cart.items.find((s) => s.productId === item.productId);
    if (server && server.quantity === item.quantity) continue;
    try {
      await api.addCartItem(item.productId, item.quantity);
    } catch {
      const product = getCartProduct(item.productId);
      failures.push(product ? product.name[state.language] : item.productId);
    }
  }
  for (const item of cart.items) {
    if (!local.some((l) => l.productId === item.productId)) {
      await api.removeCartItem(item.productId).catch(() => void 0);
    }
  }
  if (failures.length) {
    throw new Error(
      getCopy(
        `These items are not available for online checkout right now: ${failures.join(", ")}. Remove them from your cart and try again.`,
        `Wadannan kayan ba sa samuwa don biya a yanzu: ${failures.join(", ")}. Cire su daga kwandon ka sake gwadawa.`
      )
    );
  }
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
    const name = product.name[state.language];
    const lineTotal = formatPrice(parsePrice(product.price) * item.quantity);
    return `
        <div class="cart-item" data-product-id="${escapeHtml(item.productId)}">
          <div class="cart-item-thumb" style="--accent: ${product.accent}" aria-hidden="true"></div>
          <div class="cart-item-info">
            <strong>${escapeHtml(name)}</strong>
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

// ../backend/src/promotions.ts
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

// src/orders.ts
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
        const name = typeof i.name === "object" ? i.name.en ?? "" : String(i.name ?? i.productId ?? "");
        return `${escapeHtml(name)} \xD7${i.quantity}`;
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

// ../backend/src/withdrawals.ts
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

// ../backend/src/analytics.ts
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

// src/render.ts
function renderProductCard(product) {
  const name = product.name[state.language];
  const category = product.category[state.language];
  const subcategory = product.subcategory[state.language];
  const availability = product.availability[state.language];
  const wished = isWishlisted(product.id);
  const avg = getAverageRating(product.id);
  const reviewCount = getProductReviews(product.id).length;
  const promotion = getPromotionForProduct(product);
  const basePrice = Number(product.price.replace(/[^0-9]/g, ""));
  const discountedPrice = getDiscountedPrice(basePrice, promotion);
  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="product-thumb" style="--accent: ${product.accent}">
        ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(name)}" loading="lazy" />` : ""}
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
      <h3>${escapeHtml(name)}</h3>
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

// src/admin.ts
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

// src/services/dashboard-data.ts
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

// src/components/dashboard/primitives.ts
var panelIdCounter = 0;
function renderStatusBadge(status, label = status) {
  const normalized = String(status || "unknown").toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  const text = label === status ? localizeStatus(status) : label;
  return `<span class="dash-status dash-status-${escapeHtml(normalized)}">${escapeHtml(text)}</span>`;
}
function renderStatCard(stat) {
  return `
    <article class="dash-stat-card" data-tone="${escapeHtml(stat.tone ?? "neutral")}">
      <div class="dash-stat-card-top">
        <span>${escapeHtml(stat.label)}</span>
        <i aria-hidden="true"></i>
      </div>
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
function renderDashboardNote(body) {
  return `<p class="dash-page-note">${escapeHtml(body)}</p>`;
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
      <div class="dash-header-copy">
        <p class="dash-eyebrow">${escapeHtml(input.eyebrow)}</p>
        <h2>${escapeHtml(input.title)}</h2>
        <p>${escapeHtml(input.description)}</p>
      </div>
      ${input.actions?.length ? `<div class="dash-header-actions">${input.actions.map(renderDashboardAction).join("")}</div>` : ""}
    </header>
  `;
}
function renderPanel(input) {
  panelIdCounter += 1;
  const titleId = `dash-panel-${input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section"}-${panelIdCounter}`;
  return `
    <section class="dash-panel ${escapeHtml(input.className ?? "")}" aria-labelledby="${escapeHtml(titleId)}">
      <div class="dash-panel-heading">
        <div>
          ${input.eyebrow ? `<span>${escapeHtml(input.eyebrow)}</span>` : ""}
          <h3 id="${escapeHtml(titleId)}">${escapeHtml(input.title)}</h3>
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
              <div class="dash-mini-row-main">
                <strong>${escapeHtml(row.title)}</strong>
                ${row.meta ? `<span>${escapeHtml(row.meta)}</span>` : ""}
              </div>
              <div class="dash-mini-row-aside">
                ${row.value ? `<b>${escapeHtml(row.value)}</b>` : ""}
                ${row.status ? renderStatusBadge(row.status) : ""}
                ${row.action ? renderDashboardAction({ ...row.action, tone: row.action.tone ?? "secondary" }) : ""}
              </div>
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderMoney(amount) {
  return formatPrice(Math.max(0, Number(amount ?? 0) || 0));
}

// src/router/dashboard-routes.ts
var dashboardRoutes = [
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
  { role: "admin", path: "admin/system-health", page: "admin", label: "System health", labelHa: "Lafiyar tsarin", description: "API, DB, storage, email", descriptionHa: "API, bayanai, ajiya, imel" }
];
function getDashboardRoutesForRole(role) {
  return dashboardRoutes.filter((route) => route.role === role);
}

// src/components/dashboard/role-nav.ts
function renderRoleDashboardNav(role, currentPath) {
  const routes2 = getDashboardRoutesForRole(role);
  return `
    <nav class="dash-role-nav" data-role="${escapeHtml(role)}" aria-label="${escapeHtml(getCopy("Dashboard sections", "Sassan dashboard"))}">
      ${routes2.map((route) => {
    const isActive = route.path === currentPath;
    return `
            <a href="#${escapeHtml(route.path)}" data-route="${escapeHtml(route.path)}" class="${isActive ? "is-active" : ""}"${isActive ? ` aria-current="page"` : ""}>
              <strong>${escapeHtml(getCopy(route.label, route.labelHa))}</strong>
              <span>${escapeHtml(getCopy(route.description, route.descriptionHa))}</span>
            </a>
          `;
  }).join("")}
    </nav>
  `;
}

// src/components/dashboard/shell.ts
function renderDashShell(role, currentPath, content) {
  return `
    <div class="dash-shell dash-shell-${role}">
      <aside class="dash-sidebar">${renderRoleDashboardNav(role, currentPath)}</aside>
      <div class="dash-content">${content}</div>
    </div>
  `;
}

// src/pages/customer/overview.ts
function shell(role, currentPath, eyebrow, title, description, actions, body) {
  return renderDashShell(role, currentPath, `
    ${renderDashboardHeader({ eyebrow, title, description, actions })}
    <div class="dash-overview-grid">${body}</div>
  `);
}
function renderOrdersPage(user, data) {
  const visibleOrders = data.orders.slice(0, 30);
  const rows = visibleOrders.map((order) => ({
    title: `Order ${order.id.slice(-6).toUpperCase()}`,
    meta: `${formatDate(order.createdAt)} \xB7 ${order.items.slice(0, 2).join(", ") || "items"}`,
    value: renderMoney(order.total),
    status: order.status
  }));
  const limitNote = data.orders.length > visibleOrders.length ? renderDashboardNote(getCopy(`Showing latest ${visibleOrders.length} of ${data.orders.length} orders for faster rendering.`, `Ana nuna sabbin oda ${visibleOrders.length} daga ${data.orders.length} don saurin aiki.`)) : "";
  return shell(
    "customer",
    "customer/orders",
    getCopy("Fulfillment", "Cika oda"),
    getCopy("Your orders", "Ododinka"),
    getCopy("Track active deliveries, view completed purchases, and request support on any order.", "Bi diddigin isar da kaya masu aiki, duba siyayya da aka kammala, da neman tallafi akan kowane oda."),
    [{ label: getCopy("Continue shopping", "Ci gaba da siyayya"), route: "catalog" }],
    `
      ${renderPanel({
      eyebrow: getCopy("Active", "Masu aiki"),
      title: getCopy("Orders in progress", "Ododi da ake aiki da su"),
      body: renderMiniRows(
        data.activeOrders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: o.status })),
        { title: getCopy("No active orders", "Babu ododi masu aiki"), body: getCopy("Your in-progress orders will appear here.", "Ododinka da ke tafiya za su bayyana a nan."), action: { label: getCopy("Shop now", "Saya yanzu"), route: "catalog" } }
      )
    })}
      ${renderPanel({
      eyebrow: getCopy("History", "Tarihi"),
      title: getCopy("All orders", "Dukkan ododi"),
      body: `${renderMiniRows(rows, { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Place your first order to see it here.", "Yi odona farko don ganin sa a nan.") })}${limitNote}`
    })}
    `
  );
}
function renderCartPage(user, data) {
  const cartItems = getCartItems();
  const products2 = getCatalogProducts();
  const cartRows = cartItems.map((item) => {
    const product = products2.find((p) => p.id === item.productId);
    const name = product ? getLocalizedValue(product.name) : item.productId;
    return `
      <div class="dash-mini-row">
        <div class="dash-mini-row-main">
          <strong>${escapeHtml(name)}</strong>
          <span>${getCopy("Qty", "Yawa")}: ${item.quantity}</span>
        </div>
        <div class="dash-mini-row-aside">
          <b>${renderMoney(product ? parsePrice(product.price) * item.quantity : 0)}</b>
          <div class="dash-mini-row-actions">
            <button type="button" class="btn btn-sm btn-ghost cart-qty-dec" data-product-id="${escapeHtml(item.productId)}">\u2212</button>
            <button type="button" class="btn btn-sm btn-ghost cart-qty-inc" data-product-id="${escapeHtml(item.productId)}">+</button>
            <button type="button" class="btn btn-sm btn-danger-ghost cart-remove" data-product-id="${escapeHtml(item.productId)}">${getCopy("Remove", "Cire")}</button>
          </div>
        </div>
      </div>
    `;
  });
  const summary = cartItems.length ? `
      <div class="dash-money-stack">
        <div class="dash-money-line"><span>${getCopy("Items", "Kaya")}</span><b>${data.cartCount}</b></div>
        <div class="dash-money-line dash-money-total"><span>${getCopy("Subtotal", "Jimilar farko")}</span><b>${renderMoney(data.cartSubtotal)}</b></div>
        <div class="dash-money-actions">
          <button type="button" class="btn btn-primary" id="checkoutFromCartBtn">${getCopy("Proceed to checkout", "Tafi biyan ku\u0257i")}</button>
          <a href="#catalog" class="btn btn-ghost">${getCopy("Continue shopping", "Ci gaba da siyayya")}</a>
        </div>
      </div>
    ` : renderEmptyState(getCopy("Cart is empty", "Kwandon saya yana wofi"), getCopy("Browse products and add items to your cart.", "Duba kaya ka saka su a kwandon saya."), { label: getCopy("Browse catalog", "Duba jerin kaya"), route: "catalog" });
  return shell(
    "customer",
    "customer/cart",
    getCopy("Shopping", "Siyayya"),
    getCopy("Your cart", "Kwandon sayanka"),
    getCopy("Review items, update quantities, and proceed to checkout.", "Duba kaya, sabunta yawa, ka tafi biyan ku\u0257i."),
    [],
    `
      ${renderPanel({ eyebrow: getCopy("Items", "Kaya"), title: getCopy("Cart contents", "Abubuwan da ke cikin kwandon saya"), body: cartItems.length ? `<div class="dash-mini-rows">${cartRows.join("")}</div>` : renderEmptyState(getCopy("No items in cart", "Babu kaya a kwandon saya"), "") })}
      ${renderPanel({ eyebrow: getCopy("Summary", "Ta\u0199aitaccen bayani"), title: getCopy("Order summary", "Ta\u0199aitaccen oda"), body: summary })}
    `
  );
}
function renderWishlistPage(user, data) {
  const wishlistIds = getWishlist();
  const products2 = getCatalogProducts().filter((p) => wishlistIds.includes(p.id));
  const rows = products2.map((p) => ({
    title: getLocalizedValue(p.name),
    meta: `${p.vendor} \xB7 ${getCopy("In stock", "Yana cikin ajiya")}: ${p.quantityAvailable ?? 0}`,
    value: renderMoney(parsePrice(p.price)),
    status: (p.quantityAvailable ?? 0) > 0 ? "available" : "out_of_stock"
  }));
  return shell(
    "customer",
    "customer/wishlist",
    getCopy("Discovery", "Bincike"),
    getCopy("Wishlist", "Jerin abubuwan da ake so"),
    getCopy("Products you've saved for later. Add to cart when ready.", "Kayan da ka ajiye don daga baya. Saka a kwandon saya idan ka shirya."),
    [{ label: getCopy("Browse more", "Duba \u0199ari"), route: "catalog" }],
    renderPanel({ eyebrow: getCopy("Saved", "Da aka ajiye"), title: `${wishlistIds.length} ${getCopy("products", "kaya")}`, body: renderMiniRows(rows, { title: getCopy("Wishlist is empty", "Jerin abubuwan da ake so yana wofi"), body: getCopy("Save products from the catalog to see them here.", "Ajiye kaya daga jerin don ganin su a nan."), action: { label: getCopy("Explore catalog", "Bincika jerin kaya"), route: "catalog" } }) })
  );
}
function renderNotificationsPage(user, data) {
  const notifHtml = data.notifications.length ? data.notifications.map((item) => `
        <article class="dash-notification-item" data-notif-id="${escapeHtml(item.id ?? "")}">
          <div class="dash-notif-body">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.message)}</span>
            <time>${formatDate(item.createdAt)}</time>
          </div>
          <div class="dash-notif-meta">
            ${item.readAt ? renderStatusBadge("read", getCopy("Read", "An karanta")) : renderStatusBadge("unread", getCopy("Unread", "Ba a karanta ba"))}
          </div>
        </article>
      `).join("") : renderEmptyState(getCopy("No notifications", "Babu sanarwa"), getCopy("Order and payment updates will appear here.", "Sabuntawa na oda da biya za su bayyana a nan."));
  return shell(
    "customer",
    "customer/notifications",
    getCopy("Updates", "Sabuntawa"),
    getCopy("Notifications", "Sanarwa"),
    getCopy("Stay updated on orders, deliveries, and account activity.", "Kasance cikin ha\u0253akawa kan ododi, isar da kaya, da ayyukan asusunka."),
    [],
    renderPanel({ eyebrow: getCopy("Recent", "Kwanan nan"), title: getCopy("All notifications", "Dukkan sanarwa"), body: `<div class="dash-notification-stack">${notifHtml}</div>` })
  );
}
function renderProfilePage(user) {
  return shell(
    "customer",
    "customer/profile",
    getCopy("Account", "Asusun"),
    getCopy("Profile settings", "Saitunan bayani na sirri"),
    getCopy("Keep your contact, delivery address, and language preferences up to date.", "Kiyaye hul\u0257a, adireshin isar da kaya, da za\u0253ukan yare na zamani."),
    [],
    renderPanel({
      eyebrow: getCopy("Details", "Bayani"),
      title: getCopy("Personal information", "Bayanan sirri"),
      body: `
        <form id="profileUpdateForm" class="dash-form">
          <div class="dash-form-row">
            <label class="dash-label" for="profileName">${getCopy("Full name", "Cikakken suna")}</label>
            <input class="dash-input" id="profileName" name="name" type="text" value="${escapeHtml(user.name)}" required />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileEmail">${getCopy("Email", "Imel")} <span class="dash-optional">(${getCopy("optional", "za\u0253i")})</span></label>
            <input class="dash-input" id="profileEmail" name="email" type="email" value="${escapeHtml(user.email ?? "")}" />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profilePhone">${getCopy("Phone", "Waya")}</label>
            <input class="dash-input" id="profilePhone" type="tel" value="${escapeHtml(user.phone)}" disabled />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileAddress">${getCopy("Delivery address", "Adireshin isar da kaya")}</label>
            <input class="dash-input" id="profileAddress" name="deliveryAddress" type="text" value="${escapeHtml(user.deliveryAddress ?? "")}" placeholder="${getCopy("e.g. Kofar Mata, Kano", "misali: Kofar Mata, Kano")}" />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileLang">${getCopy("Preferred language", "Yaren da ake so")}</label>
            <select class="dash-input" id="profileLang" name="preferredLanguage">
              <option value="en" ${user.preferredLanguage !== "ha" ? "selected" : ""}>English</option>
              <option value="ha" ${user.preferredLanguage === "ha" ? "selected" : ""}>Hausa</option>
            </select>
          </div>
          <div class="dash-form-actions">
            <button type="submit" class="btn btn-primary">${getCopy("Save changes", "Ajiye canje-canje")}</button>
          </div>
          <div id="profileUpdateStatus" aria-live="polite"></div>
        </form>
      `
    })
  );
}
function renderCustomerOverview(user, currentPath = "customer/overview") {
  const data = getCustomerDashboardData(user);
  if (currentPath === "customer/orders") return renderOrdersPage(user, data);
  if (currentPath === "customer/cart") return renderCartPage(user, data);
  if (currentPath === "customer/wishlist") return renderWishlistPage(user, data);
  if (currentPath === "customer/notifications") return renderNotificationsPage(user, data);
  if (currentPath === "customer/profile") return renderProfilePage(user);
  const firstName = user.firstName || user.name.split(" ")[0] || "there";
  return renderDashShell("customer", currentPath, `
      ${renderDashboardHeader({
    eyebrow: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
    title: `${getCopy("Welcome back", "Barka da dawowar")}, ${firstName}`,
    description: getCopy("Track active orders, continue shopping, review saved products, and handle support from one clean dashboard.", "Bi diddigin ododi masu aiki, ci gaba da siyayya, duba kayanda aka ajiye, da sarrafa tallafi daga allon sarrafa guda \u0257aya mai tsabta."),
    actions: [
      { label: getCopy("Shop catalog", "Saya daga jerin kaya"), route: "catalog" },
      { label: getCopy("Open cart", "Bu\u0257e kwandon saya"), id: "customerCartBtn", tone: "secondary" }
    ]
  })}

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
  `);
}

// src/pages/vendor/overview.ts
function renderApprovalBanner(status, note) {
  if (status === "approved") {
    return `<div class="dash-alert dash-alert-success">
      <strong>${getCopy("Store approved", "An amince da shago")}</strong>
      <span>${getCopy("Your products can be submitted for catalog moderation and orders can flow to this workspace.", "Ana iya aika kayanka don duba jerin kaya kuma ododi za su iya zuwa wannan wurin aiki.")}</span>
    </div>`;
  }
  const rejected = status === "rejected";
  return `<div class="dash-alert ${rejected ? "dash-alert-danger" : "dash-alert-warning"}">
    <strong>${rejected ? getCopy("Store needs attention", "Shago yana bu\u0199atar kulawa") : getCopy("Store approval pending", "Amincewa da shago na jira")}</strong>
    <span>${escapeHtml(note || (rejected ? getCopy("Review your business details and contact support before resubmitting.", "Duba bayanan kasuwancinka ka tuntubi tallafi kafin sake aika.") : getCopy("You can prepare products, but publishing is limited until admin approval.", "Kana iya shirya kaya, amma buga yana iyakantacce har admin ya amince.")))}</span>
  </div>`;
}
function shell2(currentPath, eyebrow, title, description, actions, body) {
  return renderDashShell("vendor", currentPath, `
    ${renderDashboardHeader({ eyebrow, title, description, actions })}
    ${body}
  `);
}
function renderProductsPage(user, data) {
  const visibleProducts = data.products.slice(0, 50);
  const productLimitNote = data.products.length > visibleProducts.length ? renderDashboardNote(getCopy(`Showing first ${visibleProducts.length} of ${data.products.length} products to keep this page fast.`, `Ana nuna kaya ${visibleProducts.length} daga ${data.products.length} don shafin ya yi sauri.`)) : "";
  const productRows = visibleProducts.map((p) => `
    <div class="dash-mini-row vendor-product-row">
      <div class="dash-mini-row-main">
        <strong>${escapeHtml(getLocalizedValue(p.name))}</strong>
        <span>${escapeHtml(productToMiniMeta(p))}</span>
      </div>
      <div class="dash-mini-row-aside">
        <span class="dash-badge dash-badge--${escapeHtml(p.moderationStatus ?? "pending")}">${escapeHtml(p.moderationStatus ?? "pending")}</span>
        <select class="dash-input dash-input--sm vendor-status-select" data-product-id="${escapeHtml(p.id)}">
          <option value="active" ${p.listingStatus === "active" ? "selected" : ""}>${getCopy("Active", "Aiki")}</option>
          <option value="out_of_stock" ${p.listingStatus === "out_of_stock" ? "selected" : ""}>${getCopy("Out of stock", "Kare ajiya")}</option>
          <option value="taken_down" ${p.listingStatus === "taken_down" ? "selected" : ""}>${getCopy("Take down", "Sauke")}</option>
        </select>
      </div>
    </div>
  `).join("");
  return shell2(
    "vendor/products",
    getCopy("Catalog", "Jerin kaya"),
    getCopy("Your products", "Kayanka"),
    getCopy("Manage your listings \u2014 update prices, status, and stock. New products go through admin moderation.", "Kula da jerin kayanka \u2014 sabunta farashi, yanayi, da ajiya. Sabbin kaya suna tafiya ta duba admin."),
    [{ label: getCopy("Add new product", "\u0198ara kaya sabbi"), href: "#vendorProductForm" }],
    `
      <div class="dash-overview-grid">
        ${renderPanel({
      eyebrow: getCopy("Listings", "Jeri"),
      title: `${data.products.length} ${getCopy("products", "kaya")}`,
      body: data.products.length ? `<div class="dash-mini-rows">${productRows}</div>${productLimitNote}` : renderEmptyState(getCopy("No products yet", "Babu kaya tukuna"), getCopy("Add your first product to start selling on KanoMart.", "\u0198ara kayan farko don fara siyarwa a KanoMart."), { label: getCopy("Add product", "\u0198ara kaya"), href: "#vendorProductForm" })
    })}
        ${renderPanel({
      eyebrow: getCopy("Add listing", "\u0198ara jeri"),
      title: getCopy("New product", "Sabuwar kaya"),
      body: `
            <form class="vendor-product-form dash-form" id="vendorProductForm" novalidate>
              <div class="dash-form-row">
                <label class="dash-label" for="vpName">${getCopy("Name (English)", "Suna (Turanci)")}</label>
                <input class="dash-input" id="vpName" name="productName" type="text" minlength="2" maxlength="90" required placeholder="${getCopy("e.g. Plain black jallabiya", "misali Jallabiya baki")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpNameHa">${getCopy("Name (Hausa)", "Suna (Hausa)")}</label>
                <input class="dash-input" id="vpNameHa" name="productNameHa" type="text" maxlength="90" placeholder="${getCopy("e.g. Jallabiya baki", "misali Jallabiya baki")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpDesc">${getCopy("Description (English)", "Bayani (Turanci)")}</label>
                <input class="dash-input" id="vpDesc" name="descriptionEn" type="text" maxlength="240" placeholder="${getCopy("Short product description", "Takaitaccen bayanin kaya")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpDescHa">${getCopy("Description (Hausa)", "Bayani (Hausa)")}</label>
                <input class="dash-input" id="vpDescHa" name="descriptionHa" type="text" maxlength="240" placeholder="${getCopy("Takaitaccen bayanin kaya", "Takaitaccen bayanin kaya")}" />
              </div>
              <div class="dash-form-row dash-form-row--half">
                <div>
                  <label class="dash-label" for="vpPrice">${getCopy("Price (NGN)", "Farashi (NGN)")}</label>
                  <input class="dash-input" id="vpPrice" name="productValue" type="text" inputmode="numeric" required placeholder="15000" />
                </div>
                <div>
                  <label class="dash-label" for="vpQty">${getCopy("Stock quantity", "Yawan ajiya")}</label>
                  <input class="dash-input" id="vpQty" name="quantityAvailable" type="number" min="0" step="1" required placeholder="10" />
                </div>
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpCat">${getCopy("Category", "Rukunin kaya")}</label>
                <select class="dash-input" id="vpCat" name="productCategory" required>
                  <option value="food">${getCopy("Food", "Abinci")}</option>
                  <option value="fashion">${getCopy("Fashion", "Kaya")}</option>
                  <option value="children">${getCopy("Children", "Yara")}</option>
                  <option value="essentials">${getCopy("Essentials", "Abubuwan da ake bukata")}</option>
                  <option value="electronics">${getCopy("Electronics", "Lantarki")}</option>
                </select>
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpImg">${getCopy("Product image", "Hoton kaya")}</label>
                <input class="dash-input" id="vpImg" name="productImage" type="file" accept="image/png,image/jpeg,image/webp" required />
                <small>${getCopy("JPEG, PNG, or WebP. Optimized before upload.", "JPEG, PNG, ko WebP. Ana inganta kafin aika.")}</small>
              </div>
              <div class="dash-form-actions">
                <button type="submit" class="btn btn-primary">${getCopy("Submit product", "Aika kaya")}</button>
              </div>
              <div id="vendorProductMessage" class="dash-form-status" role="status" aria-live="polite"></div>
            </form>
          `
    })}
      </div>
    `
  );
}
function renderOrdersPage2(user, data) {
  return shell2(
    "vendor/orders",
    getCopy("Fulfillment", "Cika oda"),
    getCopy("Vendor orders", "Ododinka"),
    getCopy("Manage incoming and in-progress orders for your products.", "Kula da ododi masu shigowa da wa\u0257anda ke tafiya don kayanka."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Pending", "Jira"),
      title: getCopy("Awaiting confirmation", "Jiran tabbatarwa"),
      body: renderMiniRows(
        data.pendingOrders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: o.status })),
        { title: getCopy("No pending orders", "Babu ododi da ke jira"), body: getCopy("New orders will appear here for confirmation.", "Sabbin ododi za su bayyana a nan don tabbatarwa.") }
      )
    })}
      ${renderPanel({
      eyebrow: getCopy("All orders", "Dukkan ododi"),
      title: getCopy("Order history", "Tarihin oda"),
      body: renderMiniRows(
        data.orders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: `${formatDate(o.createdAt)} \xB7 ${o.paymentStatus}`, value: renderMoney(o.total), status: o.status })),
        { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Orders from customers who buy your products appear here.", "Ododi daga kwastoma da suka sayi kayanka za su bayyana a nan.") }
      )
    })}
      <div id="vendorCommerceList" class="vendor-commerce-list" aria-live="polite"></div>
    </div>`
  );
}
function renderInventoryPage(user, data) {
  const visibleInventory = data.products.slice(0, 50);
  const inventoryLimitNote = data.products.length > visibleInventory.length ? renderDashboardNote(getCopy(`Showing first ${visibleInventory.length} of ${data.products.length} inventory records.`, `Ana nuna bayanan ajiya ${visibleInventory.length} daga ${data.products.length}.`)) : "";
  return shell2(
    "vendor/inventory",
    getCopy("Inventory", "Ajiya"),
    getCopy("Stock management", "Sarrafa ajiya"),
    getCopy("Monitor stock levels and restock products before they run out.", "Sa ido kan matakin ajiya ka sake cika kayan kafin su kare."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Critical", "Muhimmanci"),
      title: getCopy("Low stock alerts", "Garga\u0257i na \u0199arancin ajiya"),
      body: renderMiniRows(
        data.lowStock.map((p) => ({ title: getLocalizedValue(p.name), meta: productToMiniMeta(p), status: (p.quantityAvailable ?? 0) === 0 ? "out_of_stock" : "low_stock" })),
        { title: getCopy("No stock issues", "Babu matsalar ajiya"), body: getCopy("Products with 3 or fewer units will be flagged here.", "Kaya da ke da na\xFAra 3 ko \u0199asa da haka za a nuna su a nan.") }
      )
    })}
      ${renderPanel({
      eyebrow: getCopy("All products", "Dukkan kaya"),
      title: getCopy("Full inventory", "Cikakkiyar ajiya"),
      body: `${renderMiniRows(
        visibleInventory.map((p) => ({ title: getLocalizedValue(p.name), meta: `${getCopy("Stock", "Ajiya")}: ${p.quantityAvailable ?? 0} \xB7 ${escapeHtml(p.listingStatus ?? "active")}`, status: p.listingStatus ?? "active" })),
        { title: getCopy("No products", "Babu kaya"), body: getCopy("Add products to start tracking inventory.", "\u0198ara kaya don fara bin diddigin ajiya.") }
      )}${inventoryLimitNote}`
    })}
    </div>`
  );
}
function renderRevenuePage(user, data) {
  return shell2(
    "vendor/revenue",
    getCopy("Finance", "Kudi"),
    getCopy("Revenue overview", "Takaitaccen ku\u0257in shiga"),
    getCopy("Track your paid sales, pending settlements, and platform commission.", "Bin diddigin siyarwa da aka biya, tantancewa da ke jira, da kwamiti na dandalin."),
    [{ label: getCopy("Request payout", "Neman biya"), route: "vendor/payouts", tone: "secondary" }],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
      { label: getCopy("Paid sales", "Siyarwa da aka biya"), value: renderMoney(data.paidSales), detail: `${data.orders.filter((o) => o.paymentStatus === "paid").length} ${getCopy("paid orders", "ododi da aka biya")}`, tone: "success" },
      { label: getCopy("Available balance", "Ku\u0257in da ake da shi"), value: renderMoney(data.wallet?.availableBalance), detail: getCopy("Ready for payout", "A shirye don biya"), tone: "info" },
      { label: getCopy("Pending balance", "Ku\u0257in da ke jira"), value: renderMoney(data.wallet?.pendingBalance), detail: getCopy("Awaiting settlement", "Jiran tantancewa"), tone: "warning" },
      { label: getCopy("Commission paid", "Kwamiti da aka biya"), value: renderMoney(data.wallet?.totalCommission), detail: getCopy("Platform fee", "Ku\u0257in dandalin"), tone: "neutral" }
    ])}
      ${renderPanel({
      eyebrow: getCopy("Transactions", "Ma'amaloli"),
      title: getCopy("Recent paid orders", "Ododi da aka biya na kwanan nan"),
      body: renderMiniRows(
        data.orders.filter((o) => o.paymentStatus === "paid").slice(0, 8).map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: "paid" })),
        { title: getCopy("No paid orders", "Babu ododi da aka biya"), body: getCopy("Revenue from paid customer orders will show here.", "Ku\u0257in shiga daga ododi da kwastoma suka biya za su bayyana a nan.") }
      )
    })}
    </div>`
  );
}
function renderPayoutsPage(user, data) {
  return shell2(
    "vendor/payouts",
    getCopy("Finance", "Kudi"),
    getCopy("Payouts", "Biyan ku\u0257i"),
    getCopy("Request settlements to your bank account once your balance is available.", "Nemi tantancewa zuwa asusun bankinka da zarar ku\u0257in da ake da shi ya shirya."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Wallet", "Walat"),
      title: getCopy("Available balance", "Ku\u0257in da ake da shi"),
      body: `
          <div class="dash-money-stack">
            <div class="dash-money-line"><span>${getCopy("Available", "Da ake da shi")}</span><b>${renderMoney(data.wallet?.availableBalance)}</b></div>
            <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.wallet?.pendingBalance)}</b></div>
            <div class="dash-money-line dash-money-total"><span>${getCopy("Commission paid", "Kwamiti da aka biya")}</span><b>${renderMoney(data.wallet?.totalCommission)}</b></div>
          </div>
        `
    })}
      ${renderPanel({
      eyebrow: getCopy("Request", "Nema"),
      title: getCopy("New payout request", "Sabuwar bu\u0199atar biya"),
      body: `
          <form class="dash-form" id="payoutRequestForm" novalidate>
            <div class="dash-form-row dash-form-row--half">
              <div>
                <label class="dash-label" for="payoutAmount">${getCopy("Amount (NGN)", "Adadin ku\u0257i (NGN)")}</label>
                <input class="dash-input" id="payoutAmount" name="amount" type="number" min="1" step="1" required placeholder="5000" />
              </div>
              <div>
                <label class="dash-label" for="payoutBank">${getCopy("Bank name", "Sunan banki")}</label>
                <input class="dash-input" id="payoutBank" name="bankName" type="text" required placeholder="${getCopy("e.g. First Bank", "misali First Bank")}" />
              </div>
            </div>
            <div class="dash-form-row dash-form-row--half">
              <div>
                <label class="dash-label" for="payoutAccNum">${getCopy("Account number", "Lambar asusun")}</label>
                <input class="dash-input" id="payoutAccNum" name="accountNumber" type="text" inputmode="numeric" pattern="[0-9]{10}" required placeholder="0123456789" />
              </div>
              <div>
                <label class="dash-label" for="payoutAccName">${getCopy("Account name", "Sunan asusun")}</label>
                <input class="dash-input" id="payoutAccName" name="accountName" type="text" required placeholder="${getCopy("As on bank records", "Kamar yadda yake a banki")}" />
              </div>
            </div>
            <div class="dash-form-actions">
              <button type="submit" class="btn btn-primary">${getCopy("Submit request", "Aika bu\u0199ata")}</button>
            </div>
            <div id="payoutRequestStatus" class="dash-form-status" role="status" aria-live="polite"></div>
          </form>
        `
    })}
      ${renderPanel({
      eyebrow: getCopy("History", "Tarihi"),
      title: getCopy("Payout requests", "Bu\u0199atun biya"),
      body: renderMiniRows(
        data.payouts.map((p) => ({ title: `#${p.id.slice(-6).toUpperCase()} \xB7 ${p.bankName ?? getCopy("Bank", "Banki")}`, meta: p.requestedAt ? formatDate(p.requestedAt) : getCopy("Requested", "An nema"), value: renderMoney(p.amount), status: p.status })),
        { title: getCopy("No payout requests", "Babu bu\u0199atun biya"), body: getCopy("Submit a request when your balance is ready.", "Aika bu\u0199ata sa'ad da ku\u0257inka ya shirya.") }
      )
    })}
    </div>`
  );
}
function renderReviewsPage(user, data) {
  return shell2(
    "vendor/reviews",
    getCopy("Feedback", "Ra'ayi"),
    getCopy("Customer reviews", "Ra'ayoyin kwastoma"),
    getCopy("Monitor product ratings and customer feedback to improve your store quality.", "Sa ido kan \u0199imar kaya da ra'ayoyin kwastoma don inganta ingancin shagonka."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("All reviews", "Dukkan ra'ayoyi"),
      title: `${data.reviews.length} ${getCopy("reviews", "ra'ayoyi")}`,
      body: data.reviews.length ? `<div class="dash-notification-stack">${data.reviews.map((r) => `
              <article class="dash-review-item">
                <div class="dash-review-rating">${"\u2605".repeat(r.rating)}${"\u2606".repeat(5 - r.rating)}</div>
                <div class="dash-review-body">
                  <strong>${escapeHtml(r.reviewerName ?? getCopy("Customer", "Kwastoma"))}</strong>
                  <span>${escapeHtml(r.comment)}</span>
                  <time>${formatDate(r.createdAt)}</time>
                </div>
                ${r.hidden ? `<span class="dash-badge dash-badge--hidden">${getCopy("Hidden", "A \u0253oye")}</span>` : ""}
              </article>
            `).join("")}</div>` : renderEmptyState(getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), getCopy("Customer reviews on your products will appear here.", "Ra'ayoyin kwastoma akan kayanka za su bayyana a nan."))
    })}
    </div>`
  );
}
function renderVendorOverview(user, currentPath = "vendor/overview") {
  const data = getVendorDashboardData(user);
  if (currentPath === "vendor/products") return renderProductsPage(user, data);
  if (currentPath === "vendor/orders") return renderOrdersPage2(user, data);
  if (currentPath === "vendor/inventory") return renderInventoryPage(user, data);
  if (currentPath === "vendor/revenue") return renderRevenuePage(user, data);
  if (currentPath === "vendor/payouts") return renderPayoutsPage(user, data);
  if (currentPath === "vendor/reviews") return renderReviewsPage(user, data);
  return renderDashShell("vendor", currentPath, `
      ${renderDashboardHeader({
    eyebrow: getCopy("Vendor workspace", "Wurin aiki na dillali"),
    title: data.businessName,
    description: getCopy("Manage products, inventory, orders, revenue, payouts, reviews, analytics, and store readiness.", "Kula da kaya, ajiya, ododi, ku\u0257in shiga, biyan ku\u0257i, ra'ayoyi, nazari, da shirye-shiryen shago."),
    actions: [
      { label: getCopy("Add product", "Saka kaya"), href: "#vendorProductForm" },
      { label: getCopy("Request payout", "Neman biya"), route: "vendor/payouts", tone: "secondary" }
    ]
  })}

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
    action: { label: getCopy("All orders", "Dukkan ododi"), route: "vendor/orders" },
    body: renderMiniRows(
      data.orders.slice(0, 6).map((order) => ({
        title: `#${order.id.slice(-6).toUpperCase()}`,
        meta: `${formatDate(order.createdAt)} \xB7 ${order.paymentStatus}`,
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
              <div class="dash-money-line"><span>${getCopy("Available", "Da ake da shi")}</span><b>${renderMoney(data.wallet?.availableBalance)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.wallet?.pendingBalance)}</b></div>
              <div class="dash-money-line dash-money-total"><span>${getCopy("Commission", "Kwamiti")}</span><b>${renderMoney(data.wallet?.totalCommission)}</b></div>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Feedback", "Ra'ayi"),
    title: getCopy("Latest reviews", "Ra'ayoyi na kwanan nan"),
    action: { label: getCopy("Reviews", "Ra'ayoyi"), route: "vendor/reviews" },
    body: renderMiniRows(
      data.reviews.map((review) => ({
        title: `${"\u2605".repeat(review.rating)}${"\u2606".repeat(5 - review.rating)} \u2014 ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
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
                <label><span>${getCopy("Product name (English)", "Suna (Turanci)")}</span><input type="text" name="productName" minlength="2" maxlength="90" required placeholder="${getCopy("e.g. Plain black jallabiya", "misali Jallabiya baki")}" /></label>
                <label><span>${getCopy("Product name (Hausa)", "Suna (Hausa)")}</span><input type="text" name="productNameHa" minlength="2" maxlength="90" placeholder="${getCopy("e.g. Jallabiya baki", "misali Jallabiya baki")}" /></label>
                <label><span>${getCopy("Description (English)", "Bayani (Turanci)")}</span><input type="text" name="descriptionEn" maxlength="240" placeholder="${getCopy("Short product description", "Takaitaccen bayanin kaya")}" /></label>
                <label><span>${getCopy("Description (Hausa)", "Bayani (Hausa)")}</span><input type="text" name="descriptionHa" maxlength="240" placeholder="${getCopy("Takaitaccen bayanin kaya", "Takaitaccen bayanin kaya")}" /></label>
                <label><span>${getCopy("Value / price", "Farashi")}</span><input type="text" inputmode="numeric" name="productValue" required placeholder="15000" autocomplete="off" /></label>
                <label><span>${getCopy("Quantity available", "Yawan kaya a ajiya")}</span><input type="number" name="quantityAvailable" min="0" step="1" required placeholder="10" /></label>
                <label><span>${getCopy("Category", "Rukunin kaya")}</span><select name="productCategory" required><option value="food">${getCopy("Food", "Abinci")}</option><option value="fashion">${getCopy("Fashion", "Kaya")}</option><option value="children">${getCopy("Children", "Yara")}</option><option value="essentials">${getCopy("Essentials", "Abubuwan da ake bukata")}</option></select></label>
                <label><span>${getCopy("Product picture", "Hoton kaya")}</span><input type="file" name="productImage" accept="image/png,image/jpeg,image/webp" required /><small>${getCopy("JPEG, PNG, or WebP. Large phone photos are optimized before upload.", "JPEG, PNG, ko WebP. Ana inganta hotuna kafin aika.")}</small></label>
                <button type="submit">${getCopy("Add product", "\u0198ara kaya")}</button>
                <button type="submit" class="secondary-action" data-keep-details title="${getCopy("Keeps category, price, description and stock for the next product \u2014 only name and image reset.", "Yana ri\u0199e rukuni, farashi, bayani da ajiya don kaya na gaba \u2014 suna da hoto ne kawai ake share.")}">${getCopy("Add & list similar", "\u0198ara sannan lissafa makamancinsa")}</button>
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
  `);
}

// src/pages/admin/overview.ts
function shell3(currentPath, eyebrow, title, description, actions, body) {
  return renderDashShell("admin", currentPath, `
    ${renderDashboardHeader({ eyebrow, title, description, actions })}
    ${body}
  `);
}
function asUsers(list) {
  return list;
}
function renderUsersPage(data) {
  const allUsers = asUsers(data.users);
  const visibleUsers = allUsers.slice(0, 50);
  const limitNote = allUsers.length > visibleUsers.length ? renderDashboardNote(getCopy(`Showing first ${visibleUsers.length} of ${allUsers.length} users to keep the admin registry responsive.`, `Ana nuna masu amfani ${visibleUsers.length} daga ${allUsers.length} don rajistar admin ta yi sauri.`)) : "";
  const rows = visibleUsers.map((u) => `
    <div class="dash-table-row">
      <div class="dash-table-cell"><strong>${escapeHtml(u.name ?? u.phone)}</strong><small>${escapeHtml(u.email ?? "")}</small></div>
      <div class="dash-table-cell"><span class="dash-badge dash-badge--${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></div>
      <div class="dash-table-cell">${escapeHtml(u.phone)}</div>
      <div class="dash-table-cell"><time>${u.createdAt ? formatDate(u.createdAt) : "\u2014"}</time></div>
    </div>
  `).join("");
  return shell3(
    "admin/users",
    getCopy("Users", "Masu amfani"),
    getCopy("All platform users", "Dukkan masu amfani a dandalin"),
    getCopy("View and manage every registered account \u2014 customers, vendors, and admins.", "Duba da sarrafa kowane asusun da aka yi rajista \u2014 kwastoma, dillalai, da admin."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Registry", "Rajista"),
      title: `${data.users.length} ${getCopy("users", "masu amfani")}`,
      body: data.users.length ? `<div class="dash-table"><div class="dash-table-head"><span>${getCopy("Name", "Suna")}</span><span>${getCopy("Role", "Matsayi")}</span><span>${getCopy("Phone", "Waya")}</span><span>${getCopy("Joined", "Ranar shiga")}</span></div>${rows}</div>${limitNote}` : renderEmptyState(getCopy("No users yet", "Babu masu amfani tukuna"), getCopy("User accounts will appear here once people sign up.", "Asusun masu amfani za su bayyana a nan da zarar mutane suka yi rajista."))
    })}
    </div>`
  );
}
function renderVendorsPage(data) {
  const allUsers = asUsers(data.users);
  const pendingVendors = allUsers.filter((u) => u.role === "vendor" && u.vendorStatus === "pending");
  const approvedVendors = allUsers.filter((u) => u.role === "vendor" && u.vendorStatus === "approved");
  function vendorRows(list, showActions) {
    return list.map((u) => `
      <div class="dash-mini-row" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">
        <div class="dash-mini-row-main">
          <strong>${escapeHtml(u.name ?? u.phone)}</strong>
          <span>${escapeHtml(u.phone)} \xB7 ${u.createdAt ? formatDate(u.createdAt) : "\u2014"}</span>
        </div>
        <div class="dash-mini-row-aside">
          <span class="dash-badge dash-badge--${escapeHtml(u.vendorStatus ?? "pending")}">${escapeHtml(u.vendorStatus ?? "pending")}</span>
          ${showActions ? `
            <button type="button" class="btn btn-sm btn-success admin-approve-vendor" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">${getCopy("Approve", "Amince")}</button>
            <button type="button" class="btn btn-sm btn-danger admin-reject-vendor" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">${getCopy("Reject", "\u0198i")}</button>
          ` : ""}
        </div>
      </div>
    `).join("");
  }
  return shell3(
    "admin/vendors",
    getCopy("Vendors", "Dillalai"),
    getCopy("Vendor management", "Sarrafa dillalai"),
    getCopy("Review applications, approve new vendors, and manage existing vendor accounts.", "Duba aikace-aikace, amince da sabbin dillalai, da sarrafa asusun dillalai masu akwai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Queue", "Layi"),
      title: `${pendingVendors.length} ${getCopy("pending applications", "aikace-aikacen da ke jira")}`,
      body: pendingVendors.length ? `<div class="dash-mini-rows">${vendorRows(pendingVendors, true)}</div>` : renderEmptyState(getCopy("No pending applications", "Babu aikace-aikacen da ke jira"), getCopy("New vendor applications will appear here for review.", "Sabbin aikace-aikacen dillalai za su bayyana a nan don duba."))
    })}
      ${renderPanel({
      eyebrow: getCopy("Active", "Masu aiki"),
      title: `${approvedVendors.length} ${getCopy("approved vendors", "dillalai da aka amince")}`,
      body: approvedVendors.length ? `<div class="dash-mini-rows">${vendorRows(approvedVendors, false)}</div>` : renderEmptyState(getCopy("No approved vendors", "Babu dillalai da aka amince"), "")
    })}
      <div id="vendorApprovals" class="dash-legacy-queues" hidden></div>
    </div>`
  );
}
function renderProductsPage2(data) {
  return shell3(
    "admin/products",
    getCopy("Catalog", "Jerin kaya"),
    getCopy("Product moderation", "Duba kayan"),
    getCopy("Approve, hide, or reject vendor product listings before they appear in the public catalog.", "Amince, \u0253oye, ko \u0199i jerin kayan dillalai kafin su bayyana a cikin jerin kayan jama'a."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("All products", "Dukkan kaya"),
      title: `${data.counts.products} ${getCopy("listed products", "kayan da ke cikin jeri")}`,
      body: `<div class="product-moderation-list" id="productModeration"></div>${renderEmptyState(getCopy("Product list loading\u2026", "Ana loda jerin kaya\u2026"), getCopy("Admin product actions will populate here from live data.", "Ayyukan kayan admin za su cika a nan daga bayanan masu rai."))}`
    })}
    </div>`
  );
}
function renderOrdersPage3(data) {
  const visibleOrders = data.orders.slice(0, 20);
  const limitNote = data.orders.length > visibleOrders.length ? renderDashboardNote(getCopy(`Showing latest ${visibleOrders.length} of ${data.orders.length} orders.`, `Ana nuna sabbin oda ${visibleOrders.length} daga ${data.orders.length}.`)) : "";
  return shell3(
    "admin/orders",
    getCopy("Operations", "Ayyuka"),
    getCopy("All orders", "Dukkan ododi"),
    getCopy("View and manage every customer order on the platform.", "Duba da sarrafa kowane oda na kwastoma a dandalin."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Orders", "Ododi"),
      title: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`,
      body: `${renderMiniRows(
        visibleOrders.map((o) => ({
          title: `#${o.id.slice(-6).toUpperCase()} \xB7 ${"customerName" in o ? o.customerName ?? "" : ""}`,
          meta: `${formatDate(o.createdAt)} \xB7 ${"paymentStatus" in o ? o.paymentStatus ?? "" : ""}`,
          value: renderMoney("subtotal" in o ? o.subtotal : void 0),
          status: o.status
        })),
        { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here.", "Ododi na kwastoma za su bayyana a nan.") }
      )}${limitNote}`
    })}
      <div class="record-list" id="orderRecords" hidden></div>
    </div>`
  );
}
function renderPaymentsPage(data) {
  const pending = data.payments.filter((p) => p.status === "pending");
  const failed = data.payments.filter((p) => p.status === "failed");
  return shell3(
    "admin/payments",
    getCopy("Finance", "Ku\u0257i"),
    getCopy("Payment control", "Kula da biyan ku\u0257i"),
    getCopy("Verify, approve, and audit all platform payment transactions.", "Tabbatar, amince, da duba dukkan ma'amalolin biya a dandalin."),
    [],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
      { label: getCopy("Paid volume", "Adadin da aka biya"), value: renderMoney(data.revenue.paid), detail: getCopy("Total confirmed payments", "Jimillar biyan ku\u0257i da aka tabbatar"), tone: "success" },
      { label: getCopy("Pending", "Jira"), value: pending.length, detail: renderMoney(data.revenue.pending), tone: "warning" },
      { label: getCopy("Failed", "Ya gaza"), value: failed.length, detail: getCopy("Requires action", "Yana bu\u0199atar aiki"), tone: failed.length ? "danger" : "neutral" },
      { label: getCopy("Commission", "Kwamiti"), value: renderMoney(data.revenue.commission), detail: getCopy("Platform earnings", "Ku\u0257in dandalin"), tone: "info" }
    ])}
      ${renderPanel({
      eyebrow: getCopy("Exceptions", "Matsaloli"),
      title: getCopy("Pending and failed payments", "Biyan ku\u0257i da ke jira da wa\u0257anda suka gaza"),
      body: renderMiniRows(
        [...failed, ...pending].slice(0, 10).map((p) => ({
          title: p.reference ?? p.id,
          meta: `${p.method ?? "\u2014"} \xB7 ${formatDate(p.createdAt)}`,
          value: renderMoney(p.amount),
          status: p.status
        })),
        { title: getCopy("No payment exceptions", "Babu matsalolin biya"), body: getCopy("Failed and pending payment alerts appear here.", "Garga\u0257in biya da ya gaza da na jira suna bayyana a nan.") }
      )
    })}
      <div class="record-list" id="paymentStatus" hidden></div>
    </div>`
  );
}
function renderPayoutsPage2(data) {
  const pending = data.payouts.filter((p) => p.status === "pending");
  const visiblePayouts = data.payouts.slice(0, 25);
  const payoutLimitNote = data.payouts.length > visiblePayouts.length ? renderDashboardNote(getCopy(`Showing latest ${visiblePayouts.length} of ${data.payouts.length} payout requests.`, `Ana nuna sabbin bu\u0199atun biya ${visiblePayouts.length} daga ${data.payouts.length}.`)) : "";
  return shell3(
    "admin/payouts",
    getCopy("Finance", "Ku\u0257i"),
    getCopy("Vendor payouts", "Biyan dillalai"),
    getCopy("Review and process vendor settlement requests.", "Duba da aiwatar da bu\u0199atun tantancewa na dillalai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Queue", "Layi"),
      title: `${pending.length} ${getCopy("pending payout requests", "bu\u0199atun biya da ke jira")}`,
      body: pending.length ? `<div class="dash-mini-rows">${pending.map((p) => `
              <div class="dash-mini-row" data-payout-id="${escapeHtml(p.id)}">
                <div class="dash-mini-row-main">
                  <strong>${escapeHtml(p.accountName ?? "\u2014")} \xB7 ${escapeHtml(p.bankName ?? "\u2014")}</strong>
                  <span>${escapeHtml(p.accountNumber ?? "\u2014")} \xB7 ${p.requestedAt ? formatDate(p.requestedAt) : "\u2014"}</span>
                </div>
                <div class="dash-mini-row-aside">
                  <b>${renderMoney(p.amount)}</b>
                  <button type="button" class="btn btn-sm btn-success admin-approve-payout" data-payout-id="${escapeHtml(p.id)}">${getCopy("Approve", "Amince")}</button>
                  <button type="button" class="btn btn-sm btn-danger admin-reject-payout" data-payout-id="${escapeHtml(p.id)}">${getCopy("Reject", "\u0198i")}</button>
                </div>
              </div>
            `).join("")}</div>` : renderEmptyState(getCopy("No pending payouts", "Babu biyan ku\u0257i da ke jira"), getCopy("Vendor payout requests will appear here for action.", "Bu\u0199atun biyan dillalai za su bayyana a nan don aiki."))
    })}
      ${renderPanel({
      eyebrow: getCopy("History", "Tarihi"),
      title: getCopy("All payout requests", "Dukkan bu\u0199atun biya"),
      body: `${renderMiniRows(
        visiblePayouts.map((p) => ({ title: p.accountName ?? p.id, meta: `${p.bankName ?? "\u2014"} \xB7 ${p.requestedAt ? formatDate(p.requestedAt) : "\u2014"}`, value: renderMoney(p.amount), status: p.status })),
        { title: getCopy("No payouts", "Babu biyan ku\u0257i"), body: "" }
      )}${payoutLimitNote}`
    })}
      <div class="withdrawal-list" id="withdrawalQueue" hidden></div>
    </div>`
  );
}
function renderReviewsPage2(data) {
  const visibleReviews = data.reviews.slice(0, 20);
  const reviewLimitNote = data.reviews.length > visibleReviews.length ? renderDashboardNote(getCopy(`Showing latest ${visibleReviews.length} of ${data.reviews.length} reviews.`, `Ana nuna sabbin ra'ayoyi ${visibleReviews.length} daga ${data.reviews.length}.`)) : "";
  return shell3(
    "admin/reviews",
    getCopy("Trust", "Amana"),
    getCopy("Review moderation", "Duba ra'ayoyi"),
    getCopy("Hide or restore product reviews to maintain catalog quality.", "\u0181oye ko maido da ra'ayoyin kayan don kula da ingancin jerin kaya."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Reviews", "Ra'ayoyi"),
      title: `${data.reviews.length} ${getCopy("platform reviews", "ra'ayoyin dandalin")}`,
      body: data.reviews.length ? `<div class="dash-notification-stack">${visibleReviews.map((r) => `
              <article class="dash-review-item" data-review-id="${escapeHtml(r.id)}">
                <div class="dash-review-rating">${"\u2605".repeat(r.rating)}${"\u2606".repeat(5 - r.rating)}</div>
                <div class="dash-review-body">
                  <strong>${escapeHtml(r.reviewerName ?? getCopy("Customer", "Kwastoma"))}</strong>
                  <span>${escapeHtml(r.comment)}</span>
                  <time>${formatDate(r.createdAt)}</time>
                </div>
                <button type="button" class="btn btn-sm ${r.hidden ? "btn-ghost" : "btn-danger-ghost"} admin-toggle-review" data-review-id="${escapeHtml(r.id)}" data-hidden="${r.hidden ? "true" : "false"}">
                  ${r.hidden ? getCopy("Restore", "Maido") : getCopy("Hide", "\u0181oye")}
                </button>
              </article>
            `).join("")}</div>${reviewLimitNote}` : renderEmptyState(getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), getCopy("Customer product reviews will appear here for moderation.", "Ra'ayoyin kayan kwastoma za su bayyana a nan don duba."))
    })}
      <div class="review-moderation-list" id="reviewModeration" hidden></div>
    </div>`
  );
}
function renderPromotionsPage(data) {
  return shell3(
    "admin/promotions",
    getCopy("Marketing", "Talla"),
    getCopy("Promotions", "Yanayin farashi na musamman"),
    getCopy("Create and manage discount codes, flash sales, and category promotions.", "\u0198ir\u0199ira da sarrafa lambobin rangwame, siyarwa ta gaggawa, da yanayin farashi na rukunai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Active", "Masu aiki"),
      title: `${data.promotions.filter((p) => p.active).length} ${getCopy("active promotions", "yanayin farashi na musamman masu aiki")}`,
      body: data.promotions.length ? renderMiniRows(
        data.promotions.map((p) => ({
          title: getLocalizedValue({ en: p.title.en ?? "", ha: p.title.ha ?? "" }),
          meta: `${p.type} \xB7 ${p.discountPercent ? `${p.discountPercent}% off` : p.code ?? "\u2014"}`,
          status: p.active ? "active" : "inactive"
        })),
        { title: getCopy("No promotions", "Babu yanayin farashi na musamman"), body: "" }
      ) : renderEmptyState(getCopy("No promotions yet", "Babu yanayin farashi na musamman tukuna"), getCopy("Create promotions to boost catalog visibility and sales.", "\u0198ir\u0199ira yanayin farashi na musamman don \u0199ara bayyanuwar jerin kaya da siyarwa."))
    })}
    </div>`
  );
}
function renderReportsPage(data) {
  return shell3(
    "admin/reports",
    getCopy("Analytics", "Nazari"),
    getCopy("Growth reports", "Rahotannin girma"),
    getCopy("Track platform performance, user growth, product views, and revenue trends.", "Bin diddigin aiwatarwar dandalin, girmar masu amfani, ra'ayoyin kaya, da yanayin ku\u0257in shiga."),
    [],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
      { label: getCopy("Total GMV", "Jimillar GMV"), value: renderMoney(data.revenue.total), detail: getCopy("Gross merchandise value", "Jimillar darajar kaya"), tone: "success" },
      { label: getCopy("Commission earned", "Kwamiti da aka samu"), value: renderMoney(data.revenue.commission), detail: getCopy("Platform revenue", "Ku\u0257in dandalin"), tone: "info" },
      { label: getCopy("Total users", "Jimillar masu amfani"), value: data.counts.totalUsers, detail: getCopy("Registered accounts", "Asusun da aka yi rajista"), tone: "neutral" },
      { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: getCopy("All time", "A kowane lokaci"), tone: "neutral" }
    ])}
      ${renderPanel({
      eyebrow: getCopy("Analytics", "Nazari"),
      title: getCopy("Best sellers and search trends", "Mafi siyarwa da yanayin bincike"),
      body: data.analytics?.bestSellingProducts?.length ? renderMiniRows(
        data.analytics.bestSellingProducts.slice(0, 8).map((item) => ({
          title: item.productId,
          meta: `${item.quantity} ${getCopy("sold", "an saya")} \xB7 ${renderMoney(item.sales)}`,
          status: "active"
        })),
        { title: getCopy("No analytics data", "Babu bayanan nazari"), body: "" }
      ) : renderEmptyState(getCopy("Analytics loading", "Ana loda nazari"), getCopy("Connect /admin/analytics endpoint to see live platform data.", "Ha\u0257a hanyar /admin/analytics don ganin bayanan dandalin masu rai."))
    })}
      <div id="advancedAnalytics" hidden></div>
    </div>`
  );
}
function renderSystemHealthPage() {
  return shell3(
    "admin/system-health",
    getCopy("Infrastructure", "Ababen more rayuwa"),
    getCopy("System health", "Lafiyar tsarin"),
    getCopy("Monitor API uptime, database connectivity, storage, and email delivery.", "Sa ido kan lokacin aiki na API, ha\u0257in bayanan, ajiya, da isar da imel."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
      eyebrow: getCopy("Health checks", "Duba lafiya"),
      title: getCopy("Service status", "Yanayin sabis"),
      body: `
          <div class="dash-health-grid">
            <article data-state="ok"><strong>API</strong><span>${getCopy("Health endpoint available at /api/health", "Hanyar lafiya tana akwai a /api/health")}</span></article>
            <article data-state="ok"><strong>${getCopy("Database", "Bayanan")}</strong><span>${getCopy("Reported by /api/health", "An ruwaito ta /api/health")}</span></article>
            <article data-state="pending"><strong>${getCopy("Blob storage", "Ajiyar fayiloli")}</strong><span>${getCopy("Add health probe to backend", "\u0198ara binciken lafiya zuwa \u0253angaren baya")}</span></article>
            <article data-state="pending"><strong>${getCopy("Email / notifications", "Imel / sanarwa")}</strong><span>${getCopy("Add delivery provider status check", "\u0198ara duba matsayin mai isar da imel")}</span></article>
            <article data-state="pending"><strong>${getCopy("Error tracking", "Bin diddigin kuskure")}</strong><span>${getCopy("Connect Sentry or equivalent", "Ha\u0257a Sentry ko mai kama da shi")}</span></article>
          </div>
        `
    })}
    </div>`
  );
}
function renderAdminOverview(currentPath = "admin/overview") {
  const data = getAdminDashboardData();
  if (currentPath === "admin/users") return renderUsersPage(data);
  if (currentPath === "admin/vendors") return renderVendorsPage(data);
  if (currentPath === "admin/products") return renderProductsPage2(data);
  if (currentPath === "admin/orders") return renderOrdersPage3(data);
  if (currentPath === "admin/payments") return renderPaymentsPage(data);
  if (currentPath === "admin/payouts") return renderPayoutsPage2(data);
  if (currentPath === "admin/reviews") return renderReviewsPage2(data);
  if (currentPath === "admin/promotions") return renderPromotionsPage(data);
  if (currentPath === "admin/reports") return renderReportsPage(data);
  if (currentPath === "admin/system-health") return renderSystemHealthPage();
  const pendingPayments = data.payments.filter((payment) => payment.status === "pending");
  const failedPayments = data.payments.filter((payment) => payment.status === "failed");
  const recentOrders = data.orders.slice(0, 6);
  return renderDashShell("admin", currentPath, `
      ${renderDashboardHeader({
    eyebrow: getCopy("Marketplace control room", "Cibiyar kula da kasuwa"),
    title: getCopy("Admin dashboard", "Allon admin"),
    description: getCopy("Control users, vendors, products, approvals, orders, payments, disputes, categories, reports, audit logs, and system health.", "Kula da masu amfani, dillalai, kaya, amincewa, ododi, biyan ku\u0257i, rikice-rikice, rukunai, rahotanni, tarihin aiki, da lafiyar tsarin."),
    actions: [
      { label: getCopy("Vendor approvals", "Amincewa da dillalai"), route: "admin/vendors" },
      { label: getCopy("System health", "Lafiyar tsarin"), route: "admin/system-health", tone: "secondary" }
    ]
  })}

      ${renderStatGrid([
    { label: getCopy("Total users", "Jimillar masu amfani"), value: data.counts.totalUsers, detail: getCopy("Registered accounts", "Asusun da aka yi rajista"), tone: "info" },
    { label: getCopy("Active vendors", "Dillalan da ke aiki"), value: data.counts.activeVendors, detail: `${data.counts.pendingVendorApprovals} ${getCopy("pending", "jira")}`, tone: "success" },
    { label: getCopy("Pending approvals", "Amincewa da ke jira"), value: data.counts.pendingVendorApprovals + data.counts.pendingProductApprovals, detail: getCopy("Vendor and product queues", "Layukan dillalai da kaya"), tone: "warning" },
    { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: `${renderMoney(data.revenue.total)} GMV`, tone: "neutral" },
    { label: getCopy("Revenue", "Ku\u0257in shiga"), value: renderMoney(data.revenue.paid), detail: `${renderMoney(data.revenue.commission)} ${getCopy("commission", "kwamiti")}`, tone: "success" },
    { label: getCopy("Payment issues", "Matsalolin biya"), value: data.counts.failedPayments, detail: `${pendingPayments.length} ${getCopy("pending", "jira")}`, tone: data.counts.failedPayments ? "danger" : "neutral" },
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
                <small>${getCopy("Listings waiting for catalog approval", "Kayan da ke jiran amincewa a cikin jeri")}</small>
              </article>
              <article>
                <span>${getCopy("Payout requests", "Bu\u0199atun biya")}</span>
                <strong>${data.payouts.filter((p) => p.status === "pending").length}</strong>
                <small>${getCopy("Vendor settlement decisions", "Yanke shawara kan biyan dillalai")}</small>
              </article>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Finance", "Ku\u0257i"),
    title: getCopy("Revenue and payment control", "Kula da ku\u0257in shiga da biyan ku\u0257i"),
    action: { label: getCopy("Payments", "Biyan ku\u0257i"), route: "admin/payments" },
    body: `
            <div class="dash-money-stack">
              <div class="dash-money-line"><span>${getCopy("Paid volume", "Adadin da aka biya")}</span><b>${renderMoney(data.revenue.paid)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.revenue.pending)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Refunded", "An mayar da ku\u0257i")}</span><b>${renderMoney(data.revenue.refunded)}</b></div>
              <div class="dash-money-line dash-money-total"><span>${getCopy("Commission", "Kwamiti")}</span><b>${renderMoney(data.revenue.commission)}</b></div>
            </div>
          `
  })}

        ${renderPanel({
    eyebrow: getCopy("Orders", "Ododi"),
    title: getCopy("Recent platform activity", "Ayyukan dandali na kwanan nan"),
    action: { label: getCopy("Orders", "Ododi"), route: "admin/orders" },
    body: renderMiniRows(
      recentOrders.map((order) => ({
        title: `#${order.id.slice(-6).toUpperCase()}`,
        meta: `${"customerName" in order ? order.customerName ?? "" : ""} \xB7 ${formatDate(order.createdAt)}`,
        value: renderMoney("subtotal" in order ? order.subtotal : void 0),
        status: order.status
      })),
      { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here once checkout starts.", "Ododi na kwastoma za su bayyana a nan da zarar biyan ku\u0257i ya fara.") }
    )
  })}

        ${renderPanel({
    eyebrow: getCopy("Catalog", "Jerin kaya"),
    title: getCopy("Quick links", "Hanyoyin sauri"),
    body: `
            <div class="dash-action-stack">
              <a class="dash-command-card" href="#admin/products" data-route="admin/products">
                <strong>${getCopy("Product control", "Kula da kaya")}</strong>
                <span>${data.counts.products} ${getCopy("products across all moderation states", "kaya a cikin yanayin duba duka")}</span>
              </a>
              <a class="dash-command-card" href="#admin/users" data-route="admin/users">
                <strong>${getCopy("User management", "Sarrafa masu amfani")}</strong>
                <span>${data.counts.totalUsers} ${getCopy("registered accounts", "asusun da aka yi rajista")}</span>
              </a>
              <a class="dash-command-card" href="#admin/reports" data-route="admin/reports">
                <strong>${getCopy("Growth reports", "Rahotannin girma")}</strong>
                <span>${getCopy("Track customer and vendor growth, popular searches, best sellers.", "Bin diddigin girmar kwastoma da dillalai, bincike na yau da kullum, mafi siyarwa.")}</span>
              </a>
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
          `
  })}
      </div>

      <div hidden>
        <div class="record-list" id="paymentStatus"></div>
        <div class="withdrawal-list" id="withdrawalQueue"></div>
        <div class="record-list" id="orderRecords"></div>
        <div class="review-moderation-list" id="reviewModeration"></div>
        <div class="vendor-approval-list" id="vendorApprovals"></div>
        <div class="product-moderation-list" id="productModeration"></div>
        <div id="vendorSubscriptionSummary"></div>
        <div id="advancedAnalytics"></div>
        <div id="phaseThreeControls"></div>
        <div id="popularSearches"></div>
        <div id="failedSearchList"></div>
        <div id="demandTrends"></div>
        <table><tbody id="searchHistoryTable"></tbody></table>
      </div>
  `);
}

// src/checkout.ts
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
    const name = escapeHtml(product.name[state.language]);
    const lineTotal = escapeHtml(formatPrice(
      parseInt(product.price.replace(/[^0-9]/g, ""), 10) * item.quantity
    ));
    return `<div class="checkout-item"><span>${name} \xD7${item.quantity}</span><span>${lineTotal}</span></div>`;
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
  if (!state.currentUser?.token) {
    showToast({ message: getCopy("Sign in to place your order. Your cart is saved.", "Shiga don sanya odarka. An adana kwandonka.") });
    window.location.hash = "login";
    return;
  }
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
    const customerName = String(data.get("customerName") || "").trim();
    const customerPhone = String(data.get("customerPhone") || "").trim();
    const deliveryOption = String(data.get("deliveryOption") || "delivery") === "pickup" ? "pickup" : "delivery";
    const deliveryAddress = String(data.get("deliveryAddress") || "").trim();
    const deliveryArea = String(data.get("deliveryArea") || "").trim();
    const paymentMethod = String(data.get("paymentMethod") || "");
    if (!customerName) {
      errorEl.textContent = getCopy("Enter your full name.", "Shigar da cikakken sunanka.");
      form.querySelector("input[name='customerName']")?.focus();
      return;
    }
    if (!customerPhone || !isValidPhone(customerPhone)) {
      errorEl.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci.");
      form.querySelector("input[name='customerPhone']")?.focus();
      return;
    }
    if (deliveryOption === "delivery" && !deliveryAddress) {
      errorEl.textContent = getCopy(
        "Delivery address is required for delivery orders.",
        "Adireshin kai kaya yana da mahimmanci don oda kai kaya."
      );
      form.querySelector("input[name='deliveryAddress']")?.focus();
      return;
    }
    if (!deliveryArea) {
      errorEl.textContent = getCopy("Delivery area is required.", "Ana bu\u0199atar yankin isarwa.");
      form.querySelector("input[name='deliveryArea']")?.focus();
      return;
    }
    if (!paymentMethod) {
      errorEl.textContent = getCopy("Choose a payment method.", "Za\u0253i hanyar biyan ku\u0257i.");
      form.querySelector("select[name='paymentMethod']")?.focus();
      return;
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = getCopy("Placing order\u2026", "Ana sanya oda\u2026");
    }
    errorEl.textContent = "";
    function showSuccess(orderId, paymentStatus) {
      clearCart();
      modal.querySelector("#checkoutFormView").hidden = true;
      const successView = modal.querySelector("#checkoutSuccessView");
      successView.hidden = false;
      modal.querySelector("#checkoutOrderId").textContent = getCopy(
        `Order ID: ${orderId} \u2014 Payment: ${paymentStatus}`,
        `Lambar oda: ${orderId} \u2014 Biya: ${paymentStatus}`
      );
    }
    function resetSubmit() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = getCopy("Place order", "Sanya oda");
      }
    }
    if (!state.currentUser?.token) {
      errorEl.textContent = getCopy("Sign in to place your order.", "Shiga don sanya odarka.");
      resetSubmit();
      return;
    }
    try {
      await reconcileCartWithServer();
      const result = await api.checkout({
        customerName,
        customerPhone,
        deliveryOption,
        deliveryAddress,
        deliveryArea,
        paymentMethod
      });
      const authorizationUrl = result.payment?.authorizationUrl;
      if (authorizationUrl) {
        clearCart();
        if (submitBtn) submitBtn.textContent = getCopy("Redirecting to secure payment\u2026", "Ana tura zuwa biyan ku\u0257i mai tsaro\u2026");
        window.location.assign(authorizationUrl);
        return;
      }
      resetSubmit();
      showSuccess(result.order.id, result.order.paymentStatus ?? "pending");
    } catch (error) {
      errorEl.textContent = error instanceof Error ? error.message : getCopy("Checkout failed. Please try again.", "Biyan kudi ya kasa. Da fatan za a sake gwadawa.");
      resetSubmit();
    }
  }
  modal.querySelector(".checkout-done")?.addEventListener("click", () => closeCheckoutModal());
}
function closeCheckoutModal() {
  const modal = document.getElementById("checkoutModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
}

// src/auth.ts
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
  const response = await api.login(identifier, password);
  saveApiToken(response.token, response.expiresAt);
  return sessionFromApi(response);
}
async function syncApiRegistration(input) {
  if (input.password.length < 8) return null;
  const response = await api.register(input);
  saveApiToken(response.token, response.expiresAt);
  return sessionFromApi(response);
}
function saveSession(session, expiresAt) {
  state.currentUser = session;
  if (session.token) saveApiToken(session.token, expiresAt);
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
        <p class="muted">${getCopy("Enter your phone number or email address.", "Shigar da lambar wayarka ko adireshin email.")}</p>
        <form id="authPhoneForm" novalidate>
          <label>
            <span>${getCopy("Email or phone number", "Email ko lambar waya")}</span>
            <input type="text" id="authPhone" name="phone" placeholder="08012345678 or name@email.com"
              required autocomplete="username" />
          </label>
          <button type="submit">${getCopy("Continue", "Ci gaba")}</button>
          <p class="form-message" id="authPhoneError" role="alert"></p>
        </form>
      </div>
      <div id="authPhaseOtp" class="auth-phase" hidden>
        <p class="muted" id="authOtpHint"></p>
        <form id="authOtpForm" novalidate>
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
          <button type="submit" id="authSubmitBtn">${getCopy("Sign in", "Shiga")}</button>
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
  const credForm = modal.querySelector("#authOtpForm");
  const phonePhase = modal.querySelector("#authPhasePhone");
  const credPhase = modal.querySelector("#authPhaseOtp");
  const credHint = modal.querySelector("#authOtpHint");
  const phoneError = modal.querySelector("#authPhoneError");
  const credError = modal.querySelector("#authOtpError");
  const signupFields = modal.querySelector("#authSignupFields");
  const vendorFields = modal.querySelector("#authVendorFields");
  const accountType = modal.querySelector("#authAccountType");
  const submitBtn = modal.querySelector("#authSubmitBtn");
  let pendingIdentifier = "";
  let needsSignup = false;
  function setSignupRequired(required) {
    signupFields.hidden = !required;
    modal.querySelectorAll("#authFirstName, #authLastName, #authEmail, #authPassword, #authDeliveryAddress").forEach((input) => {
      input.required = required;
    });
    accountType.required = required;
    setVendorRequired(required && accountType.value === "vendor");
    submitBtn.textContent = required ? getCopy("Create account", "\u0198ir\u0199iri asusu") : getCopy("Sign in", "Shiga");
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
    phoneError.textContent = "";
    const identifier = (modal.querySelector("#authPhone")?.value || "").trim();
    if (!identifier) {
      phoneError.textContent = getCopy("Enter your phone number or email address.", "Shigar da lambar waya ko adireshin email.");
      modal.querySelector("#authPhone")?.focus();
      return;
    }
    if (identifier.includes("@") && !isValidEmail(identifier)) {
      phoneError.textContent = getCopy("Enter a valid email address.", "Shigar da adireshin email mai inganci.");
      modal.querySelector("#authPhone")?.focus();
      return;
    }
    if (!identifier.includes("@") && !isValidPhone(identifier)) {
      phoneError.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci.");
      modal.querySelector("#authPhone")?.focus();
      return;
    }
    pendingIdentifier = identifier;
    const normalised = identifier.includes("@") ? identifier : normalizePhone(identifier);
    const emailProfile = identifier.includes("@") ? findUserProfileByEmail(identifier) : null;
    const phoneProfile = findUserProfileByPhone(normalised);
    needsSignup = !emailProfile && !phoneProfile && !isAdminPhone(normalised);
    setSignupRequired(needsSignup);
    const loginPasswordWrap = modal.querySelector("#authLoginPasswordWrap");
    if (loginPasswordWrap) loginPasswordWrap.hidden = needsSignup;
    credHint.textContent = needsSignup ? getCopy(
      `Creating a new account for ${normalised}.`,
      `Ana \u0199ir\u0199irar sabon asusu don ${normalised}.`
    ) : getCopy(
      `Welcome back. Enter your password to sign in.`,
      `Barka da dawo. Shigar da kalmar sirri don shiga.`
    );
    phonePhase.hidden = true;
    credPhase.hidden = false;
    const focusTarget = needsSignup ? modal.querySelector("#authFirstName") : modal.querySelector("#authLoginPassword");
    focusTarget?.focus();
  });
  accountType.addEventListener("change", () => {
    setVendorRequired(needsSignup && accountType.value === "vendor");
  });
  credForm.addEventListener("submit", (e) => {
    void handleCredSubmit(e);
  });
  async function handleCredSubmit(e) {
    e.preventDefault();
    credError.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = getCopy("Signing in\u2026", "Ana shiga\u2026");
    const normalised = pendingIdentifier.includes("@") ? pendingIdentifier : normalizePhone(pendingIdentifier);
    try {
      let session = null;
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
        if (!firstName || firstName.length < 2) {
          credError.textContent = getCopy("First name must be at least 2 characters.", "Sunan farko ya zama akalla haruffa 2.");
          modal.querySelector("#authFirstName")?.focus();
          return;
        }
        if (!lastName || lastName.length < 2) {
          credError.textContent = getCopy("Last name must be at least 2 characters.", "Sunan karshe ya zama akalla haruffa 2.");
          modal.querySelector("#authLastName")?.focus();
          return;
        }
        if (!email || !isValidEmail(email)) {
          credError.textContent = getCopy("Enter a valid email address.", "Shigar da adireshin email mai inganci.");
          modal.querySelector("#authEmail")?.focus();
          return;
        }
        if (!password || password.length < 8) {
          credError.textContent = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta kasance akalla haruffa 8.");
          modal.querySelector("#authPassword")?.focus();
          return;
        }
        if (!deliveryAddress) {
          credError.textContent = getCopy("Delivery address is required.", "Ana bu\u0199atar adireshin isarwa.");
          modal.querySelector("#authDeliveryAddress")?.focus();
          return;
        }
        if (selectedType === "vendor" && !businessName) {
          credError.textContent = getCopy("Business name is required.", "Ana bu\u0199atar sunan kasuwanci.");
          modal.querySelector("#authBusinessName")?.focus();
          return;
        }
        if (selectedType === "vendor" && !area) {
          credError.textContent = getCopy("Business area is required.", "Ana bu\u0199atar yankin kasuwanci.");
          modal.querySelector("#authArea")?.focus();
          return;
        }
        session = await syncApiRegistration({
          phone: normalised,
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
        if (!session) throw new Error(getCopy("Registration failed. Please try again.", "Rajista ta kasa. Da fatan za a sake gwadawa."));
      } else {
        const password = (modal.querySelector("#authLoginPassword")?.value || "").trim();
        if (!password) {
          credError.textContent = getCopy("Password is required to sign in.", "Ana bu\u0199atar kalmar sirri don shiga.");
          modal.querySelector("#authLoginPassword")?.focus();
          return;
        }
        session = await syncApiLogin(pendingIdentifier, password);
        if (!session) throw new Error(getCopy("Incorrect phone number or password.", "Lambar waya ko kalmar sirri ba daidai ba."));
      }
      saveSession(session);
      closeAuthModal();
      const roleCopy = session.role === "admin" ? getCopy("Admin signed in.", "Admin ya shiga.") : session.role === "vendor" ? getCopy("Vendor account signed in.", "Asusun dillali ya shiga.") : getCopy("Signed in successfully!", "An shiga cikin nasara!");
      showToast({ message: roleCopy });
    } catch (err) {
      credError.textContent = err instanceof Error ? err.message : getCopy("Sign in failed. Check your details and try again.", "Shiga ta kasa. Duba bayananku ku sake gwadawa.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = needsSignup ? getCopy("Create account", "\u0198ir\u0199iri asusu") : getCopy("Sign in", "Shiga");
    }
  }
  modal.querySelector("#authBack")?.addEventListener("click", () => {
    phonePhase.hidden = false;
    credPhase.hidden = true;
    setSignupRequired(false);
    phoneError.textContent = "";
    credError.textContent = "";
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
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "");
    const deliveryAddress = String(data.get("deliveryAddress") || "");
    const preferredLanguage = data.get("preferredLanguage") === "ha" ? "ha" : "en";
    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(" ");
    if (state.currentUser?.token) {
      try {
        const result = await api.updateMe({ name, email, deliveryAddress, preferredLanguage });
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
    if (updated && !state.currentUser?.token) return;
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
function refreshUserPanelLanguage() {
  const panel = document.getElementById("userPanel");
  if (!panel || !state.currentUser) return;
  panel.remove();
  openUserPanel();
}

// src/product-modal.ts
var activeProductId = null;
function buildVendorProfile(vendorName) {
  const profile = vendorProfiles[vendorName];
  if (!profile) return "";
  const stars = renderStars(profile.rating);
  return `
    <div class="vendor-profile-card">
      <div class="vendor-profile-header">
        <strong>${escapeHtml(profile.name)}</strong>
        <span class="vendor-since">${getCopy(`Since ${profile.since}`, `Tun ${profile.since}`)}</span>
      </div>
      <div class="vendor-stats">
        <span class="vendor-rating-stars">${stars} <strong>${profile.rating.toFixed(1)}</strong></span>
        <span>${escapeHtml(String(profile.totalOrders))} ${getCopy("orders", "oda")}</span>
        <span>${escapeHtml(String(profile.fulfillmentRate))}% ${getCopy("fulfilled", "an cika")}</span>
      </div>
      <p class="vendor-response">${getCopy("Response: ", "Amsa: ")}${escapeHtml(getLocalizedValue(profile.responseTime))}</p>
    </div>
  `;
}
function buildModalHtml(product) {
  const name = product.name[state.language];
  const subcategory = product.subcategory[state.language];
  const availability = product.availability[state.language];
  const avg = getAverageRating(product.id);
  const reviewCount = getProductReviews(product.id).length;
  const wished = isWishlisted(product.id);
  return `
    <div class="modal-backdrop" id="productModal" role="dialog" aria-modal="true" aria-labelledby="productModalName">
      <div class="modal-box modal-box-wide">
        <div class="modal-header">
          <h2 id="productModalName">${escapeHtml(name)}</h2>
          <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
        </div>

        <div class="product-modal-body">
          <div class="product-modal-thumb" style="--accent: ${product.accent}">
            ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(name)}" loading="lazy" />` : `<span>${escapeHtml(subcategory)}</span>`}
          </div>

          <div class="product-modal-meta">
            <p class="product-meta">
              <span>${escapeHtml(product.category[state.language])}</span>
              <span>${escapeHtml(product.vendor)}</span>
              <span>${escapeHtml(product.area)}</span>
            </p>
            <p class="availability">${escapeHtml(availability)}</p>
            ${product.description?.[state.language] ? `<p>${escapeHtml(product.description[state.language])}</p>` : ""}
            <p>${getCopy("Stock", "Adadi")}: ${escapeHtml(String(product.quantityAvailable ?? "Available"))}</p>
            ${reviewCount > 0 ? `
              <div class="modal-review-summary">
                ${renderStars(avg)} <span class="review-count-label">${avg.toFixed(1)} (${reviewCount} ${getCopy("reviews", "ra'ayoyi")})</span>
              </div>
            ` : ""}
          </div>

          <div class="product-modal-price">
            <span class="price">${escapeHtml(product.price)}</span>
          </div>

          <div class="product-modal-actions">
            <button type="button" class="btn-primary" id="modalAddToCart">
              ${getCopy("Add to cart", "Saka a kwando")}
            </button>
            <button type="button" class="btn-wishlist${wished ? " is-wishlisted" : ""}" id="modalWishlist"
              aria-pressed="${wished}" aria-label="${wished ? getCopy("Remove from wishlist", "Cire daga jerin da aka ajiye") : getCopy("Save to wishlist", "Ajiye zuwa jerin kaya")}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>
              </svg>
              ${wished ? getCopy("Saved", "An ajiye") : getCopy("Save", "Ajiye")}
            </button>
          </div>

          ${buildVendorProfile(product.vendor)}

          <section class="reviews-section">
            <h3>${getCopy("Customer reviews", "Ra'ayoyin kwastomomi")}</h3>
            <div id="modalReviewList">
              ${reviewCount > 0 ? renderReviewList(product.id) : `<p class="muted">${getCopy("No reviews yet. Be the first!", "Babu ra'ayoyi tukuna. Ka fara!")}</p>`}
            </div>
            <div id="modalReviewForm">
              ${renderReviewForm(product.id)}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
function openProductModal(productId) {
  const product = getProductById(productId);
  if (!product) return;
  closeProductModal();
  activeProductId = productId;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildModalHtml(product);
  const modal = wrapper.firstElementChild;
  document.body.appendChild(modal);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("modal-visible"));
  });
  modal.querySelector(".modal-close")?.addEventListener("click", closeProductModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeProductModal();
  });
  modal.querySelector(".product-modal-thumb img")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const src = e.currentTarget.src;
    const lb = document.createElement("div");
    lb.className = "img-lightbox";
    lb.innerHTML = `<button class="img-lightbox-close" aria-label="Close">\xD7</button><img src="${escapeHtml(src)}" alt="${escapeHtml(product.name[state.language])}" />`;
    document.body.appendChild(lb);
    const close = () => lb.remove();
    lb.addEventListener("click", close);
    lb.querySelector(".img-lightbox-close")?.addEventListener("click", close);
    const onKey = (ev) => {
      if (ev.key === "Escape") {
        close();
        document.removeEventListener("keydown", onKey);
      }
    };
    document.addEventListener("keydown", onKey);
  });
  modal.querySelector("#modalAddToCart")?.addEventListener("click", () => {
    if (!state.currentUser) {
      closeProductModal();
      openAuthModal();
      return;
    }
    addToCart(productId);
    const btn = modal.querySelector("#modalAddToCart");
    btn.textContent = getCopy("Added!", "An saka!");
    window.setTimeout(() => {
      btn.textContent = getCopy("Add to cart", "Saka a kwando");
    }, 1400);
  });
  modal.querySelector("#modalWishlist")?.addEventListener("click", () => {
    if (!state.currentUser) {
      closeProductModal();
      openAuthModal();
      return;
    }
    toggleWishlist(productId, product.name[state.language]);
    syncWishlistCount();
    const btn = modal.querySelector("#modalWishlist");
    const now = isWishlisted(productId);
    btn.classList.toggle("is-wishlisted", now);
    btn.setAttribute("aria-pressed", String(now));
    btn.querySelector("svg")?.nextSibling?.replaceWith(
      document.createTextNode(` ${now ? getCopy("Saved", "An ajiye") : getCopy("Save", "Ajiye")}`)
    );
  });
  const reviewForm = modal.querySelector("#reviewForm");
  reviewForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(reviewForm);
    const name = String(data.get("reviewerName") || "").trim();
    const rating = Number(data.get("rating") || 0);
    const comment = String(data.get("comment") || "").trim();
    const msgEl = modal.querySelector("#reviewMessage");
    if (!name) {
      msgEl.textContent = getCopy("Enter your name before submitting a review.", "Shigar da sunanka kafin ka aika ra'ayi.");
      reviewForm.querySelector("input[name='reviewerName']")?.focus();
      return;
    }
    if (!rating) {
      msgEl.textContent = getCopy("Choose a rating for your review.", "Za\u0253i daraja don ra'ayinka.");
      reviewForm.querySelector("input[name='rating']")?.focus();
      return;
    }
    if (!comment || comment.length < 10) {
      msgEl.textContent = getCopy(
        "Write a longer review comment (at least 10 characters).",
        "Rubuta tsawon sharhi na ra'ayi (akalla haruffa 10)."
      );
      reviewForm.querySelector("textarea[name='comment']")?.focus();
      return;
    }
    addReview(productId, name, rating, comment);
    msgEl.textContent = getCopy("Review submitted. Thank you!", "An aika ra'ayin. Na gode!");
    reviewForm.reset();
    const listEl = modal.querySelector("#modalReviewList");
    listEl.innerHTML = renderReviewList(productId);
    showToast({ message: getCopy("Review added!", "An saka ra'ayi!") });
  });
  document.addEventListener("keydown", handleModalKeydown);
  modal.querySelector("#modalAddToCart")?.focus();
  api.productReviews(productId).then((res) => {
    const listEl = modal.querySelector("#modalReviewList");
    if (!listEl || !res.reviews.length) return;
    listEl.innerHTML = res.reviews.slice(0, 5).map(
      (r) => `
          <div class="review-item">
            <div class="review-header">
              <span class="review-stars">${renderStars(r.rating)}</span>
              <strong>${escapeHtml(r.reviewerName ?? "")}</strong>
              <span class="review-date">${escapeHtml(formatDate(r.createdAt))}</span>
            </div>
            <p>${escapeHtml(r.comment)}</p>
          </div>`
    ).join("");
  }).catch(() => void 0);
}
function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
  document.removeEventListener("keydown", handleModalKeydown);
  activeProductId = null;
}
function refreshActiveProductModal() {
  if (!activeProductId || !document.getElementById("productModal")) return;
  const productId = activeProductId;
  document.getElementById("productModal")?.remove();
  document.removeEventListener("keydown", handleModalKeydown);
  activeProductId = null;
  openProductModal(productId);
}
function handleModalKeydown(e) {
  if (e.key === "Escape") closeProductModal();
}

// src/admin-gate.ts
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

// src/frontend-data.ts
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

// src/auth-pages.ts
function validateLogin(id, pw) {
  const e = {};
  if (!id.trim()) e.identifier = getCopy("Email or phone number is required.", "Ana bukatar imel ko lambar waya.");
  else if (id.includes("@") && !isValidEmail(id)) e.identifier = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!pw) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (pw.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  return e;
}
function validateCustomer(d) {
  const e = {};
  if (!d.fullName?.trim()) e.fullName = getCopy("Full name is required.", "Ana bukatar cikakken suna.");
  if (!d.email?.trim()) e.email = getCopy("Email address is required.", "Ana bukatar adireshin imel.");
  else if (!isValidEmail(d.email)) e.email = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!d.phone?.trim()) e.phone = getCopy("Phone number is required.", "Ana bukatar lambar waya.");
  else if (!isValidPhone(d.phone)) e.phone = getCopy("Enter a valid Nigerian phone number (at least 10 digits).", "Shigar da lambar waya ta Najeriya mai inganci (akalla lambobi 10).");
  if (!d.password) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (d.password.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  if (d.password !== d.confirmPassword) e.confirmPassword = getCopy("Passwords do not match.", "Kalmar sirri ba ta dace ba.");
  if (!d.terms) e.terms = getCopy("You must accept the terms and conditions to continue.", "Dole ne ka amince da sharudda kafin ka ci gaba.");
  return e;
}
function validateVendor(d) {
  const e = {};
  if (!d.businessName?.trim()) e.businessName = getCopy("Business or store name is required.", "Ana bukatar sunan kasuwanci ko shago.");
  if (!d.ownerName?.trim()) e.ownerName = getCopy("Owner full name is required.", "Ana bukatar cikakken sunan mai shago.");
  if (!d.email?.trim()) e.email = getCopy("Email address is required.", "Ana bukatar adireshin imel.");
  else if (!isValidEmail(d.email)) e.email = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!d.phone?.trim()) e.phone = getCopy("Phone number is required.", "Ana bukatar lambar waya.");
  else if (!isValidPhone(d.phone)) e.phone = getCopy("Enter a valid Nigerian phone number (at least 10 digits).", "Shigar da lambar waya ta Najeriya mai inganci (akalla lambobi 10).");
  if (!d.category) e.category = getCopy("Please select your business category.", "Da fatan za a zabi rukunin kasuwanci.");
  if (!d.area?.trim()) e.area = getCopy("Business location or area is required.", "Ana bukatar wurin kasuwanci ko yanki.");
  if (!d.password) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (d.password.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  if (d.password !== d.confirmPassword) e.confirmPassword = getCopy("Passwords do not match.", "Kalmar sirri ba ta dace ba.");
  if (!d.terms) e.terms = getCopy("You must accept the terms and conditions to continue.", "Dole ne ka amince da sharudda kafin ka ci gaba.");
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
      btn.setAttribute("aria-label", showing ? getCopy("Show password", "Nuna kalmar sirri") : getCopy("Hide password", "Boye kalmar sirri"));
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
  hint.textContent = role === "vendor" ? getCopy("Sign in to access your vendor dashboard and manage your store.", "Shiga don bude allon dillali da kula da shagoka.") : getCopy("Sign in to shop from trusted local vendors around Kano.", "Shiga don saya daga amintattun dillalan gida a Kano.");
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
  setLoading(btn, true, getCopy("Signing in...", "Ana shiga..."));
  try {
    const res = await api.login(identifier, password);
    saveSession(buildSession(res.user, res.token));
  } catch (err) {
    const msg = err instanceof Error ? err.message : getCopy("Sign in failed. Please check your details and try again.", "Shiga ya kasa. Da fatan za a duba bayananka ka sake gwadawa.");
    if (formErr) formErr.textContent = msg;
    setLoading(btn, false, getCopy("Sign in", "Shiga"));
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
    hint.textContent = role === "vendor" ? getCopy("Create your store and start selling to real customers in Kano.", "Kirkiri shagoka ka fara sayarwa ga kwastomomi na gaske a Kano.") : getCopy("Join thousands of customers shopping from trusted local vendors.", "Shiga cikin dubban kwastomomi da ke saya daga amintattun dillalai.");
  }
  const btn = page.querySelector("#signupSubmitBtn");
  if (btn && !btn.disabled) {
    btn.textContent = role === "vendor" ? getCopy("Create vendor account", "Kirkiri asusun dillali") : getCopy("Create my account", "Kirkiri asusuna");
  }
  const brandSub = page.querySelector("#signupBrandSub");
  if (brandSub) {
    brandSub.textContent = role === "vendor" ? getCopy("Set up your store in minutes and reach thousands of customers across Kano.", "Kafa shagoka cikin mintuna ka kai ga dubban kwastomomi a fadin Kano.") : getCopy("Create your account in minutes and start shopping from trusted local vendors.", "Kirkiri asusunka cikin mintuna ka fara saya daga amintattun dillalai.");
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
  setLoading(btn, true, getCopy("Creating account...", "Ana kirkirar asusu..."));
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
    const msg = err instanceof Error ? err.message : getCopy("Sign up failed. Please try again.", "Rajista ta kasa. Da fatan za a sake gwadawa.");
    if (formErr) formErr.textContent = msg;
    const defaultLabel = role === "vendor" ? getCopy("Create vendor account", "Kirkiri asusun dillali") : getCopy("Create my account", "Kirkiri asusuna");
    setLoading(btn, false, defaultLabel);
  }
}
function getActiveAuthRole(page) {
  return page.querySelector("[data-role-tab].is-active")?.dataset.roleTab === "vendor" ? "vendor" : "customer";
}
function setText(root, selector, en, ha) {
  const node = root.querySelector(selector);
  if (node) node.textContent = getCopy(en, ha);
}
function setHtml(root, selector, en, ha) {
  const node = root.querySelector(selector);
  if (node) node.innerHTML = getCopy(en, ha);
}
function setPlaceholder(root, selector, en, ha) {
  const node = root.querySelector(selector);
  if (node) node.placeholder = getCopy(en, ha);
}
function setTrailingButtonText(button, en, ha) {
  if (!button) return;
  const text = getCopy(en, ha);
  const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (textNode) textNode.textContent = ` ${text}`;
  else button.append(document.createTextNode(` ${text}`));
}
function syncLoginPageCopy(page) {
  setText(page, ".auth-brand-headline", "Your local marketplace, wherever you are.", "Kasuwarka ta gida, duk inda kake.");
  setText(page, ".auth-brand-sub", "Shop from trusted vendors around Kano - or manage your store. All in one place.", "Saya daga amintattun dillalai a Kano ko kula da shagoka. Duk a wuri daya.");
  const trustItems = page.querySelectorAll(".auth-trust-list li");
  [
    [getCopy("Thousands of products from verified local vendors", "Dubban kaya daga tabbatattun dillalan gida")],
    [getCopy("Fast delivery across Kano and major areas", "Isarwa cikin sauri a Kano da manyan yankuna")],
    [getCopy("Secure payments with multiple options", "Biyan kudi mai tsaro da hanyoyi da dama")],
    [getCopy("Full English and Hausa language support", "Cikakken goyon bayan Turanci da Hausa")]
  ].forEach(([text], index) => {
    if (trustItems[index]) trustItems[index].textContent = text;
  });
  setText(page, "#login-page-heading", "Sign in to your account", "Shiga asusunka");
  setHtml(
    page,
    ".auth-card-subheading",
    'New to Kano Mart? <a href="#signup" data-route="signup">Create a free account</a>',
    'Sabon mai amfani ne a Kano Mart? <a href="#signup" data-route="signup">Kirkiri asusu kyauta</a>'
  );
  setTrailingButtonText(page.querySelector('[data-role-tab="customer"]'), "Customer", "Kwastoma");
  setTrailingButtonText(page.querySelector('[data-role-tab="vendor"]'), "Vendor", "Dillali");
  updateLoginRoleHint(page, getActiveAuthRole(page));
  setText(page, 'label[for="loginIdentifier"]', "Email or phone number", "Imel ko lambar waya");
  setPlaceholder(page, "#loginIdentifier", "08012345678 or name@email.com", "08012345678 ko suna@email.com");
  setText(page, 'label[for="loginPassword"]', "Password", "Kalmar sirri");
  setPlaceholder(page, "#loginPassword", "Enter your password", "Shigar da kalmar sirri");
  setText(page, ".auth-check-label span", "Remember me", "Tuna da ni");
  const loginBtn = page.querySelector("#loginSubmitBtn");
  if (loginBtn && !loginBtn.disabled) loginBtn.textContent = getCopy("Sign in", "Shiga");
}
function syncSignupPageCopy(page) {
  setText(page, ".auth-brand-headline", "Join the Kano marketplace community.", "Shiga cikin al'ummar kasuwar Kano.");
  const trustItems = page.querySelectorAll(".auth-trust-list li");
  [
    getCopy("Free for customers - no hidden fees", "Kyauta ga kwastomomi - babu boyayyen kudi"),
    getCopy("Browse hundreds of products from Kano vendors", "Bincika daruruwan kaya daga dillalan Kano"),
    getCopy("Vendors: reach real customers from day one", "Dillalai: ku kai ga kwastomomi tun daga rana ta farko"),
    getCopy("Verified, secure marketplace platform", "Dandali tabbatacce kuma mai tsaro")
  ].forEach((text, index) => {
    if (trustItems[index]) trustItems[index].textContent = text;
  });
  setText(page, "#signup-page-heading", "Create your account", "Kirkiri asusunka");
  setHtml(
    page,
    ".auth-card-subheading",
    'Already have an account? <a href="#login" data-route="login">Sign in</a>',
    'Kana da asusu? <a href="#login" data-route="login">Shiga</a>'
  );
  setTrailingButtonText(page.querySelector('[data-role-tab="customer"]'), "Customer", "Kwastoma");
  setTrailingButtonText(page.querySelector('[data-role-tab="vendor"]'), "Vendor / Seller", "Dillali / Mai sayarwa");
  setText(page, 'label[for="signupFullName"]', "Full name", "Cikakken suna");
  setPlaceholder(page, "#signupFullName", "e.g. Amina Bello", "misali Amina Bello");
  setText(page, 'label[for="signupBusinessName"]', "Business / Store name", "Sunan kasuwanci / shago");
  setPlaceholder(page, "#signupBusinessName", "e.g. Amina Fashion House", "misali Amina Fashion House");
  setText(page, 'label[for="signupOwnerName"]', "Owner full name", "Cikakken sunan mai shago");
  setPlaceholder(page, "#signupOwnerName", "e.g. Amina Bello", "misali Amina Bello");
  setText(page, 'label[for="signupEmail"]', "Email address", "Adireshin imel");
  setPlaceholder(page, "#signupEmail", "name@example.com", "suna@example.com");
  setText(page, 'label[for="signupPhone"]', "Phone number", "Lambar waya");
  setText(page, 'label[for="signupCategory"]', "Business category", "Rukunin kasuwanci");
  setText(page, '#signupCategory option[value=""]', "Select a category...", "Zabi rukuni...");
  setText(page, '#signupCategory option[value="food"]', "Food & Groceries", "Abinci da kayan masarufi");
  setText(page, '#signupCategory option[value="fashion"]', "Fashion & Clothing", "Kaya da tufafi");
  setText(page, '#signupCategory option[value="children"]', "Children & School Supplies", "Yara da kayan makaranta");
  setText(page, '#signupCategory option[value="essentials"]', "Essentials & Daily Needs", "Abubuwan yau da kullum");
  setText(page, 'label[for="signupArea"]', "Business location / area", "Wurin kasuwanci / yanki");
  setPlaceholder(page, "#signupArea", "e.g. Kantin Kwari, Tarauni, Sabon Gari", "misali Kantin Kwari, Tarauni, Sabon Gari");
  setHtml(
    page,
    ".vendor-signup-note",
    "<strong>About vendor accounts</strong>Products you list will appear in the marketplace after admin review. This typically takes 1-2 business days.",
    "<strong>Game da asusun dillali</strong>Kayan da ka saka za su bayyana a kasuwa bayan duba admin. Yawanci yana daukar kwanakin aiki 1-2."
  );
  setText(page, 'label[for="signupPassword"]', "Password", "Kalmar sirri");
  setPlaceholder(page, "#signupPassword", "At least 8 characters", "Akalla haruffa 8");
  setText(page, 'label[for="signupConfirmPassword"]', "Confirm password", "Tabbatar da kalmar sirri");
  setPlaceholder(page, "#signupConfirmPassword", "Re-enter your password", "Sake shigar da kalmar sirri");
  setHtml(
    page,
    ".auth-terms-field .auth-check-label span",
    'I agree to the <span class="auth-policy-link">Terms of Service</span> and <span class="auth-policy-link">Privacy Policy</span>',
    'Na amince da <span class="auth-policy-link">Sharuddan Amfani</span> da <span class="auth-policy-link">Dokar Sirri</span>'
  );
  applySignupRole(page, getActiveAuthRole(page));
}
function syncAuthPagesLanguage() {
  const loginPage = document.getElementById("loginPage");
  if (loginPage) {
    syncLoginPageCopy(loginPage);
  }
  const signupPage = document.getElementById("signupPage");
  if (signupPage) {
    syncSignupPageCopy(signupPage);
  }
  document.querySelectorAll(".pw-toggle").forEach((button) => {
    const showing = button.classList.contains("is-showing");
    button.setAttribute("aria-label", showing ? getCopy("Hide password", "Boye kalmar sirri") : getCopy("Show password", "Nuna kalmar sirri"));
  });
}

// src/app.ts
var routes = /* @__PURE__ */ new Set([
  // Public
  "home",
  "catalog",
  "payments",
  "login",
  "signup",
  // Customer sub-routes
  "customer",
  "customer/overview",
  "customer/orders",
  "customer/profile",
  "customer/cart",
  "customer/wishlist",
  "customer/notifications",
  // Vendor sub-routes (top-level #vendor is semi-public marketing; sub-routes require vendor auth)
  "vendor",
  "vendor/overview",
  "vendor/products",
  "vendor/inventory",
  "vendor/orders",
  "vendor/revenue",
  "vendor/payouts",
  "vendor/reviews",
  // Admin sub-routes
  "admin",
  "admin/overview",
  "admin/users",
  "admin/vendors",
  "admin/products",
  "admin/orders",
  "admin/payments",
  "admin/reviews",
  "admin/promotions",
  "admin/payouts",
  "admin/reports",
  "admin/system-health",
  // Legacy alias
  "orders"
]);
var AUTH_ROUTES = /* @__PURE__ */ new Set(["login", "signup"]);
var SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";
var THEME_STORAGE_KEY = "kanoMart.theme";
function getCurrentRoute() {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  if (routes.has(raw)) return raw;
  const parts = raw.split("/");
  if (parts.length >= 2) {
    const sub = `${parts[0]}/${parts[1]}`;
    if (routes.has(sub)) return sub;
  }
  return "home";
}
function getVisitorRole() {
  return state.currentUser?.role ?? "guest";
}
function getDefaultRouteForRole(role = getVisitorRole()) {
  if (role === "admin") return "admin";
  if (role === "vendor") return "vendor";
  if (role === "customer") return "customer";
  return "home";
}
function canAccessRoute(route) {
  const role = getVisitorRole();
  const base = route.split("/")[0];
  if (base === "admin") return role === "admin";
  if (base === "customer" || route === "orders") return role === "customer";
  if (route !== "vendor" && base === "vendor") return role === "vendor";
  if (AUTH_ROUTES.has(route)) return role === "guest";
  return true;
}
var _orderPollTimer = null;
function startOrderPolling() {
  if (_orderPollTimer !== null) return;
  const poll = () => {
    if (state.currentUser?.role !== "customer" || !state.currentUser.token) return;
    fetchLiveOrders().then(() => renderOrdersPage4()).catch(() => void 0);
  };
  poll();
  _orderPollTimer = setInterval(poll, 15e3);
}
function stopOrderPolling() {
  if (_orderPollTimer !== null) {
    clearInterval(_orderPollTimer);
    _orderPollTimer = null;
  }
}
function setRoute(route = getCurrentRoute()) {
  let nextRoute = routes.has(route) ? route : "home";
  if (!canAccessRoute(nextRoute)) {
    nextRoute = getDefaultRouteForRole();
    if (window.location.hash.replace("#", "") !== nextRoute) {
      window.history.replaceState(null, "", `#${nextRoute}`);
    }
  }
  const baseRoute = nextRoute.split("/")[0];
  const pageSectionKey = baseRoute === "orders" ? "orders" : baseRoute;
  document.querySelectorAll("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === pageSectionKey;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const linkRoute = link.dataset.route ?? "";
    const isActive = linkRoute === nextRoute || nextRoute.startsWith(linkRoute + "/") && linkRoute !== "home";
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
  document.body.classList.toggle("is-auth-route", AUTH_ROUTES.has(nextRoute));
  document.body.classList.toggle("on-home", nextRoute === "home");
  window.scrollTo({ top: 0, behavior: "smooth" });
  closeSidebar();
  if ((nextRoute === "orders" || nextRoute === "customer/orders") && state.currentUser?.role === "customer") {
    startOrderPolling();
  } else {
    stopOrderPolling();
  }
  renderDashboardPage(nextRoute);
  if (baseRoute === "vendor" && state.currentUser?.role === "vendor") {
    void refreshLiveVendorDashboard();
  }
  if (baseRoute === "admin" && state.currentUser?.role === "admin") {
    void refreshLiveAdminDashboard();
  }
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
      label: getCopy("Guest", "Bako"),
      title: getCopy("Marketplace", "Kasuwa"),
      hint: getCopy("Sign in to unlock your dashboard.", "Shiga don bude allon aikinka."),
      meta: getCopy("Sign in with mobile number", "Shiga da lambar waya"),
      avatar: "?"
    },
    customer: {
      label: getCopy("Customer", "Kwastoma"),
      title: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
      hint: getCopy("Orders, cart, wishlist, and checkout.", "Ododi, kwando, jerin so, da biyan kudi."),
      meta: user?.phone ?? getCopy("Customer account", "Asusun kwastoma"),
      avatar: user?.name?.slice(0, 1).toUpperCase() || "C"
    },
    vendor: {
      label: getCopy("Vendor", "Dillali"),
      title: getCopy("Seller workspace", "Wurin aiki na mai sayarwa"),
      hint: user?.vendorStatus === "approved" ? getCopy("Store approved and ready.", "An amince da shago kuma ya shirya.") : getCopy("Approval status is pending.", "Matsayin amincewa yana jira."),
      meta: user?.vendorStatus ? `${getCopy("Vendor", "Dillali")}: ${localizeStatus(user.vendorStatus)}` : getCopy("Vendor account", "Asusun dillali"),
      avatar: user?.name?.slice(0, 1).toUpperCase() || "V"
    },
    admin: {
      label: getCopy("Admin", "Admin"),
      title: getCopy("Operations control", "Sarrafa ayyuka"),
      hint: getCopy("Approvals, finance, orders, and risk.", "Amincewa, kudi, ododi, da hadari."),
      meta: getCopy("Verified admin number", "Lambar admin da aka tabbatar"),
      avatar: "A"
    }
  }[role] ?? {
    label: getCopy("Guest", "Bako"),
    title: getCopy("Marketplace", "Kasuwa"),
    hint: getCopy("Sign in to unlock your dashboard.", "Shiga don bude allon aikinka."),
    meta: getCopy("Sign in with mobile number", "Shiga da lambar waya"),
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
  document.body.classList.toggle("is-guest", role === "guest");
  if (role === "guest") closeSidebar();
  if (!canAccessRoute(getCurrentRoute())) {
    setRoute(getDefaultRouteForRole(role));
  }
}
function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  const activeTheme = document.documentElement.dataset.theme;
  if (activeTheme === "dark" || activeTheme === "light") return activeTheme;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function getCurrentTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function syncThemeToggles(theme = getCurrentTheme()) {
  const isDark = theme === "dark";
  const label = isDark ? getCopy("Switch to normal mode", "Canza zuwa yanayin haske") : getCopy("Switch to dark mode", "Canza zuwa yanayin duhu");
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  });
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty("color-scheme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0c1f18" : "#176b4d"
  );
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  syncThemeToggles(theme);
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
var activeFilterCats = /* @__PURE__ */ new Set();
var activeFilterAreas = /* @__PURE__ */ new Set();
var activeSortOrder = "relevance";
function applyFiltersAndSort(products2) {
  let result = products2;
  if (activeFilterCats.size > 0) {
    result = result.filter((p) => {
      const cat = p.category.en.toLowerCase();
      return [...activeFilterCats].some((f) => cat.includes(f));
    });
  }
  if (activeFilterAreas.size > 0) {
    result = result.filter((p) => [...activeFilterAreas].some((a) => p.area?.toLowerCase().includes(a.toLowerCase())));
  }
  if (activeSortOrder === "price-asc") {
    result = [...result].sort((a, b) => {
      const pa = parseFloat(a.price.replace(/[^\d.]/g, "")) || 0;
      const pb = parseFloat(b.price.replace(/[^\d.]/g, "")) || 0;
      return pa - pb;
    });
  } else if (activeSortOrder === "price-desc") {
    result = [...result].sort((a, b) => {
      const pa = parseFloat(a.price.replace(/[^\d.]/g, "")) || 0;
      const pb = parseFloat(b.price.replace(/[^\d.]/g, "")) || 0;
      return pb - pa;
    });
  } else if (activeSortOrder === "newest") {
    result = [...result].sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  }
  return result;
}
function renderProductResults(products2 = state.lastResults) {
  const filtered = applyFiltersAndSort(products2);
  const { visibleProducts, hasMore } = paginateProducts(filtered, state.visibleProductCount);
  elements.resultsGrid.innerHTML = visibleProducts.map(renderProductCard).join("");
  elements.emptyState.hidden = filtered.length > 0;
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
    renderAdminDashboard();
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
    renderAdminDashboard();
  } catch {
  }
}
function renderCustomerDashboard() {
  const user = state.currentUser;
  if (!user || user.role !== "customer") return;
  const nameEl = document.querySelector("#customerWelcomeName");
  if (nameEl) {
    const firstName = user.firstName || user.name?.split?.(" ")?.[0] || "";
    nameEl.textContent = firstName ? getCopy(`Welcome back, ${firstName}!`, `Barka da dawo, ${firstName}!`) : getCopy("Welcome back!", "Barka da dawo!");
  }
  const orderCount = getOrders().filter((o) => o.customerPhone === user.phone).length;
  const cartCount = state.cartCount;
  const wishlistCount = Number(elements.wishlistCountEl.textContent) || 0;
  const statOrders = document.querySelector("#customerStatOrders");
  const statCart = document.querySelector("#customerStatCart");
  const statWishlist = document.querySelector("#customerStatWishlist");
  if (statOrders) statOrders.textContent = String(orderCount);
  if (statCart) statCart.textContent = String(cartCount);
  if (statWishlist) statWishlist.textContent = String(wishlistCount);
  const recentEl = document.querySelector("#customerRecentOrders");
  if (!recentEl) return;
  const recentOrders = getOrders().filter((o) => o.customerPhone === user.phone).slice(0, 3);
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
function renderOrdersPage4() {
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
  const currentRoute = getCurrentRoute();
  syncUserButton();
  syncRoleNavigation();
  syncAuthPagesLanguage();
  renderDashboardPage(currentRoute);
  renderCustomerDashboard();
  renderOrdersPage4();
  renderCartPanel();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderAdminDashboard();
  syncAllWishlistButtons();
  refreshUserPanelLanguage();
  refreshActiveProductModal();
  const userOrdersList = document.querySelector("#userOrdersList");
  if (userOrdersList) userOrdersList.innerHTML = renderOrdersPanel();
  if (document.querySelector("#wishlistModal")) openWishlistPanel();
}
async function refreshLiveVendorDashboard() {
  if (state.currentUser?.role !== "vendor" || !state.currentUser.token) return;
  try {
    await Promise.all([
      refreshLiveVendorProducts(),
      fetchLiveVendorData(),
      fetchLiveVendorApplication()
    ]);
    renderVendorProducts();
    renderVendorCommerce();
    const currentRoute = getCurrentRoute();
    if (currentRoute.startsWith("vendor")) renderDashboardPage(currentRoute);
  } catch {
  }
}
function wireDashboardEvents(container, routeForRefresh) {
  container.querySelector("#customerCartBtn")?.addEventListener("click", () => {
    renderCartPanel();
    openCart();
  });
  container.querySelector("#customerCartBtnSecondary")?.addEventListener("click", () => {
    renderCartPanel();
    openCart();
  });
  container.querySelector("#customerWishlistBtn")?.addEventListener("click", openWishlistPanel);
  container.querySelector("#checkoutFromCartBtn")?.addEventListener("click", () => {
    openCheckoutModal();
  });
  container.addEventListener("click", (event) => {
    const target = event.target;
    const incBtn = target?.closest(".cart-qty-inc");
    const decBtn = target?.closest(".cart-qty-dec");
    const remBtn = target?.closest(".cart-remove");
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
  const profileForm = container.querySelector("#profileUpdateForm");
  if (profileForm) {
    profileForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(profileForm);
      const statusEl = profileForm.querySelector("#profileUpdateStatus");
      const submit = profileForm.querySelector("button[type=submit]");
      if (submit) submit.disabled = true;
      if (statusEl) statusEl.textContent = getCopy("Saving\u2026", "Ana ajiyewa\u2026");
      const nameVal = String(fd.get("name") || "").trim();
      const emailVal = String(fd.get("email") || "").trim();
      const addrVal = String(fd.get("deliveryAddress") || "").trim();
      const langVal = String(fd.get("preferredLanguage") || "en");
      const apiBody = {
        ...nameVal ? { name: nameVal } : {},
        ...emailVal ? { email: emailVal } : {},
        ...addrVal ? { deliveryAddress: addrVal } : {},
        preferredLanguage: langVal
      };
      if (state.currentUser?.token) {
        api.updateMe(apiBody).then((res) => {
          if (state.currentUser) {
            state.currentUser = { ...state.currentUser, ...res.user };
            if (state.currentUser) saveSession(state.currentUser);
          }
          if (statusEl) {
            statusEl.textContent = getCopy("Profile saved!", "An ajiye bayanan sirri!");
            statusEl.className = "dash-form-status dash-form-status--success";
          }
        }).catch((err) => {
          if (statusEl) {
            statusEl.textContent = err.message || getCopy("Could not save profile.", "Ba a iya ajiye bayanan sirri ba.");
            statusEl.className = "dash-form-status dash-form-status--error";
          }
        }).finally(() => {
          if (submit) submit.disabled = false;
        });
      } else {
        if (state.currentUser) {
          state.currentUser = { ...state.currentUser, ...apiBody, name: nameVal || state.currentUser.name };
          saveSession(state.currentUser);
        }
        if (statusEl) {
          statusEl.textContent = getCopy("Profile saved locally.", "An ajiye bayanan sirri a na'ura.");
          statusEl.className = "dash-form-status dash-form-status--success";
        }
        if (submit) submit.disabled = false;
      }
    });
  }
  const vendorProductForm = container.querySelector("#vendorProductForm");
  if (vendorProductForm) {
    vendorProductForm.addEventListener("submit", (event) => void handleVendorProductSubmit(event));
  }
  container.addEventListener("change", (event) => {
    const select = event.target?.closest(".vendor-status-select");
    const productId = select?.dataset.productId;
    const value = select?.value;
    if (!productId || !value) return;
    setVendorProductListingStatus(productId, value);
    showToast({ message: getCopy("Product status updated.", "An sabunta yanayin kaya."), type: "success" });
    if (state.currentUser?.token) api.updateVendorProduct(productId, value).catch(() => void 0);
  });
  container.querySelector("#vendorProductsList")?.addEventListener("click", (event) => {
    const button = event.target?.closest("[data-vendor-product-action]");
    const productId = button?.dataset.vendorProductId;
    const action = button?.dataset.vendorProductAction;
    if (!productId || action !== "active" && action !== "out_of_stock" && action !== "taken_down") return;
    setVendorProductListingStatus(productId, action);
    renderVendorProducts();
    renderDashboardPage(routeForRefresh);
    showToast({ message: action === "active" ? getCopy("Product restored to catalog.", "An mayar da kaya kasuwa.") : getCopy("Product removed from catalog.", "An cire kaya daga kasuwa."), type: action === "active" ? "success" : "info" });
    if (state.currentUser?.token) api.updateVendorProduct(productId, action).catch(() => void 0);
  });
  container.querySelector("#vendorCommerceList")?.addEventListener("click", (event) => {
    const button = event.target?.closest("[data-vendor-order-ready]");
    const orderId = button?.dataset.vendorOrderReady;
    if (!orderId) return;
    advanceOrderStatus(orderId);
    renderDashboardPage(routeForRefresh);
    showToast({ message: getCopy("Order marked ready for pickup or delivery.", "An nuna oda a shirye domin dauka ko kaiwa."), type: "success" });
  });
  const payoutForm = container.querySelector("#payoutRequestForm");
  if (payoutForm) {
    payoutForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const fd = new FormData(payoutForm);
      const statusEl = payoutForm.querySelector("#payoutRequestStatus");
      const submit = payoutForm.querySelector("button[type=submit]");
      const amount = Number(fd.get("amount") || 0);
      const bankName = String(fd.get("bankName") || "").trim();
      const accountNumber = String(fd.get("accountNumber") || "").trim();
      const accountName = String(fd.get("accountName") || "").trim();
      if (amount < 1 || !bankName || accountNumber.length < 10 || !accountName) {
        if (statusEl) {
          statusEl.textContent = getCopy("Fill in all payout fields correctly.", "Cika dukkan filayen biya yadda ya kamata.");
          statusEl.className = "dash-form-status dash-form-status--error";
        }
        return;
      }
      if (submit) submit.disabled = true;
      if (statusEl) statusEl.textContent = getCopy("Submitting\u2026", "Ana aika\u2026");
      if (state.currentUser?.token) {
        api.requestPayout({ amount, bankName, accountNumber, accountName }).then(() => {
          if (statusEl) {
            statusEl.textContent = getCopy("Payout request submitted!", "An aika bu\u0199atar biya!");
            statusEl.className = "dash-form-status dash-form-status--success";
          }
          payoutForm.reset();
          showToast({ message: getCopy("Payout request submitted.", "An aika bu\u0199atar biya."), type: "success" });
        }).catch((err) => {
          if (statusEl) {
            statusEl.textContent = err.message || getCopy("Could not submit payout.", "Ba a iya aika bu\u0199atar biya ba.");
            statusEl.className = "dash-form-status dash-form-status--error";
          }
        }).finally(() => {
          if (submit) submit.disabled = false;
        });
      } else {
        requestWithdrawal(state.currentUser?.name ?? "", amount);
        if (statusEl) {
          statusEl.textContent = getCopy("Request saved locally.", "An ajiye bu\u0199ata a na'ura.");
          statusEl.className = "dash-form-status dash-form-status--success";
        }
        payoutForm.reset();
        if (submit) submit.disabled = false;
        renderDashboardPage(routeForRefresh);
      }
    });
  }
  container.addEventListener("click", (event) => {
    const target = event.target;
    const approveVendorBtn = target?.closest(".admin-approve-vendor");
    if (approveVendorBtn?.dataset.vendorId) {
      const id = approveVendorBtn.dataset.vendorId;
      approveVendorBtn.disabled = true;
      (state.currentUser?.token ? api.updateVendorApplication(id, { status: "approved" }) : Promise.resolve(reviewVendorRequest(id, "approved", "Admin approved"))).then(() => {
        showToast({ message: getCopy("Vendor approved.", "An amince da dillali."), type: "success" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => {
        showToast({ message: getCopy("Could not approve vendor.", "Ba a iya amincewa ba."), type: "error" });
        approveVendorBtn.disabled = false;
      });
      return;
    }
    const rejectVendorBtn = target?.closest(".admin-reject-vendor");
    if (rejectVendorBtn?.dataset.vendorId) {
      const id = rejectVendorBtn.dataset.vendorId;
      rejectVendorBtn.disabled = true;
      (state.currentUser?.token ? api.updateVendorApplication(id, { status: "rejected" }) : Promise.resolve(reviewVendorRequest(id, "rejected", "Admin rejected"))).then(() => {
        showToast({ message: getCopy("Vendor rejected.", "An \u0199i dillali."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => {
        showToast({ message: getCopy("Could not reject vendor.", "Ba a iya \u0199i ba."), type: "error" });
        rejectVendorBtn.disabled = false;
      });
      return;
    }
    const approvePayoutBtn = target?.closest(".admin-approve-payout");
    if (approvePayoutBtn?.dataset.payoutId) {
      const id = approvePayoutBtn.dataset.payoutId;
      approvePayoutBtn.disabled = true;
      (state.currentUser?.token ? api.updateAdminPayout(id, { status: "approved" }) : Promise.resolve(approveWithdrawal(id))).then(() => {
        showToast({ message: getCopy("Payout approved.", "An amince da biya."), type: "success" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => {
        showToast({ message: getCopy("Could not approve payout.", "Ba a iya amincewa da biya ba."), type: "error" });
        approvePayoutBtn.disabled = false;
      });
      return;
    }
    const rejectPayoutBtn = target?.closest(".admin-reject-payout");
    if (rejectPayoutBtn?.dataset.payoutId) {
      const id = rejectPayoutBtn.dataset.payoutId;
      rejectPayoutBtn.disabled = true;
      (state.currentUser?.token ? api.updateAdminPayout(id, { status: "rejected" }) : Promise.resolve(rejectWithdrawal(id))).then(() => {
        showToast({ message: getCopy("Payout rejected.", "An \u0199i biya."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => {
        showToast({ message: getCopy("Could not reject payout.", "Ba a iya \u0199i biya ba."), type: "error" });
        rejectPayoutBtn.disabled = false;
      });
      return;
    }
    const toggleReviewBtn = target?.closest(".admin-toggle-review");
    if (toggleReviewBtn?.dataset.reviewId) {
      const id = toggleReviewBtn.dataset.reviewId;
      const hidden = toggleReviewBtn.dataset.hidden === "true";
      toggleReviewBtn.disabled = true;
      (state.currentUser?.token ? api.updateAdminReview(id, { hidden: !hidden }) : Promise.resolve(hideReview(id))).then(() => {
        showToast({ message: getCopy(hidden ? "Review restored." : "Review hidden.", hidden ? "An maido da ra'ayi." : "An \u0253oye ra'ayi."), type: "info" });
        renderDashboardPage(routeForRefresh);
      }).catch(() => {
        showToast({ message: getCopy("Could not update review.", "Ba a iya sabunta ra'ayi ba."), type: "error" });
        toggleReviewBtn.disabled = false;
      });
      return;
    }
  });
}
function renderDashboardPage(route) {
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
      detail: { route, role: base, durationMs: Math.round(performance.now() - startedAt) }
    }));
  }
}
var _searchDebounceTimer = null;
function performSearch(rawQuery, debounceMs = 0) {
  const query = rawQuery.trim();
  if (!query) {
    state.lastQuery = "";
    state.visibleProductCount = PRODUCT_PAGE_SIZE;
    renderCatalogPreview();
    return;
  }
  if (_searchDebounceTimer !== null) clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = setTimeout(() => {
    _searchDebounceTimer = null;
    state.lastQuery = query;
    state.visibleProductCount = PRODUCT_PAGE_SIZE;
    renderLoadingProducts();
    document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    refreshLiveProducts({ q: query }).then((results) => {
      saveSearch(query, results);
      state.lastResults = results;
      updateResultCopy(query, results);
      renderProductResults(results);
    }).catch(() => {
      const results = getCachedSearchResults(query);
      saveSearch(query, results);
      state.lastResults = results;
      updateResultCopy(query, results);
      renderProductResults(results);
    });
  }, debounceMs);
}
function setLanguage(language) {
  state.language = language;
  localStorage.setItem(storageKeys.language, language);
  document.documentElement.lang = language;
  document.title = getCopy(
    "Kano Mart | Local Marketplace for Kano",
    "Kano Mart | Kasuwar Kano ta yanar gizo"
  );
  document.querySelectorAll("[data-en][data-ha]").forEach((node) => {
    if (node.matches(".sidebar-nav a, .sidebar-vendor-cta")) return;
    node.textContent = node.dataset[language] || "";
  });
  document.querySelectorAll("[data-alt-en][data-alt-ha]").forEach((node) => {
    node.alt = node.dataset[`alt${language === "en" ? "En" : "Ha"}`] || "";
  });
  document.querySelectorAll("[data-aria-en][data-aria-ha]").forEach((node) => {
    node.setAttribute("aria-label", node.dataset[`aria${language === "en" ? "En" : "Ha"}`] || "");
  });
  document.querySelectorAll("[data-placeholder-en][data-placeholder-ha]").forEach((node) => {
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
function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Invalid image"));
      return;
    }
    if (file.size > 15e5) {
      reject(new Error("Image too large"));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(new Error("Could not read image")));
    reader.readAsDataURL(file);
  });
}
function renderVendorDashHeader() {
  const user = state.currentUser;
  if (!user || user.role !== "vendor") return;
  const vendor = findVendorByPhone(user.phone);
  const businessName = vendor?.businessName || user.name;
  const status = user.vendorStatus ?? "pending";
  const nameEl = document.querySelector("#vendorDashBusinessName");
  if (nameEl) nameEl.textContent = businessName;
  const badge = document.querySelector("#vendorStatusBadge");
  if (badge) {
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    badge.dataset.status = status;
  }
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
async function handleVendorProductSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.querySelector("#vendorProductMessage");
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
  const rawPriceStr = String(data.get("productValue") ?? "").replace(/[^\d.]/g, "");
  const priceValue = rawPriceStr ? Number(rawPriceStr) : 0;
  if (!productName) {
    if (message) message.textContent = getCopy("Product name is required.", "Ana bu\u0199atar sunan kaya.");
    form.querySelector("input[name='productName']")?.focus();
    return;
  }
  if (productName.length < 2) {
    if (message) message.textContent = getCopy("Product name must be at least 2 characters.", "Sunan kaya ya zama akalla haruffa 2.");
    form.querySelector("input[name='productName']")?.focus();
    return;
  }
  if (!category) {
    if (message) message.textContent = getCopy("Please choose a product category.", "Da fatan za a za\u0253i rukuni na kaya.");
    form.querySelector("select[name='productCategory']")?.focus();
    return;
  }
  if (!Number.isFinite(quantityAvailable) || quantityAvailable < 0) {
    if (message) message.textContent = getCopy("Enter a valid quantity.", "Shigar da adadi mai inganci.");
    form.querySelector("input[name='quantityAvailable']")?.focus();
    return;
  }
  if (!(image instanceof File) || !image.name || image.size === 0) {
    if (message) message.textContent = getCopy(
      "Please choose a product image (JPEG, PNG, or WebP).",
      "Da fatan za a za\u0253i hoton kaya (JPEG, PNG, ko WebP)."
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
      imageDataUrl
    };
    saveVendorProduct(productInput);
    let liveMessage = "";
    if (user.token) {
      try {
        const upload = await api.uploadVendorImage({
          fileName: image.name,
          mimeType: image.type,
          dataUrl: imageDataUrl
        });
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
        await Promise.all([refreshLiveCatalog(), refreshLiveVendorDashboard()]);
        liveMessage = getCopy(" Submitted for admin review \u2014 visible in catalog once approved.", " An tura wa admin \u2014 zai bayyana a kasuwa bayan amincewar admin.");
      } catch (error) {
        liveMessage = getCopy(
          " Saved locally. Live submission needs approved vendor access.",
          " An ajiye a gida. Tura live na bukatar amincewar dillali."
        );
      }
    }
    for (const fieldName of ["productName", "productNameHa", "productImage"]) {
      const field = form.querySelector(`[name='${fieldName}']`);
      if (field) field.value = "";
    }
    const preview = form.querySelector("#productImagePreview");
    if (preview) {
      preview.src = "";
      preview.style.display = "none";
    }
    form.querySelector("input[name='productName']")?.focus();
    if (message) message.textContent = getCopy("Product added. Add another or update the details below.", "An saka kaya. Ka \u0199ara wani ko canza bayanan da ke \u0199asa.") + liveMessage;
    renderVendorProducts();
    renderVendorCommerce();
    renderCatalogPreview();
    renderAdminDashboard();
  } catch (error) {
    if (message) {
      message.textContent = error instanceof Error && error.message === "Image too large" ? getCopy("Image is too large. Use an image under 1.5MB.", "Hoton ya yi girma. Yi amfani da kasa da 1.5MB.") : getCopy("Could not add product. Check the image and try again.", "Ba a iya saka kaya ba. Duba hoton ka sake gwadawa.");
    }
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
  renderAdminDashboard();
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
  renderAdminDashboard();
  renderVendorCommerce();
  showToast({
    message: getCopy("Product moderation updated.", "An sabunta duba kayan."),
    type: productAction === "approved" ? "success" : "info"
  });
  return true;
}
elements.searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch(elements.searchInput.value, 0);
});
elements.searchInput.addEventListener("input", () => {
  const val = elements.searchInput.value.trim();
  if (val.length >= 2) {
    performSearch(elements.searchInput.value, 300);
  } else if (val.length === 0) {
    performSearch("", 0);
  }
});
document.querySelector(".catalog-filter-sidebar")?.addEventListener("change", (event) => {
  const input = event.target?.closest("input[type='checkbox']");
  if (!input) return;
  const cat = input.dataset.filterCat;
  const area = input.dataset.filterArea;
  if (cat) input.checked ? activeFilterCats.add(cat) : activeFilterCats.delete(cat);
  if (area) input.checked ? activeFilterAreas.add(area) : activeFilterAreas.delete(area);
  state.visibleProductCount = PRODUCT_PAGE_SIZE;
  renderProductResults();
});
document.querySelector("#catalogSort")?.addEventListener("change", (event) => {
  activeSortOrder = event.target.value;
  state.visibleProductCount = PRODUCT_PAGE_SIZE;
  renderProductResults();
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
    recordProductView(card.dataset.productId);
    renderAdminDashboard();
    openProductModal(card.dataset.productId);
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
document.querySelector("#customerCartBtn")?.addEventListener("click", () => {
  renderCartPanel();
  openCart();
});
document.querySelector("#customerWishlistBtn")?.addEventListener("click", openWishlistPanel);
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
document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", () => setTheme(getCurrentTheme() === "dark" ? "light" : "dark"));
});
elements.vendorForm.addEventListener("submit", handleVendorRequestSubmit);
document.getElementById("productImageInput")?.addEventListener("change", (event) => {
  const input = event.target;
  const preview = document.getElementById("productImagePreview");
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
elements.exportSearches.addEventListener("click", exportSearchHistory);
elements.clearSearches.addEventListener("click", clearPrototypeData);
elements.adminContent.addEventListener("submit", (event) => {
  const form = event.target;
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
    renderAdminDashboard();
    showToast({ message: getCopy("Promotion created.", "An kirkiri talla."), type: "success" });
  }
});
elements.adminContent.addEventListener("change", (event) => {
  const select = event.target?.closest("[data-vendor-plan]");
  const vendor = select?.dataset.vendorPlan;
  const planId = select?.value;
  if (!vendor || !planId || !["free", "standard", "premium"].includes(planId)) return;
  setVendorSubscription(vendor, planId);
  renderAdminDashboard();
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
        renderAdminDashboard();
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
      renderAdminDashboard();
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
      renderAdminDashboard();
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
      renderAdminDashboard();
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
    renderAdminDashboard();
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
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderAdminDashboard();
  renderCustomerDashboard();
  renderOrdersPage4();
  void refreshLiveAdminDashboard();
  void refreshLiveVendorDashboard();
  void fetchLiveNotifications();
  if (state.currentUser?.role === "customer") {
    void hydrateCartFromServer();
    void fetchLiveOrders().then(() => {
      renderCustomerDashboard();
      renderDashboardPage(getCurrentRoute());
    }).catch(() => void 0);
  }
  const nextRoute = getDefaultRouteForRole();
  window.history.replaceState(null, "", `#${nextRoute}`);
  setRoute(nextRoute);
  renderDashboardPage(nextRoute);
});
window.addEventListener("kanoMart:signed-out", () => {
  syncRoleNavigation();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderOrdersPage4();
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
  const keysToPreserve = /* @__PURE__ */ new Set(["kanoMart.dataVersion", "kanoMart.language", SIDEBAR_COLLAPSED_KEY, THEME_STORAGE_KEY]);
  Object.keys(localStorage).filter((k) => !keysToPreserve.has(k)).forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("kanoMart.dataVersion", APP_DATA_VERSION);
}
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
renderOrdersPage4();
syncRoleNavigation();
setRoute();
setSidebarCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true");
syncSidebarLabels();
void refreshLiveCatalog();
void refreshLiveAdminDashboard();
void refreshLiveVendorDashboard();
if (state.currentUser?.token) {
  void refreshSession().then((user) => {
    if (!user && state.currentUser) {
      signOut();
      showToast({ message: getCopy("Your session expired. Please sign in again.", "Zaman ku ya \u0199are. Da fatan za a sake shiga."), type: "info" });
      return;
    }
    if (user && state.currentUser) {
      state.currentUser = {
        ...state.currentUser,
        id: user.id,
        role: user.role,
        vendorStatus: user.vendorStatus,
        name: user.name || state.currentUser.name,
        email: user.email ?? state.currentUser.email
      };
      localStorage.setItem(storageKeys.session, JSON.stringify(state.currentUser));
      state.adminAuthenticated = user.role === "admin";
      syncUserButton();
      syncRoleNavigation();
      renderAdminGate();
      setRoute();
      if (user.role === "customer") {
        void hydrateCartFromServer();
        void fetchLiveOrders().then(() => {
          renderCustomerDashboard();
          renderDashboardPage(getCurrentRoute());
        }).catch(() => void 0);
      }
      renderDashboardPage(getCurrentRoute());
    }
  }).catch(() => void 0);
}
window.addEventListener("kanoMart:sessionExpired", () => {
  if (state.currentUser) {
    signOut();
    openAuthModal();
    showToast({ message: getCopy("Your session expired. Please sign in again.", "Zaman ku ya \u0199are. Da fatan za a sake shiga."), type: "info" });
  }
});
var notifBtn = document.getElementById("sidebarNotifBtn");
var notifCountEl = document.getElementById("sidebarNotifCount");
function updateNotifBadge(count) {
  if (!notifCountEl) return;
  if (count > 0) {
    notifCountEl.textContent = count > 99 ? "99+" : String(count);
    notifCountEl.hidden = false;
  } else {
    notifCountEl.hidden = true;
  }
}
var _notifPollTimer = null;
function startNotifPolling() {
  if (_notifPollTimer !== null) return;
  const poll = () => {
    const role = state.currentUser?.role;
    if (role !== "vendor" && role !== "admin") return;
    fetchLiveNotifications().then((notifs) => {
      const unread = notifs.filter((n) => !n.readAt).length;
      updateNotifBadge(unread);
    }).catch(() => void 0);
  };
  poll();
  _notifPollTimer = setInterval(poll, 3e4);
}
function stopNotifPolling() {
  if (_notifPollTimer !== null) {
    clearInterval(_notifPollTimer);
    _notifPollTimer = null;
  }
  updateNotifBadge(0);
}
notifBtn?.addEventListener("click", () => {
  const role = state.currentUser?.role;
  if (role === "vendor") {
    window.location.hash = "vendor";
    setRoute("vendor");
  } else if (role === "admin") {
    window.location.hash = "admin";
    setRoute("admin");
  }
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
if (state.currentUser?.role === "vendor" || state.currentUser?.role === "admin") {
  startNotifPolling();
}
void fetchLiveCategories();
initLoginPage();
initSignupPage();
renderCustomerDashboard();
renderOrdersPage4();
if (state.currentUser) {
  renderDashboardPage(getCurrentRoute());
}
var scheduleEnhancements = "requestIdleCallback" in window ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 }) : (callback) => window.setTimeout(callback, 350);
scheduleEnhancements(() => {
  import("./frontend-enhancements-S6BR5UKQ.js").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});
