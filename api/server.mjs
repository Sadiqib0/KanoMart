import { createHash, pbkdf2Sync, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";

const DEFAULT_ADMIN_PHONE = "08000000000";
const SESSION_COOKIE = "kano_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const DEFAULT_BODY_LIMIT_BYTES = 1_000_000;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

function createDefaultCategories() {
  return new Map(
    [
      { key: "food", name: { en: "Food", ha: "Abinci" }, searchTerms: ["food", "abinci", "groceries"] },
      { key: "fashion", name: { en: "Fashion", ha: "Kaya" }, searchTerms: ["fashion", "kaya", "clothes"] },
      { key: "children", name: { en: "Children", ha: "Yara" }, searchTerms: ["children", "yara", "school"] },
      { key: "essentials", name: { en: "Essentials", ha: "Kayan yau da kullum" }, searchTerms: ["essentials", "daily"] },
    ].map((category) => [category.key, { ...category, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]),
  );
}

export function createMemoryStore() {
  return {
    users: new Map(),
    sessions: new Map(),
    vendorApplications: new Map(),
    products: new Map(),
    carts: new Map(),
    orders: new Map(),
    payments: new Map(),
    walletLedger: new Map(),
    notifications: new Map(),
    wishlists: new Map(),
    reviews: new Map(),
    promotions: new Map(),
    payoutRequests: new Map(),
    categories: createDefaultCategories(),
    productViews: new Map(),
    searchEvents: [],
    uploads: new Map(),
  };
}

function mapValues(map) {
  return Array.from(map.values());
}

function mapFromValues(items = [], key = "id") {
  return new Map(items.map((item) => [item[key], item]));
}

function serializeStore(store) {
  return {
    users: mapValues(store.users),
    sessions: Array.from(store.sessions.entries()),
    vendorApplications: mapValues(store.vendorApplications),
    products: mapValues(store.products),
    carts: Array.from(store.carts.entries()).map(([userId, cart]) => [userId, mapValues(cart)]),
    orders: mapValues(store.orders),
    payments: mapValues(store.payments),
    walletLedger: mapValues(store.walletLedger),
    notifications: mapValues(store.notifications),
    wishlists: Array.from(store.wishlists.entries()).map(([userId, wishlist]) => [userId, Array.from(wishlist)]),
    reviews: mapValues(store.reviews),
    promotions: mapValues(store.promotions),
    payoutRequests: mapValues(store.payoutRequests),
    categories: mapValues(store.categories),
    productViews: mapValues(store.productViews),
    searchEvents: store.searchEvents,
    uploads: mapValues(store.uploads),
  };
}

function hydrateStore(data = {}) {
  const store = createMemoryStore();
  store.users = mapFromValues(data.users);
  store.sessions = new Map(data.sessions ?? []);
  store.vendorApplications = new Map((data.vendorApplications ?? []).map((item) => [item.userId, item]));
  store.products = mapFromValues(data.products);
  store.carts = new Map((data.carts ?? []).map(([userId, items]) => [userId, mapFromValues(items, "productId")]));
  store.orders = mapFromValues(data.orders);
  store.payments = mapFromValues(data.payments);
  store.walletLedger = mapFromValues(data.walletLedger);
  store.notifications = mapFromValues(data.notifications);
  store.wishlists = new Map((data.wishlists ?? []).map(([userId, items]) => [userId, new Set(items)]));
  store.reviews = mapFromValues(data.reviews);
  store.promotions = mapFromValues(data.promotions);
  store.payoutRequests = mapFromValues(data.payoutRequests);
  store.categories = new Map([...(store.categories.entries()), ...(data.categories ?? []).map((item) => [item.key, item])]);
  store.productViews = mapFromValues(data.productViews, "productId");
  store.searchEvents = data.searchEvents ?? [];
  store.uploads = mapFromValues(data.uploads);
  return store;
}

function createFileStore(filePath) {
  if (!filePath || !existsSync(filePath)) return createMemoryStore();
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  return hydrateStore(parsed.data ?? parsed);
}

function persistStore(filePath, store) {
  if (!filePath) return;
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(
    tmpPath,
    JSON.stringify(
      {
        version: 1,
        savedAt: new Date().toISOString(),
        data: serializeStore(store),
      },
      null,
      2,
    ),
  );
  renameSync(tmpPath, filePath);
}

function normalizePhone(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234")) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return `+${digits}`;
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomUUID().replace(/-/g, "");
  const iterations = Number(process.env.PASSWORD_HASH_ITERATIONS ?? (process.env.NODE_ENV === "test" ? 1_000 : 210_000));
  const hash = pbkdf2Sync(String(password), salt, iterations, 32, "sha256").toString("hex");
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [algorithm, iterations, salt, expected] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !expected) return false;
  const actual = pbkdf2Sync(String(password), salt, Number(iterations), 32, "sha256");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (actual.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actual, expectedBuffer);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    role: user.role,
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage,
    vendorStatus: user.vendorStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function publicVendorApplication(store, application) {
  if (!application) return null;
  return {
    id: application.id,
    userId: application.userId,
    user: publicUser(store.users.get(application.userId)),
    businessName: application.businessName,
    phone: application.phone,
    area: application.area,
    category: application.category,
    status: application.status,
    adminNote: application.adminNote,
    reviewedAt: application.reviewedAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

function publicProduct(store, product, options = {}) {
  if (!product) return null;
  const vendor = store.users.get(product.vendorUserId);
  return {
    id: product.id,
    vendorUserId: product.vendorUserId,
    vendorName: product.vendorName,
    vendorPhone: vendor?.phone,
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    currency: product.currency,
    quantityAvailable: product.quantityAvailable,
    area: product.area,
    imageUrl: product.imageUrl,
    tags: product.tags,
    listingStatus: product.listingStatus,
    moderationStatus: product.moderationStatus,
    reviewNote: options.includeAdminFields ? product.reviewNote : undefined,
    reviewedAt: options.includeAdminFields ? product.reviewedAt : undefined,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function publicCart(store, userId) {
  const cart = store.carts.get(userId) ?? new Map();
  const items = Array.from(cart.values())
    .map((item) => {
      const product = store.products.get(item.productId);
      if (!product) return null;
      return {
        productId: item.productId,
        quantity: item.quantity,
        product: publicProduct(store, product),
        lineTotal: product.price * item.quantity,
        addedAt: item.addedAt,
        updatedAt: item.updatedAt,
      };
    })
    .filter(Boolean);

  return {
    items,
    subtotal: items.reduce((total, item) => total + item.lineTotal, 0),
  };
}

function publicPayment(payment) {
  if (!payment) return null;
  return {
    id: payment.id,
    orderId: payment.orderId,
    reference: payment.reference,
    method: payment.method,
    gateway: payment.gateway,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    adminNote: payment.adminNote,
    createdAt: payment.createdAt,
    verifiedAt: payment.verifiedAt,
    failedAt: payment.failedAt,
    refundedAt: payment.refundedAt,
  };
}

function publicOrder(store, order) {
  if (!order) return null;
  return {
    id: order.id,
    customerUserId: order.customerUserId,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    items: order.items,
    deliveryOption: order.deliveryOption,
    deliveryAddress: order.deliveryAddress,
    deliveryArea: order.deliveryArea,
    deliveryFee: order.deliveryFee,
    deliveryPerson: order.deliveryPerson,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    itemsSubtotal: order.itemsSubtotal,
    commissionTotal: order.commissionTotal,
    vendorPayoutTotal: order.vendorPayoutTotal,
    status: order.status,
    payment: publicPayment(store.payments.get(order.paymentId)),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

function publicNotification(notification) {
  if (!notification) return null;
  return {
    id: notification.id,
    audience: notification.audience,
    recipientUserId: notification.recipientUserId,
    title: notification.title,
    message: notification.message,
    type: notification.type,
    orderId: notification.orderId,
    productId: notification.productId,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}

function publicReview(store, review, options = {}) {
  if (!review) return null;
  const product = store.products.get(review.productId);
  const reviewer = store.users.get(review.customerUserId);
  return {
    id: review.id,
    productId: review.productId,
    productName: product?.name,
    vendorUserId: review.vendorUserId,
    customerUserId: review.customerUserId,
    reviewerName: reviewer?.name ?? review.reviewerName,
    rating: review.rating,
    comment: review.comment,
    hidden: options.includeAdminFields ? review.hidden : undefined,
    adminNote: options.includeAdminFields ? review.adminNote : undefined,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

function publicPromotion(promotion) {
  if (!promotion) return null;
  return {
    id: promotion.id,
    title: promotion.title,
    type: promotion.type,
    discountPercent: promotion.discountPercent,
    code: promotion.code,
    productId: promotion.productId,
    vendorUserId: promotion.vendorUserId,
    category: promotion.category,
    active: promotion.active,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    createdAt: promotion.createdAt,
    updatedAt: promotion.updatedAt,
  };
}

function publicPayoutRequest(payout) {
  if (!payout) return null;
  return {
    id: payout.id,
    vendorUserId: payout.vendorUserId,
    amount: payout.amount,
    status: payout.status,
    bankName: payout.bankName,
    accountNumber: payout.accountNumber,
    accountName: payout.accountName,
    adminNote: payout.adminNote,
    requestedAt: payout.requestedAt,
    reviewedAt: payout.reviewedAt,
  };
}

function publicCategory(category) {
  if (!category) return null;
  return {
    key: category.key,
    name: category.name,
    searchTerms: category.searchTerms,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function createNotification(store, input) {
  const now = new Date().toISOString();
  const notification = {
    id: randomUUID(),
    audience: input.audience,
    recipientUserId: input.recipientUserId,
    title: sanitizeText(input.title, 120),
    message: sanitizeText(input.message, 240),
    type: input.type,
    orderId: input.orderId,
    productId: input.productId,
    createdAt: now,
  };
  store.notifications.set(notification.id, notification);
  return notification;
}

function notifyAdmins(store, input) {
  for (const user of store.users.values()) {
    if (user.role === "admin") createNotification(store, { ...input, audience: "admin", recipientUserId: user.id });
  }
}

function findUserByIdentifier(store, identifier) {
  const normalizedPhone = normalizePhone(identifier);
  const normalizedEmail = normalizeEmail(identifier);

  for (const user of store.users.values()) {
    if (user.phone === normalizedPhone || (normalizedEmail && user.email === normalizedEmail)) {
      return user;
    }
  }

  return null;
}

function findVendorApplicationById(store, applicationId) {
  for (const application of store.vendorApplications.values()) {
    if (application.id === applicationId) return application;
  }
  return null;
}

function findVendorApplicationByUserId(store, userId) {
  return store.vendorApplications.get(userId) ?? null;
}

function getSessionToken(request) {
  const auth = request.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

  const cookieHeader = request.headers.cookie ?? "";
  const cookies = new Map(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      }),
  );
  return cookies.get(SESSION_COOKIE) ?? "";
}

function getCurrentUser(request, store) {
  const token = getSessionToken(request);
  if (!token) return null;
  const session = store.sessions.get(token);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    if (session) store.sessions.delete(token);
    return null;
  }
  return store.users.get(session.userId) ?? null;
}

function send(response, status, body, extraHeaders = {}) {
  response.writeHead(status, { ...jsonHeaders, ...extraHeaders });
  response.end(JSON.stringify(body));
}

function sendError(response, status, code, message, details) {
  send(response, status, {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}

async function readJson(request) {
  const chunks = [];
  const limit = Number(process.env.API_BODY_LIMIT_BYTES ?? DEFAULT_BODY_LIMIT_BYTES);
  let total = 0;
  for await (const chunk of request) chunks.push(chunk);
  for (const chunk of chunks) {
    total += chunk.length;
    if (total > limit) {
      const error = new Error("Request body is too large");
      error.status = 413;
      error.code = "body_too_large";
      throw error;
    }
  }
  if (!chunks.length) return {};

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON request body");
    error.status = 400;
    error.code = "invalid_json";
    throw error;
  }
}

function validateSignup(input) {
  const errors = {};
  const phone = normalizePhone(input.phone);
  const password = String(input.password ?? "");
  const firstName = String(input.firstName ?? "").trim();
  const lastName = String(input.lastName ?? "").trim();
  const role = input.role === "vendor" ? "vendor" : input.role === "customer" ? "customer" : "";

  if (!phone || phone.length < 8) errors.phone = "A valid phone number is required.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!firstName) errors.firstName = "First name is required.";
  if (!lastName) errors.lastName = "Last name is required.";
  if (!role) errors.role = "Role must be customer or vendor.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      phone,
      password,
      firstName,
      lastName,
      role,
      email: normalizeEmail(input.email),
      deliveryAddress: String(input.deliveryAddress ?? "").trim(),
      preferredLanguage: input.preferredLanguage === "ha" ? "ha" : "en",
      businessName: String(input.businessName ?? "").trim(),
      area: String(input.area ?? "").trim(),
      category: String(input.category ?? "").trim(),
    },
  };
}

function createSession(store, userId) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  store.sessions.set(token, {
    tokenHash: createHash("sha256").update(token).digest("hex"),
    userId,
    createdAt: new Date().toISOString(),
    expiresAt,
  });
  return { token, expiresAt };
}

function createCookie(token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

function clearCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function createUser(store, input, adminPhone) {
  const now = new Date().toISOString();
  const isAdmin = input.phone === normalizePhone(adminPhone);
  const role = isAdmin ? "admin" : input.role;

  const user = {
    id: randomUUID(),
    phone: input.phone,
    email: input.email || undefined,
    passwordHash: hashPassword(input.password),
    firstName: isAdmin ? "Admin" : input.firstName,
    lastName: isAdmin ? "" : input.lastName,
    name: isAdmin ? "Kano Mart Admin" : `${input.firstName} ${input.lastName}`.trim(),
    role,
    deliveryAddress: input.deliveryAddress || undefined,
    preferredLanguage: input.preferredLanguage,
    vendorStatus: role === "vendor" ? "pending" : undefined,
    createdAt: now,
    updatedAt: now,
  };

  store.users.set(user.id, user);

  if (role === "vendor") {
    store.vendorApplications.set(user.id, {
      id: randomUUID(),
      userId: user.id,
      businessName: input.businessName || user.name,
      phone: user.phone,
      area: input.area || "Kano",
      category: input.category || "essentials",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  }

  return user;
}

function assertAdmin(response, user) {
  if (!user) {
    sendError(response, 401, "unauthenticated", "Sign in is required.");
    return false;
  }
  if (user.role !== "admin") {
    sendError(response, 403, "forbidden", "Admin access is required.");
    return false;
  }
  return true;
}

function assertAuthenticated(response, user) {
  if (!user) {
    sendError(response, 401, "unauthenticated", "Sign in is required.");
    return false;
  }
  return true;
}

function validateVendorDecision(input) {
  const status = input.status === "approved" || input.status === "rejected" ? input.status : "";
  const adminNote = String(input.adminNote ?? "").trim();
  const errors = {};

  if (!status) errors.status = "Status must be approved or rejected.";
  if (adminNote.length > 500) errors.adminNote = "Admin note must be 500 characters or fewer.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { status, adminNote },
  };
}

function updateVendorApplicationStatus(store, application, decision) {
  const now = new Date().toISOString();
  const nextApplication = {
    ...application,
    status: decision.status,
    adminNote: decision.adminNote || undefined,
    reviewedAt: now,
    updatedAt: now,
  };

  store.vendorApplications.set(application.userId, nextApplication);

  const user = store.users.get(application.userId);
  if (user) {
    store.users.set(user.id, {
      ...user,
      vendorStatus: decision.status,
      updatedAt: now,
    });
    createNotification(store, {
      audience: "vendor",
      recipientUserId: user.id,
      title: decision.status === "approved" ? "Vendor approved" : "Vendor rejected",
      message: `Your vendor application was ${decision.status}.`,
      type: "vendor",
    });
  }

  return nextApplication;
}

function sanitizeText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function validateProductInput(input) {
  const errors = {};
  const nameEn = sanitizeText(input.name?.en ?? input.nameEn ?? input.name, 90);
  const nameHa = sanitizeText(input.name?.ha ?? input.nameHa ?? nameEn, 90);
  const descriptionEn = sanitizeText(input.description?.en ?? input.descriptionEn ?? "", 240);
  const descriptionHa = sanitizeText(input.description?.ha ?? input.descriptionHa ?? descriptionEn, 240);
  const category = sanitizeText(input.category, 40).toLowerCase();
  const price = Number(input.price ?? input.priceValue);
  const quantityAvailable = Number(input.quantityAvailable ?? 1);
  const area = sanitizeText(input.area ?? "Kano", 80);
  const imageUrl = sanitizeText(input.imageUrl ?? "", 500);
  const tags = Array.isArray(input.tags) ? input.tags.map((tag) => sanitizeText(tag, 40)).filter(Boolean) : [];

  if (!nameEn) errors.name = "Product name is required.";
  if (!category) errors.category = "Category is required.";
  if (!Number.isFinite(price) || price <= 0) errors.price = "Price must be greater than zero.";
  if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
    errors.quantityAvailable = "Quantity must be a whole number greater than or equal to zero.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      name: { en: nameEn, ha: nameHa },
      description: { en: descriptionEn, ha: descriptionHa },
      category,
      price,
      currency: "NGN",
      quantityAvailable,
      area,
      imageUrl: imageUrl || undefined,
      tags: [...new Set([nameEn, nameHa, category, area, ...tags].map((tag) => tag.toLowerCase()).filter(Boolean))],
    },
  };
}

function createProduct(store, vendor, input) {
  const now = new Date().toISOString();
  const product = {
    id: randomUUID(),
    vendorUserId: vendor.id,
    vendorName: vendor.name,
    name: input.name,
    description: input.description,
    category: input.category,
    price: input.price,
    currency: input.currency,
    quantityAvailable: input.quantityAvailable,
    area: input.area,
    imageUrl: input.imageUrl,
    tags: input.tags,
    listingStatus: input.quantityAvailable > 0 ? "active" : "out_of_stock",
    moderationStatus: "pending",
    createdAt: now,
    updatedAt: now,
  };

  store.products.set(product.id, product);
  return product;
}

function validateProductModeration(input) {
  const status =
    input.status === "approved" || input.status === "rejected" || input.status === "hidden" ? input.status : "";
  const reviewNote = sanitizeText(input.reviewNote ?? "", 500);
  const errors = {};

  if (!status) errors.status = "Status must be approved, hidden, or rejected.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { status, reviewNote },
  };
}

function updateProductModeration(product, decision) {
  const now = new Date().toISOString();
  const nextProduct = {
    ...product,
    moderationStatus: decision.status,
    reviewNote: decision.reviewNote || undefined,
    reviewedAt: now,
    updatedAt: now,
  };
  return nextProduct;
}

function validateListingStatus(input) {
  const listingStatus =
    input.listingStatus === "active" || input.listingStatus === "out_of_stock" || input.listingStatus === "taken_down"
      ? input.listingStatus
      : "";
  const errors = {};

  if (!listingStatus) errors.listingStatus = "Listing status must be active, out_of_stock, or taken_down.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { listingStatus },
  };
}

function getPublicCatalogProduct(store, productId) {
  const product = store.products.get(productId);
  if (!product || product.moderationStatus !== "approved" || product.listingStatus !== "active") return null;
  return product;
}

function validateCartItem(input) {
  const productId = String(input.productId ?? "").trim();
  const quantity = Number(input.quantity ?? 1);
  const errors = {};

  if (!productId) errors.productId = "Product is required.";
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    errors.quantity = "Quantity must be a whole number between 1 and 99.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { productId, quantity },
  };
}

function upsertCartItem(store, userId, input) {
  const now = new Date().toISOString();
  const cart = store.carts.get(userId) ?? new Map();
  const existing = cart.get(input.productId);
  const item = {
    productId: input.productId,
    quantity: input.quantity,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
  };
  cart.set(input.productId, item);
  store.carts.set(userId, cart);
  return item;
}

function validateCheckout(input) {
  const deliveryOption = input.deliveryOption === "pickup" ? "pickup" : "delivery";
  const deliveryAddress = sanitizeText(input.deliveryAddress ?? "", 180);
  const deliveryArea = sanitizeText(input.deliveryArea ?? "Kano", 80);
  const paymentMethod = sanitizeText(input.paymentMethod ?? "", 40);
  const promotionCode = sanitizeText(input.promotionCode ?? "", 40).toUpperCase();
  const errors = {};
  const allowedPaymentMethods = new Set(["manual_transfer", "pay_on_delivery", "card", "bank_transfer", "ussd", "wallet"]);

  if (deliveryOption === "delivery" && !deliveryAddress) {
    errors.deliveryAddress = "Delivery address is required.";
  }
  if (!deliveryArea) errors.deliveryArea = "Delivery area is required.";
  if (!allowedPaymentMethods.has(paymentMethod)) {
    errors.paymentMethod = "Payment method is not supported.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { deliveryOption, deliveryAddress, deliveryArea, paymentMethod, promotionCode },
  };
}

function getPaymentStatusForMethod(method) {
  return method === "card" || method === "ussd" || method === "wallet" ? "paid" : "pending";
}

function getPaymentGatewayForMethod(method) {
  return method === "card" || method === "ussd" || method === "wallet" ? "prototype" : "manual";
}

function calculateDeliveryFee(deliveryOption) {
  return deliveryOption === "pickup" ? 0 : 1200;
}

function createPayment(store, order) {
  const now = new Date().toISOString();
  const status = getPaymentStatusForMethod(order.paymentMethod);
  const payment = {
    id: randomUUID(),
    orderId: order.id,
    reference: order.paymentReference,
    method: order.paymentMethod,
    gateway: getPaymentGatewayForMethod(order.paymentMethod),
    amount: order.subtotal,
    currency: "NGN",
    status,
    createdAt: now,
    verifiedAt: status === "paid" ? now : undefined,
  };
  store.payments.set(payment.id, payment);
  return payment;
}

function createLedgerEntriesForPaidOrder(store, order) {
  if (order.paymentStatus !== "paid") return [];
  if (Array.from(store.walletLedger.values()).some((entry) => entry.orderId === order.id)) return [];
  const now = new Date().toISOString();
  const entries = order.items.flatMap((item) => [
    {
      id: randomUUID(),
      orderId: order.id,
      productId: item.productId,
      vendorUserId: item.vendorUserId,
      type: "vendor_pending_credit",
      status: "pending",
      amount: item.vendorPayout,
      createdAt: now,
    },
    {
      id: randomUUID(),
      orderId: order.id,
      productId: item.productId,
      vendorUserId: item.vendorUserId,
      type: "platform_commission",
      status: "available",
      amount: item.commissionAmount,
      createdAt: now,
    },
  ]);

  for (const entry of entries) store.walletLedger.set(entry.id, entry);
  return entries;
}

function releaseVendorPayoutForDeliveredOrder(store, order) {
  if (order.paymentStatus !== "paid" || order.status !== "delivered") return [];
  const now = new Date().toISOString();
  const released = [];

  for (const [id, entry] of store.walletLedger.entries()) {
    if (entry.orderId !== order.id || entry.type !== "vendor_pending_credit" || entry.status === "available") {
      continue;
    }

    const nextEntry = {
      ...entry,
      status: "available",
      availableAt: now,
    };
    store.walletLedger.set(id, nextEntry);
    released.push(nextEntry);
  }

  return released;
}

function validatePaymentDecision(input) {
  const status =
    input.status === "paid" || input.status === "failed" || input.status === "refunded" ? input.status : "";
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  const errors = {};

  if (!status) errors.status = "Status must be paid, failed, or refunded.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { status, adminNote },
  };
}

function updatePaymentStatus(store, payment, decision) {
  const now = new Date().toISOString();
  const nextPayment = {
    ...payment,
    status: decision.status,
    adminNote: decision.adminNote || undefined,
    verifiedAt: decision.status === "paid" ? now : payment.verifiedAt,
    failedAt: decision.status === "failed" ? now : payment.failedAt,
    refundedAt: decision.status === "refunded" ? now : payment.refundedAt,
  };
  store.payments.set(nextPayment.id, nextPayment);

  const order = store.orders.get(payment.orderId);
  if (order) {
    const nextOrder = {
      ...order,
      paymentStatus: decision.status,
      updatedAt: now,
    };
    store.orders.set(nextOrder.id, nextOrder);
    if (decision.status === "paid") createLedgerEntriesForPaidOrder(store, nextOrder);
    if (decision.status === "paid" && nextOrder.status === "delivered") releaseVendorPayoutForDeliveredOrder(store, nextOrder);
    createNotification(store, {
      audience: "customer",
      recipientUserId: nextOrder.customerUserId,
      title: decision.status === "paid" ? "Payment successful" : decision.status === "failed" ? "Payment failed" : "Payment refunded",
      message: `Payment for order ${nextOrder.id} is ${decision.status}.`,
      type: "payment",
      orderId: nextOrder.id,
    });
    if (decision.status === "paid") {
      for (const vendorUserId of new Set(nextOrder.items.map((item) => item.vendorUserId))) {
        createNotification(store, {
          audience: "vendor",
          recipientUserId: vendorUserId,
          title: "Payment confirmed",
          message: `Payment confirmed for order ${nextOrder.id}.`,
          type: "payment",
          orderId: nextOrder.id,
        });
      }
    }
  }

  return nextPayment;
}

function validateOrderStatusInput(input) {
  const status = sanitizeText(input.status ?? "", 40);
  const deliveryPerson = sanitizeText(input.deliveryPerson ?? "", 100);
  const errors = {};
  const allowed = new Set([
    "awaiting_confirmation",
    "preparing_order",
    "ready_for_pickup",
    "assigned_to_rider",
    "out_for_delivery",
    "delivered",
    "cancelled",
  ]);

  if (!allowed.has(status)) errors.status = "Order status is not supported.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { status, deliveryPerson },
  };
}

function getAllowedNextStatuses(order) {
  if (order.status === "cancelled" || order.status === "delivered") return [];
  const deliveryFlow =
    order.deliveryOption === "pickup"
      ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"]
      : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
  const currentIndex = deliveryFlow.indexOf(order.status);
  const next = currentIndex >= 0 ? deliveryFlow[currentIndex + 1] : undefined;
  return ["cancelled", next].filter(Boolean);
}

function updateOrderStatus(store, order, input) {
  const allowed = getAllowedNextStatuses(order);
  if (!allowed.includes(input.status)) {
    return {
      error: {
        status: 409,
        code: "invalid_order_transition",
        message: `Cannot move order from ${order.status} to ${input.status}.`,
      },
    };
  }

  const now = new Date().toISOString();
  const nextOrder = {
    ...order,
    status: input.status,
    deliveryPerson: input.deliveryPerson || order.deliveryPerson,
    updatedAt: now,
  };
  store.orders.set(nextOrder.id, nextOrder);
  releaseVendorPayoutForDeliveredOrder(store, nextOrder);
  createNotification(store, {
    audience: "customer",
    recipientUserId: nextOrder.customerUserId,
    title: nextOrder.status === "delivered" ? "Order delivered" : "Order updated",
    message: `Order ${nextOrder.id} is now ${nextOrder.status}.`,
    type: nextOrder.status === "delivered" ? "delivery" : "order",
    orderId: nextOrder.id,
  });
  return { order: nextOrder };
}

function getWishlistProducts(store, userId) {
  const wishlist = store.wishlists.get(userId) ?? new Set();
  return Array.from(wishlist)
    .map((productId) => store.products.get(productId))
    .filter(Boolean)
    .map((product) => publicProduct(store, product));
}

function validateReviewInput(input) {
  const productId = String(input.productId ?? "").trim();
  const rating = Number(input.rating);
  const comment = sanitizeText(input.comment ?? "", 500);
  const errors = {};

  if (!productId) errors.productId = "Product is required.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = "Rating must be between 1 and 5.";
  if (!comment) errors.comment = "Review comment is required.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { productId, rating, comment },
  };
}

function customerCanReviewProduct(store, customerUserId, productId) {
  return Array.from(store.orders.values()).some(
    (order) =>
      order.customerUserId === customerUserId &&
      order.status === "delivered" &&
      order.items.some((item) => item.productId === productId),
  );
}

function createReview(store, customer, input) {
  const product = store.products.get(input.productId);
  if (!product) return { error: { status: 404, code: "product_not_found", message: "Product was not found." } };
  if (!customerCanReviewProduct(store, customer.id, input.productId)) {
    return {
      error: {
        status: 403,
        code: "review_not_allowed",
        message: "Only customers with delivered orders can review this product.",
      },
    };
  }

  const now = new Date().toISOString();
  const review = {
    id: randomUUID(),
    productId: input.productId,
    vendorUserId: product.vendorUserId,
    customerUserId: customer.id,
    reviewerName: customer.name,
    rating: input.rating,
    comment: input.comment,
    hidden: false,
    createdAt: now,
    updatedAt: now,
  };
  store.reviews.set(review.id, review);
  createNotification(store, {
    audience: "vendor",
    recipientUserId: product.vendorUserId,
    title: "New product review",
    message: `${customer.name} reviewed ${product.name.en}.`,
    type: "review",
    productId: product.id,
  });
  return { review };
}

function validateReviewModeration(input) {
  const hidden = Boolean(input.hidden);
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  return { valid: true, errors: {}, value: { hidden, adminNote } };
}

function validatePromotionInput(input) {
  const titleEn = sanitizeText(input.title?.en ?? input.titleEn ?? input.title, 120);
  const titleHa = sanitizeText(input.title?.ha ?? input.titleHa ?? titleEn, 120);
  const type = sanitizeText(input.type ?? "discount_code", 40);
  const discountPercent = Number(input.discountPercent);
  const code = sanitizeText(input.code ?? "", 40).toUpperCase();
  const productId = sanitizeText(input.productId ?? "", 80);
  const vendorUserId = sanitizeText(input.vendorUserId ?? "", 80);
  const category = sanitizeText(input.category ?? "", 40).toLowerCase();
  const startsAt = input.startsAt ? new Date(input.startsAt).toISOString() : new Date().toISOString();
  const endsAt = input.endsAt ? new Date(input.endsAt).toISOString() : undefined;
  const errors = {};
  const allowedTypes = new Set(["discount_code", "flash_sale", "featured_product", "featured_vendor", "seasonal_campaign"]);

  if (!titleEn) errors.title = "Promotion title is required.";
  if (!allowedTypes.has(type)) errors.type = "Promotion type is not supported.";
  if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 90) {
    errors.discountPercent = "Discount percent must be between 1 and 90.";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      title: { en: titleEn, ha: titleHa },
      type,
      discountPercent,
      code: code || undefined,
      productId: productId || undefined,
      vendorUserId: vendorUserId || undefined,
      category: category || undefined,
      active: input.active !== false,
      startsAt,
      endsAt,
    },
  };
}

