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
} from "./chunk-VOTUQWEH.js";

// src/backend/products.ts
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
  return getProductModerationRecords().find((record) => record.productId === productId)?.status ?? "approved";
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
    accent: "#1f7b84",
    tags: [name, input.category, input.vendor, input.area].filter(Boolean).map((item) => item.toLowerCase())
  };
  setStoredList(storageKeys.vendorProducts, [product, ...getVendorProducts()]);
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
async function apiRequest(path, options = {}) {
  const token = options.token ?? getApiToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...token ? { authorization: `Bearer ${token}` } : {}
    },
    body: options.body ? JSON.stringify(options.body) : void 0
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "API request failed");
  }
  return payload;
}
var api = {
  // Health
  health: () => apiRequest("/health"),
  // Auth
  me: () => apiRequest("/me"),
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
  const visibleProducts = [...getAllProducts()].sort((a, b) => productStatusWeight[getProductStatus(a.id)] - productStatusWeight[getProductStatus(b.id)]).slice(0, 8);
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
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const [firstName, ...rest] = String(data.get("name") || "").trim().split(/\s+/);
    const updated = updateUserProfile(state.currentUser.phone, {
      firstName: firstName || state.currentUser.firstName,
      lastName: rest.join(" ") || state.currentUser.lastName,
      email: String(data.get("email") || ""),
      deliveryAddress: String(data.get("deliveryAddress") || ""),
      preferredLanguage: data.get("preferredLanguage") === "ha" ? "ha" : "en"
    });
    if (updated) saveSession(createSessionForPhone(updated.phone));
    const message = panel.querySelector("#profileUpdateMessage");
    if (message) message.textContent = getCopy("Profile updated.", "An sabunta bayanai.");
  });
}
function closeUserPanel() {
  const panel = document.getElementById("userPanel");
  if (!panel) return;
  panel.classList.remove("modal-visible");
  panel.addEventListener("transitionend", () => panel.remove(), { once: true });
}

// src/frontend/product-modal.ts
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
    if (!name || !rating || !comment) return;
    addReview(productId, name, rating, comment);
    const msgEl = modal.querySelector("#reviewMessage");
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
function handleModalKeydown(e) {
  if (e.key === "Escape") closeProductModal();
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
  const [vendors, products2] = await Promise.all([api.adminVendorApplications(), api.adminProducts()]);
  setLiveVendorRequests(vendors.applications.map(mapApiVendorApplication));
  setLiveProducts(products2.products.map(mapApiProduct));
  for (const product of products2.products) {
    if (product.moderationStatus) {
      moderateProduct(product.id, product.moderationStatus, "Synced from live admin API");
    }
  }
}
var liveAdminData = null;
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

// src/frontend/app.ts
var routes = /* @__PURE__ */ new Set(["home", "customer", "catalog", "payments", "vendor", "orders", "admin", "login", "signup"]);
var AUTH_ROUTES = /* @__PURE__ */ new Set(["login", "signup"]);
var SIDEBAR_COLLAPSED_KEY = "kanoMart.sidebarCollapsed";
function getCurrentRoute() {
  const raw = window.location.hash.replace("#", "") || "home";
  if (raw === "results" || raw === "categories") return "catalog";
  if (raw === "my-orders") return "orders";
  return routes.has(raw) ? raw : "home";
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
  if (route === "admin") return role === "admin";
  if (route === "customer") return role === "customer";
  if (route === "orders") return role === "customer";
  if (AUTH_ROUTES.has(route)) return role === "guest";
  return true;
}
function setRoute(route = getCurrentRoute()) {
  let nextRoute = routes.has(route) ? route : "home";
  if (!canAccessRoute(nextRoute)) {
    nextRoute = getDefaultRouteForRole();
    if (window.location.hash.replace("#", "") !== nextRoute) {
      window.history.replaceState(null, "", `#${nextRoute}`);
    }
  }
  document.querySelectorAll("[data-page]").forEach((section) => {
    const isActive = section.dataset.page === nextRoute;
    section.hidden = !isActive;
    section.classList.toggle("is-active-page", isActive);
  });
  document.querySelectorAll("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === nextRoute;
    link.classList.toggle("is-active-route", isActive);
    if (link.matches(".primary-nav a")) {
      link.setAttribute("aria-current", isActive ? "page" : "false");
    }
  });
  document.body.classList.toggle("is-auth-route", AUTH_ROUTES.has(nextRoute));
  document.body.classList.toggle("on-home", nextRoute === "home");
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
    const firstName = user.firstName || user.name?.split(" ")[0] || "";
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
  renderCustomerDashboard();
  renderOrdersPage();
  renderCartPanel();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminDashboard();
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
    renderAdminDashboard();
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
function renderVendorProducts() {
  const list = document.querySelector("#vendorProductsList");
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
  const rawPriceStr = String(data.get("productValue") ?? "").replace(/[^\d.]/g, "");
  const priceValue = rawPriceStr ? Number(rawPriceStr) : 0;
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
      name: String(data.get("productName") || ""),
      nameHa: String(data.get("productNameHa") || ""),
      descriptionEn: String(data.get("descriptionEn") || ""),
      descriptionHa: String(data.get("descriptionHa") || ""),
      priceValue,
      quantityAvailable: Number(data.get("quantityAvailable") || 0),
      category: String(data.get("productCategory") || "essentials"),
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
    form.reset();
    if (message) message.textContent = getCopy("Product added to your active catalog.", "An saka kaya a kasuwarka.") + liveMessage;
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
elements.vendorForm.addEventListener("submit", handleVendorRequestSubmit);
document.querySelector("#vendorProductForm")?.addEventListener("submit", (event) => {
  void handleVendorProductSubmit(event);
});
document.querySelector("#vendorProductsList")?.addEventListener("click", (event) => {
  const button = event.target?.closest("[data-vendor-product-action]");
  const productId = button?.dataset.vendorProductId;
  const action = button?.dataset.vendorProductAction;
  if (!productId || action !== "active" && action !== "out_of_stock" && action !== "taken_down") return;
  setVendorProductListingStatus(productId, action);
  renderVendorProducts();
  renderVendorCommerce();
  renderCatalogPreview(false);
  renderAdminDashboard();
  showToast({
    message: action === "active" ? getCopy("Product restored to catalog.", "An mayar da kaya kasuwa.") : getCopy("Product removed from active catalog.", "An cire kaya daga kasuwa."),
    type: action === "active" ? "success" : "info"
  });
  if (state.currentUser?.token) {
    api.updateVendorProduct(productId, action).catch(() => void 0);
  }
});
document.querySelector("#vendorCommerceList")?.addEventListener("click", (event) => {
  const button = event.target?.closest("[data-vendor-order-ready]");
  const orderId = button?.dataset.vendorOrderReady;
  if (!orderId) return;
  const order = advanceOrderStatus(orderId);
  renderVendorCommerce();
  renderAdminDashboard();
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
  renderOrdersPage();
  void refreshLiveAdminDashboard();
  void refreshLiveVendorDashboard();
  void fetchLiveNotifications();
  const nextRoute = getDefaultRouteForRole();
  window.history.replaceState(null, "", `#${nextRoute}`);
  setRoute(nextRoute);
});
window.addEventListener("kanoMart:signed-out", () => {
  syncRoleNavigation();
  renderVendorProducts();
  renderVendorCommerce();
  renderAdminGate();
  renderOrdersPage();
  setRoute("home");
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
  if (e.key === "Escape") closeSidebar();
});
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
if (state.currentUser?.token) {
  void refreshSession().catch(() => void 0);
}
void fetchLiveCategories();
initLoginPage();
initSignupPage();
renderCustomerDashboard();
renderOrdersPage();
var scheduleEnhancements = "requestIdleCallback" in window ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 }) : (callback) => window.setTimeout(callback, 350);
scheduleEnhancements(() => {
  import("./frontend-enhancements-GHCFJLLH.js").then(({ initFrontendEnhancements }) => {
    initFrontendEnhancements();
  });
});