function getActivePromotionForProduct(store, product, code) {
  const now = Date.now();
  const normalizedCode = sanitizeText(code ?? "", 40).toUpperCase();
  return Array.from(store.promotions.values()).find((promotion) => {
    if (!promotion.active) return false;
    if (Date.parse(promotion.startsAt) > now) return false;
    if (promotion.endsAt && Date.parse(promotion.endsAt) < now) return false;
    if (promotion.code && promotion.code !== normalizedCode) return false;
    return (
      promotion.productId === product.id ||
      promotion.vendorUserId === product.vendorUserId ||
      promotion.category === product.category ||
      (!promotion.productId && !promotion.vendorUserId && !promotion.category)
    );
  });
}

function validatePayoutInput(input) {
  const amount = Number(input.amount);
  const bankName = sanitizeText(input.bankName ?? "", 80);
  const accountNumber = sanitizeText(input.accountNumber ?? "", 30);
  const accountName = sanitizeText(input.accountName ?? "", 120);
  const errors = {};

  if (!Number.isInteger(amount) || amount < 1000) errors.amount = "Amount must be at least 1000.";
  if (!bankName) errors.bankName = "Bank name is required.";
  if (!accountNumber) errors.accountNumber = "Account number is required.";
  if (!accountName) errors.accountName = "Account name is required.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { amount, bankName, accountNumber, accountName },
  };
}

function getVendorWalletSummary(store, vendorUserId) {
  return Array.from(store.walletLedger.values()).reduce(
    (summary, entry) => {
      if (entry.vendorUserId !== vendorUserId) return summary;
      if (entry.type === "vendor_pending_credit") {
        if (entry.status === "available") summary.availableBalance += entry.amount;
        else summary.pendingBalance += entry.amount;
      }
      if (entry.type === "platform_commission") summary.totalCommission += entry.amount;
      if (entry.type === "vendor_withdrawal_debit") summary.availableBalance -= entry.amount;
      return summary;
    },
    { vendorUserId, pendingBalance: 0, availableBalance: 0, totalCommission: 0 },
  );
}

function validatePayoutDecision(input) {
  const status = input.status === "approved" || input.status === "rejected" ? input.status : "";
  const adminNote = sanitizeText(input.adminNote ?? "", 500);
  const errors = {};
  if (!status) errors.status = "Status must be approved or rejected.";
  return { valid: Object.keys(errors).length === 0, errors, value: { status, adminNote } };
}

function updatePayoutStatus(store, payout, decision) {
  const now = new Date().toISOString();
  const nextPayout = {
    ...payout,
    status: decision.status,
    adminNote: decision.adminNote || undefined,
    reviewedAt: now,
  };
  store.payoutRequests.set(nextPayout.id, nextPayout);

  if (decision.status === "approved") {
    const entry = {
      id: randomUUID(),
      orderId: nextPayout.id,
      productId: "payout",
      vendorUserId: nextPayout.vendorUserId,
      type: "vendor_withdrawal_debit",
      status: "available",
      amount: nextPayout.amount,
      createdAt: now,
      availableAt: now,
    };
    store.walletLedger.set(entry.id, entry);
  }

  return nextPayout;
}

function validateCategoryInput(input) {
  const key = sanitizeText(input.key ?? "", 40).toLowerCase();
  const nameEn = sanitizeText(input.name?.en ?? input.nameEn ?? "", 80);
  const nameHa = sanitizeText(input.name?.ha ?? input.nameHa ?? nameEn, 80);
  const searchTerms = Array.isArray(input.searchTerms)
    ? input.searchTerms.map((term) => sanitizeText(term, 40).toLowerCase()).filter(Boolean)
    : [];
  const errors = {};
  if (!key) errors.key = "Category key is required.";
  if (!nameEn) errors.name = "Category English name is required.";
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { key, name: { en: nameEn, ha: nameHa }, searchTerms },
  };
}

function validateUploadInput(input) {
  const fileName = sanitizeText(input.fileName ?? "product-image", 120);
  const mimeType = sanitizeText(input.mimeType ?? "", 80);
  const dataUrl = String(input.dataUrl ?? "");
  const errors = {};
  const allowedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const maxLength = Number(process.env.API_UPLOAD_MAX_DATA_URL_LENGTH ?? 750_000);

  if (!allowedMimeTypes.has(mimeType)) errors.mimeType = "Only PNG, JPEG, and WebP images are supported.";
  if (!dataUrl.startsWith(`data:${mimeType};base64,`)) errors.dataUrl = "A matching base64 data URL is required.";
  if (dataUrl.length > maxLength) errors.dataUrl = "Image upload is too large.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: { fileName, mimeType, dataUrl },
  };
}

function createOrderFromCart(store, customer, checkout) {
  const cart = store.carts.get(customer.id);
  if (!cart || cart.size === 0) {
    return { error: { status: 409, code: "cart_empty", message: "Cart is empty." } };
  }

  const orderItems = [];
  for (const cartItem of cart.values()) {
    const product = getPublicCatalogProduct(store, cartItem.productId);
    if (!product) {
      return {
        error: {
          status: 409,
          code: "product_unavailable",
          message: "One or more products in your cart are no longer available.",
        },
      };
    }
    if (product.quantityAvailable < cartItem.quantity) {
      return {
        error: {
          status: 409,
          code: "insufficient_stock",
          message: `${product.name.en} has only ${product.quantityAvailable} item(s) available.`,
        },
      };
    }

    const promotion = getActivePromotionForProduct(store, product, checkout.promotionCode);
    const unitPrice = promotion ? Math.max(0, Math.round(product.price * (1 - promotion.discountPercent / 100))) : product.price;
    const discountAmount = (product.price - unitPrice) * cartItem.quantity;
    const lineTotal = unitPrice * cartItem.quantity;
    const commissionRate = 0.1;
    const commissionAmount = Math.round(lineTotal * commissionRate);
    orderItems.push({
      productId: product.id,
      vendorUserId: product.vendorUserId,
      vendorName: product.vendorName,
      name: product.name,
      unitPrice,
      originalUnitPrice: product.price,
      quantity: cartItem.quantity,
      lineTotal,
      discountAmount,
      promotionId: promotion?.id,
      commissionRate,
      commissionAmount,
      vendorPayout: lineTotal - commissionAmount,
    });
  }

  const now = new Date().toISOString();
  const itemsSubtotal = orderItems.reduce((total, item) => total + item.lineTotal, 0);
  const deliveryFee = calculateDeliveryFee(checkout.deliveryOption);
  const order = {
    id: `KM-${randomUUID().slice(0, 8).toUpperCase()}`,
    customerUserId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    items: orderItems,
    deliveryOption: checkout.deliveryOption,
    deliveryAddress: checkout.deliveryOption === "delivery" ? checkout.deliveryAddress : undefined,
    deliveryArea: checkout.deliveryArea,
    deliveryFee,
    paymentMethod: checkout.paymentMethod,
    paymentReference: `KM-PAY-${randomUUID().slice(0, 10).toUpperCase()}`,
    paymentStatus: "pending",
    itemsSubtotal,
    subtotal: itemsSubtotal + deliveryFee,
    commissionTotal: orderItems.reduce((total, item) => total + item.commissionAmount, 0),
    vendorPayoutTotal: orderItems.reduce((total, item) => total + item.vendorPayout, 0),
    status: "awaiting_confirmation",
    createdAt: now,
    updatedAt: now,
  };

  const payment = createPayment(store, order);
  order.paymentId = payment.id;
  order.paymentStatus = payment.status;
  store.orders.set(order.id, order);
  createLedgerEntriesForPaidOrder(store, order);
  createNotification(store, {
    audience: "customer",
    recipientUserId: customer.id,
    title: "Order placed",
    message: `Order ${order.id} has been placed.`,
    type: "order",
    orderId: order.id,
  });
  notifyAdmins(store, {
    title: "New order",
    message: `Order ${order.id} is awaiting confirmation.`,
    type: "order",
    orderId: order.id,
  });
  for (const vendorUserId of new Set(orderItems.map((item) => item.vendorUserId))) {
    createNotification(store, {
      audience: "vendor",
      recipientUserId: vendorUserId,
      title: "New order",
      message: `Order ${order.id} includes your product.`,
      type: "order",
      orderId: order.id,
    });
  }

  for (const item of orderItems) {
    const product = store.products.get(item.productId);
    const quantityAvailable = product.quantityAvailable - item.quantity;
    store.products.set(product.id, {
      ...product,
      quantityAvailable,
      listingStatus: quantityAvailable > 0 ? product.listingStatus : "out_of_stock",
      updatedAt: now,
    });
  }

  store.carts.set(customer.id, new Map());
  return { order };
}

function corsHeaders(request, allowedOrigin) {
  const origin = request.headers.origin;
  const allowOrigin = allowedOrigin === "*" ? "*" : origin && allowedOrigin.split(",").includes(origin) ? origin : "";
  if (!allowOrigin) return {};

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    vary: "Origin",
  };
}

function createRateLimiter(options = {}) {
  const windowMs = Number(options.windowMs ?? process.env.API_RATE_LIMIT_WINDOW_MS ?? 60_000);
  const maxRequests = Number(options.maxRequests ?? process.env.API_RATE_LIMIT_MAX ?? 600);
  const buckets = new Map();

  return {
    check(request) {
      if (maxRequests <= 0) return true;
      const forwarded = request.headers["x-forwarded-for"]?.split(",")[0]?.trim();
      const key = forwarded || request.socket?.remoteAddress || "local";
      const now = Date.now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      bucket.count += 1;
      return bucket.count <= maxRequests;
    },
  };
}

export function createApp(options = {}) {
  const dataFile = options.dataFile ?? process.env.API_DATA_FILE;
  const store = options.store ?? (dataFile ? createFileStore(dataFile) : createMemoryStore());
  const adminPhone = options.adminPhone ?? process.env.KANO_ADMIN_PHONE ?? DEFAULT_ADMIN_PHONE;
  const allowedOrigin = options.allowedOrigin ?? process.env.CORS_ORIGIN ?? "http://localhost:4173,http://localhost:63342";
  const rateLimiter = options.rateLimiter ?? createRateLimiter(options.rateLimit);

  async function handle(request, response) {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const method = request.method ?? "GET";
    const headers = corsHeaders(request, allowedOrigin);
    const originalEnd = response.end.bind(response);
    response.end = (payload = "") => {
      if (dataFile && method !== "OPTIONS") {
        try {
          persistStore(dataFile, store);
        } catch (error) {
          console.error("Failed to persist API data", error);
        }
      }
      originalEnd(payload);
    };

    if (method === "OPTIONS") {
      response.writeHead(204, headers);
      response.end();
      return;
    }

    if (!rateLimiter.check(request)) {
      sendError(response, 429, "rate_limited", "Too many requests. Try again shortly.");
      return;
    }

    try {
      if (method === "GET" && requestUrl.pathname === "/health") {
        send(response, 200, { status: "ok", service: "kano-mart-api" }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/auth/register") {
        const body = await readJson(request);
        const parsed = validateSignup(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        if (findUserByIdentifier(store, parsed.value.phone)) {
          sendError(response, 409, "user_exists", "A user with this phone number already exists.");
          return;
        }
        if (parsed.value.email && findUserByIdentifier(store, parsed.value.email)) {
          sendError(response, 409, "email_exists", "A user with this email already exists.");
          return;
        }

        const user = createUser(store, parsed.value, adminPhone);
        const session = createSession(store, user.id);
        send(
          response,
          201,
          { user: publicUser(user), token: session.token, expiresAt: session.expiresAt },
          { ...headers, "set-cookie": createCookie(session.token) },
        );
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/auth/login") {
        const body = await readJson(request);
        const identifier = String(body.identifier ?? body.phone ?? body.email ?? "").trim();
        const password = String(body.password ?? "");
        const user = findUserByIdentifier(store, identifier);

        if (!user || !verifyPassword(password, user.passwordHash)) {
          sendError(response, 401, "invalid_credentials", "Phone/email or password is incorrect.");
          return;
        }

        const session = createSession(store, user.id);
        send(
          response,
          200,
          { user: publicUser(user), token: session.token, expiresAt: session.expiresAt },
          { ...headers, "set-cookie": createCookie(session.token) },
        );
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/auth/logout") {
        const token = getSessionToken(request);
        if (token) store.sessions.delete(token);
        send(response, 200, { ok: true }, { ...headers, "set-cookie": clearCookie() });
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/me") {
        const user = getCurrentUser(request, store);
        if (!user) {
          sendError(response, 401, "unauthenticated", "Sign in is required.");
          return;
        }
        send(response, 200, { user: publicUser(user) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/notifications") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        const notifications = Array.from(store.notifications.values())
          .filter((notification) => notification.recipientUserId === user.id)
          .map(publicNotification);
        send(response, 200, { notifications }, headers);
        return;
      }

      const notificationMatch = requestUrl.pathname.match(/^\/notifications\/([^/]+)$/);
      if (method === "PATCH" && notificationMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        const notification = store.notifications.get(decodeURIComponent(notificationMatch[1]));
        if (!notification || notification.recipientUserId !== user.id) {
          sendError(response, 404, "notification_not_found", "Notification was not found.");
          return;
        }
        const nextNotification = { ...notification, readAt: new Date().toISOString() };
        store.notifications.set(nextNotification.id, nextNotification);
        send(response, 200, { notification: publicNotification(nextNotification) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/categories") {
        send(response, 200, { categories: Array.from(store.categories.values()).map(publicCategory) }, headers);
        return;
      }

      const uploadMatch = requestUrl.pathname.match(/^\/uploads\/([^/]+)$/);
      if (method === "GET" && uploadMatch) {
        const upload = store.uploads.get(decodeURIComponent(uploadMatch[1]));
        if (!upload) {
          sendError(response, 404, "upload_not_found", "Upload was not found.");
          return;
        }
        const base64 = upload.dataUrl.slice(upload.dataUrl.indexOf(",") + 1);
        response.writeHead(200, {
          "content-type": upload.mimeType,
          "cache-control": "public, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        });
        response.end(Buffer.from(base64, "base64"));
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/application") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }

        const application = findVendorApplicationByUserId(store, user.id);
        if (!application) {
          sendError(response, 404, "vendor_application_not_found", "Vendor application was not found.");
          return;
        }

        send(response, 200, { application: publicVendorApplication(store, application) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/products") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }

        const products = Array.from(store.products.values())
          .filter((product) => product.vendorUserId === user.id)
          .map((product) => publicProduct(store, product, { includeAdminFields: true }));
        send(response, 200, { products }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/products") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }
        if (user.vendorStatus !== "approved") {
          sendError(response, 403, "vendor_not_approved", "Vendor approval is required before creating products.");
          return;
        }

        const body = await readJson(request);
        const parsed = validateProductInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        const product = createProduct(store, user, parsed.value);
        send(response, 201, { product: publicProduct(store, product, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/uploads") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }
        if (user.vendorStatus !== "approved") {
          sendError(response, 403, "vendor_not_approved", "Vendor approval is required before uploading product images.");
          return;
        }
        const parsed = validateUploadInput(await readJson(request));
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }
        const uploadId = randomUUID();
        const upload = {
          id: uploadId,
          vendorUserId: user.id,
          fileName: parsed.value.fileName,
          mimeType: parsed.value.mimeType,
          dataUrl: parsed.value.dataUrl,
          url: `/uploads/${uploadId}`,
          createdAt: new Date().toISOString(),
        };
        store.uploads.set(upload.id, upload);
        send(response, 201, { upload: { id: upload.id, url: upload.url, fileName: upload.fileName, mimeType: upload.mimeType } }, headers);
        return;
      }

      const vendorProductMatch = requestUrl.pathname.match(/^\/vendor\/products\/([^/]+)$/);
      if (method === "PATCH" && vendorProductMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }

        const product = store.products.get(decodeURIComponent(vendorProductMatch[1]));
        if (!product || product.vendorUserId !== user.id) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }

        const body = await readJson(request);
        const parsed = validateListingStatus(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        const nextProduct = {
          ...product,
          listingStatus: parsed.value.listingStatus,
          updatedAt: new Date().toISOString(),
        };
        store.products.set(nextProduct.id, nextProduct);
        send(response, 200, { product: publicProduct(store, nextProduct, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/products") {
        const category = requestUrl.searchParams.get("category")?.toLowerCase();
        const query = requestUrl.searchParams.get("q")?.trim().toLowerCase();
        if (query) {
          store.searchEvents.push({
            id: randomUUID(),
            query,
            createdAt: new Date().toISOString(),
          });
        }
        const products = Array.from(store.products.values())
          .filter((product) => product.moderationStatus === "approved" && product.listingStatus === "active")
          .filter((product) => !category || product.category === category)
          .filter(
            (product) =>
              !query ||
              product.name.en.toLowerCase().includes(query) ||
              product.name.ha.toLowerCase().includes(query) ||
              product.tags.some((tag) => tag.includes(query)),
          )
          .map((product) => publicProduct(store, product));

        send(response, 200, { products }, headers);
        return;
      }

      const productDetailMatch = requestUrl.pathname.match(/^\/products\/([^/]+)$/);
      if (method === "GET" && productDetailMatch) {
        const product = getPublicCatalogProduct(store, decodeURIComponent(productDetailMatch[1]));
        if (!product) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }
        const currentViews = store.productViews.get(product.id) ?? { productId: product.id, views: 0 };
        store.productViews.set(product.id, {
          productId: product.id,
          views: currentViews.views + 1,
          lastViewedAt: new Date().toISOString(),
        });
        send(response, 200, { product: publicProduct(store, product) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/wishlist") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }
        send(response, 200, { products: getWishlistProducts(store, user.id) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/wishlist") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }
        const body = await readJson(request);
        const product = getPublicCatalogProduct(store, String(body.productId ?? ""));
        if (!product) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }
        const wishlist = store.wishlists.get(user.id) ?? new Set();
        wishlist.add(product.id);
        store.wishlists.set(user.id, wishlist);
        send(response, 200, { products: getWishlistProducts(store, user.id) }, headers);
        return;
      }

      const wishlistMatch = requestUrl.pathname.match(/^\/wishlist\/([^/]+)$/);
      if (method === "DELETE" && wishlistMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }
        const wishlist = store.wishlists.get(user.id) ?? new Set();
        wishlist.delete(decodeURIComponent(wishlistMatch[1]));
        store.wishlists.set(user.id, wishlist);
        send(response, 200, { products: getWishlistProducts(store, user.id) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname.match(/^\/products\/[^/]+\/reviews$/)) {
        const productId = decodeURIComponent(requestUrl.pathname.split("/")[2]);
        const reviews = Array.from(store.reviews.values())
          .filter((review) => review.productId === productId && !review.hidden)
          .map((review) => publicReview(store, review));
        send(response, 200, { reviews }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/reviews") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }
        const body = await readJson(request);
        const parsed = validateReviewInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }
        const result = createReview(store, user, parsed.value);
        if (result.error) {
          sendError(response, result.error.status, result.error.code, result.error.message);
          return;
        }
        send(response, 201, { review: publicReview(store, result.review) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/cart") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }

        send(response, 200, { cart: publicCart(store, user.id) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/cart/items") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }

        const body = await readJson(request);
        const parsed = validateCartItem(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        const product = getPublicCatalogProduct(store, parsed.value.productId);
        if (!product) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }
        if (product.quantityAvailable < parsed.value.quantity) {
          sendError(response, 409, "insufficient_stock", `${product.name.en} has only ${product.quantityAvailable} item(s) available.`);
          return;
        }

        upsertCartItem(store, user.id, parsed.value);
        send(response, 200, { cart: publicCart(store, user.id) }, headers);
        return;
      }

      const cartItemMatch = requestUrl.pathname.match(/^\/cart\/items\/([^/]+)$/);
      if ((method === "PATCH" || method === "DELETE") && cartItemMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }

        const productId = decodeURIComponent(cartItemMatch[1]);
        const cart = store.carts.get(user.id) ?? new Map();

        if (method === "DELETE") {
          cart.delete(productId);
          store.carts.set(user.id, cart);
          send(response, 200, { cart: publicCart(store, user.id) }, headers);
          return;
        }

        const body = await readJson(request);
        const parsed = validateCartItem({ ...body, productId });
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        if (!cart.has(productId)) {
          sendError(response, 404, "cart_item_not_found", "Cart item was not found.");
          return;
        }

        const product = getPublicCatalogProduct(store, productId);
        if (!product) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }
        if (product.quantityAvailable < parsed.value.quantity) {
          sendError(response, 409, "insufficient_stock", `${product.name.en} has only ${product.quantityAvailable} item(s) available.`);
          return;
        }

        upsertCartItem(store, user.id, parsed.value);
        send(response, 200, { cart: publicCart(store, user.id) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/checkout") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }

        const body = await readJson(request);
        const parsed = validateCheckout(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        const result = createOrderFromCart(store, user, parsed.value);
        if (result.error) {
          sendError(response, result.error.status, result.error.code, result.error.message);
          return;
        }

        send(response, 201, { order: publicOrder(store, result.order), cart: publicCart(store, user.id) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/orders") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "customer") {
          sendError(response, 403, "forbidden", "Customer access is required.");
          return;
        }

        const orders = Array.from(store.orders.values())
          .filter((order) => order.customerUserId === user.id)
          .map((order) => publicOrder(store, order));
        send(response, 200, { orders }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/orders") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }

        const orders = Array.from(store.orders.values())
          .filter((order) => order.items.some((item) => item.vendorUserId === user.id))
          .map((order) => ({
            ...publicOrder(store, order),
            items: order.items.filter((item) => item.vendorUserId === user.id),
          }));
        send(response, 200, { orders }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/reviews") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }
        const reviews = Array.from(store.reviews.values())
          .filter((review) => review.vendorUserId === user.id)
          .map((review) => publicReview(store, review, { includeAdminFields: true }));
        send(response, 200, { reviews }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/vendor/wallet") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }
        const payouts = Array.from(store.payoutRequests.values())
          .filter((payout) => payout.vendorUserId === user.id)
          .map(publicPayoutRequest);
        send(response, 200, { wallet: getVendorWalletSummary(store, user.id), payouts }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/vendor/payouts") {
        const user = getCurrentUser(request, store);
        if (!assertAuthenticated(response, user)) return;
        if (user.role !== "vendor") {
          sendError(response, 403, "forbidden", "Vendor access is required.");
          return;
        }
        const body = await readJson(request);
        const parsed = validatePayoutInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }
        const wallet = getVendorWalletSummary(store, user.id);
        if (parsed.value.amount > wallet.availableBalance) {
          sendError(response, 409, "insufficient_wallet_balance", "Payout amount exceeds available balance.");
          return;
        }
        const payout = {
          id: randomUUID(),
          vendorUserId: user.id,
          amount: parsed.value.amount,
          status: "pending",
          bankName: parsed.value.bankName,
          accountNumber: parsed.value.accountNumber,
          accountName: parsed.value.accountName,
          requestedAt: new Date().toISOString(),
        };
        store.payoutRequests.set(payout.id, payout);
        notifyAdmins(store, {
          title: "New payout request",
          message: `${user.name} requested NGN ${payout.amount}.`,
          type: "payout",
        });
        send(response, 201, { payout: publicPayoutRequest(payout) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/users") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(response, 200, { users: Array.from(store.users.values()).map(publicUser) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/admin/categories") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const parsed = validateCategoryInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }
        const now = new Date().toISOString();
        const existing = store.categories.get(parsed.value.key);
        const category = {
          ...parsed.value,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        store.categories.set(category.key, category);
        send(response, existing ? 200 : 201, { category: publicCategory(category) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/promotions") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(response, 200, { promotions: Array.from(store.promotions.values()).map(publicPromotion) }, headers);
        return;
      }

      if (method === "POST" && requestUrl.pathname === "/admin/promotions") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const body = await readJson(request);
        const parsed = validatePromotionInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }
        const now = new Date().toISOString();
        const promotion = {
          id: randomUUID(),
          ...parsed.value,
          createdAt: now,
          updatedAt: now,
        };
        store.promotions.set(promotion.id, promotion);
        send(response, 201, { promotion: publicPromotion(promotion) }, headers);
        return;
      }

      const adminPromotionMatch = requestUrl.pathname.match(/^\/admin\/promotions\/([^/]+)$/);
      if (method === "PATCH" && adminPromotionMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const promotion = store.promotions.get(decodeURIComponent(adminPromotionMatch[1]));
        if (!promotion) {
          sendError(response, 404, "promotion_not_found", "Promotion was not found.");
          return;
        }
        const body = await readJson(request);
        const nextPromotion = {
          ...promotion,
          active: typeof body.active === "boolean" ? body.active : promotion.active,
          updatedAt: new Date().toISOString(),
        };
        store.promotions.set(nextPromotion.id, nextPromotion);
        send(response, 200, { promotion: publicPromotion(nextPromotion) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/reviews") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(
          response,
          200,
          { reviews: Array.from(store.reviews.values()).map((review) => publicReview(store, review, { includeAdminFields: true })) },
          headers,
        );
        return;
      }

      const adminReviewMatch = requestUrl.pathname.match(/^\/admin\/reviews\/([^/]+)$/);
      if (method === "PATCH" && adminReviewMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const review = store.reviews.get(decodeURIComponent(adminReviewMatch[1]));
        if (!review) {
          sendError(response, 404, "review_not_found", "Review was not found.");
          return;
        }
        const decision = validateReviewModeration(await readJson(request));
        const nextReview = {
          ...review,
          hidden: decision.value.hidden,
          adminNote: decision.value.adminNote || undefined,
          updatedAt: new Date().toISOString(),
        };
        store.reviews.set(nextReview.id, nextReview);
        send(response, 200, { review: publicReview(store, nextReview, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/payouts") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(response, 200, { payouts: Array.from(store.payoutRequests.values()).map(publicPayoutRequest) }, headers);
        return;
      }

      const adminPayoutMatch = requestUrl.pathname.match(/^\/admin\/payouts\/([^/]+)$/);
      if (method === "PATCH" && adminPayoutMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const payout = store.payoutRequests.get(decodeURIComponent(adminPayoutMatch[1]));
        if (!payout) {
          sendError(response, 404, "payout_not_found", "Payout request was not found.");
          return;
        }
        if (payout.status !== "pending") {
          sendError(response, 409, "payout_already_reviewed", "Payout request has already been reviewed.");
          return;
        }
        const decision = validatePayoutDecision(await readJson(request));
        if (!decision.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors);
          return;
        }
        const wallet = getVendorWalletSummary(store, payout.vendorUserId);
        if (decision.value.status === "approved" && payout.amount > wallet.availableBalance) {
          sendError(response, 409, "insufficient_wallet_balance", "Payout amount exceeds available balance.");
          return;
        }
        const nextPayout = updatePayoutStatus(store, payout, decision.value);
        createNotification(store, {
          audience: "vendor",
          recipientUserId: nextPayout.vendorUserId,
          title: `Payout ${nextPayout.status}`,
          message: `Your payout request for NGN ${nextPayout.amount} was ${nextPayout.status}.`,
          type: "payout",
        });
        send(response, 200, { payout: publicPayoutRequest(nextPayout) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/analytics") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        const totalSales = Array.from(store.orders.values()).reduce((sum, order) => sum + order.subtotal, 0);
        const bestSellingProducts = new Map();
        for (const order of store.orders.values()) {
          for (const item of order.items) {
            const current = bestSellingProducts.get(item.productId) ?? { productId: item.productId, quantity: 0, sales: 0 };
            current.quantity += item.quantity;
            current.sales += item.lineTotal;
            bestSellingProducts.set(item.productId, current);
          }
        }
        send(
          response,
          200,
          {
            analytics: {
              totalSales,
              totalOrders: store.orders.size,
              cancelledOrders: Array.from(store.orders.values()).filter((order) => order.status === "cancelled").length,
              customerGrowth: Array.from(store.users.values()).filter((item) => item.role === "customer").length,
              vendorGrowth: Array.from(store.users.values()).filter((item) => item.role === "vendor").length,
              productViews: Array.from(store.productViews.values()).sort((a, b) => b.views - a.views),
              popularSearches: store.searchEvents.reduce((items, event) => {
                const current = items.find((item) => item.query === event.query);
                if (current) current.count += 1;
                else items.push({ query: event.query, count: 1 });
                return items;
              }, []),
              bestSellingProducts: Array.from(bestSellingProducts.values()).sort((a, b) => b.quantity - a.quantity),
            },
          },
          headers,
        );
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/orders") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(response, 200, { orders: Array.from(store.orders.values()).map((order) => publicOrder(store, order)) }, headers);
        return;
      }

      const adminOrderMatch = requestUrl.pathname.match(/^\/admin\/orders\/([^/]+)$/);
      if (method === "PATCH" && adminOrderMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const order = store.orders.get(decodeURIComponent(adminOrderMatch[1]));
        if (!order) {
          sendError(response, 404, "order_not_found", "Order was not found.");
          return;
        }

        const body = await readJson(request);
        const parsed = validateOrderStatusInput(body);
        if (!parsed.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", parsed.errors);
          return;
        }

        const result = updateOrderStatus(store, order, parsed.value);
        if (result.error) {
          sendError(response, result.error.status, result.error.code, result.error.message);
          return;
        }

        send(response, 200, { order: publicOrder(store, result.order) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/payments") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;
        send(response, 200, { payments: Array.from(store.payments.values()).map(publicPayment) }, headers);
        return;
      }

      const adminPaymentMatch = requestUrl.pathname.match(/^\/admin\/payments\/([^/]+)$/);
      if (method === "PATCH" && adminPaymentMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const payment = store.payments.get(decodeURIComponent(adminPaymentMatch[1]));
        if (!payment) {
          sendError(response, 404, "payment_not_found", "Payment was not found.");
          return;
        }

        const body = await readJson(request);
        const decision = validatePaymentDecision(body);
        if (!decision.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors);
          return;
        }

        const nextPayment = updatePaymentStatus(store, payment, decision.value);
        send(response, 200, { payment: publicPayment(nextPayment), order: publicOrder(store, store.orders.get(nextPayment.orderId)) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/products") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const status = requestUrl.searchParams.get("status");
        const products = Array.from(store.products.values())
          .filter((product) => !status || product.moderationStatus === status)
          .map((product) => publicProduct(store, product, { includeAdminFields: true }));

        send(response, 200, { products }, headers);
        return;
      }

      const productModerationMatch = requestUrl.pathname.match(/^\/admin\/products\/([^/]+)$/);
      if (method === "PATCH" && productModerationMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const product = store.products.get(decodeURIComponent(productModerationMatch[1]));
        if (!product) {
          sendError(response, 404, "product_not_found", "Product was not found.");
          return;
        }

        const body = await readJson(request);
        const decision = validateProductModeration(body);
        if (!decision.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors);
          return;
        }

        const nextProduct = updateProductModeration(product, decision.value);
        store.products.set(nextProduct.id, nextProduct);
        createNotification(store, {
          audience: "vendor",
          recipientUserId: nextProduct.vendorUserId,
          title: `Product ${nextProduct.moderationStatus}`,
          message: `${nextProduct.name.en} was ${nextProduct.moderationStatus}.`,
          type: "product",
          productId: nextProduct.id,
        });
        send(response, 200, { product: publicProduct(store, nextProduct, { includeAdminFields: true }) }, headers);
        return;
      }

      if (method === "GET" && requestUrl.pathname === "/admin/vendor-applications") {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const status = requestUrl.searchParams.get("status");
        const applications = Array.from(store.vendorApplications.values())
          .filter((application) => !status || application.status === status)
          .map((application) => publicVendorApplication(store, application));

        send(response, 200, { applications }, headers);
        return;
      }

      const vendorDecisionMatch = requestUrl.pathname.match(/^\/admin\/vendor-applications\/([^/]+)$/);
      if (method === "PATCH" && vendorDecisionMatch) {
        const user = getCurrentUser(request, store);
        if (!assertAdmin(response, user)) return;

        const application = findVendorApplicationById(store, decodeURIComponent(vendorDecisionMatch[1]));
        if (!application) {
          sendError(response, 404, "vendor_application_not_found", "Vendor application was not found.");
          return;
        }

        const body = await readJson(request);
        const decision = validateVendorDecision(body);
        if (!decision.valid) {
          sendError(response, 422, "validation_failed", "Check the highlighted fields.", decision.errors);
          return;
        }

        const nextApplication = updateVendorApplicationStatus(store, application, decision.value);
        send(response, 200, { application: publicVendorApplication(store, nextApplication) }, headers);
        return;
      }

      sendError(response, 404, "not_found", "Route not found.");
    } catch (error) {
      sendError(
        response,
        error.status ?? 500,
        error.code ?? "internal_error",
        error.status ? error.message : "Something went wrong.",
      );
    }
  }

  return { handle, store };
}

export async function inject(app, options = {}) {
  const body = typeof options.body === "string" ? options.body : options.body ? JSON.stringify(options.body) : "";
  const requestHeaders = {
    host: "kano-mart.test",
    ...(options.headers ?? {}),
  };
  const chunks = body ? [Buffer.from(body)] : [];

  const request = {
    method: options.method ?? "GET",
    url: options.path ?? "/",
    headers: requestHeaders,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };

  return await new Promise((resolve) => {
    const response = {
      status: 200,
      headers: {},
      writeHead(status, headers = {}) {
        this.status = status;
        this.headers = Object.fromEntries(
          Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
        );
      },
      end(payload = "") {
        const text = String(payload);
        resolve({
          status: this.status,
          headers: this.headers,
          body: text ? JSON.parse(text) : null,
        });
      },
    };

    app.handle(request, response);
  });
}

export function startServer(options = {}) {
  const app = createApp(options);
  const port = Number(options.port ?? process.env.PORT ?? 8787);
  const server = createServer(app.handle);
  server.listen(port, options.host ?? "0.0.0.0");
  return { app, server };
}

const vercelApp = createApp({
  allowedOrigin: process.env.CORS_ORIGIN ?? "*",
});

export default function handler(request, response) {
  if (request.url?.startsWith("/api")) {
    request.url = request.url.slice(4) || "/";
  }
  return vercelApp.handle(request, response);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { server } = startServer();
  server.on("listening", () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : process.env.PORT ?? 8787;
    console.log(`Kano Mart API listening on http://localhost:${port}`);
  });
}
