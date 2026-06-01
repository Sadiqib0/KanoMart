// src/data.ts
var storageKeys = {
  searches: "kanoMart.searchHistory",
  vendors: "kanoMart.vendorRequests",
  cart: "kanoMart.cart",
  orders: "kanoMart.orders",
  payments: "kanoMart.payments",
  walletLedger: "kanoMart.walletLedger",
  withdrawals: "kanoMart.withdrawals",
  reviews: "kanoMart.reviews",
  wishlist: "kanoMart.wishlist",
  productModeration: "kanoMart.productModeration",
  session: "kanoMart.session",
  adminSession: "kanoMart.adminSession",
  language: "kanoMart.language"
};
var ADMIN_PIN = "0000";
var categoryLabels = {
  food: { en: "Food", ha: "Abinci" },
  fashion: { en: "Fashion", ha: "Kaya" },
  children: { en: "Children", ha: "Yara" },
  essentials: { en: "Essentials", ha: "Kayan yau da kullum" },
  "unmatched demand": { en: "Unmatched demand", ha: "Bukatar da ba a daidaita ba" }
};
var orderStatusLabels = {
  placed: { en: "Order placed", ha: "An sanya oda" },
  confirmed: { en: "Confirmed by vendor", ha: "Dan kasuwa ya tabbatar" },
  packed: { en: "Packed", ha: "An hada kaya" },
  dispatched: { en: "Out for delivery", ha: "Ana kai kaya" },
  delivered: { en: "Delivered", ha: "An kai kaya" },
  cancelled: { en: "Cancelled", ha: "An soke" }
};
var vendorProfiles = {
  "Dan Marke Stores": {
    name: "Dan Marke Stores",
    area: "Sabon Gari",
    rating: 4.7,
    totalOrders: 1240,
    fulfillmentRate: 97,
    responseTime: { en: "Usually within 1 hour", ha: "Yawanci cikin sa'a 1" },
    since: "2021"
  },
  "Hajiya Ladi Kitchen": {
    name: "Hajiya Ladi Kitchen",
    area: "Tarauni",
    rating: 4.9,
    totalOrders: 890,
    fulfillmentRate: 96,
    responseTime: { en: "Usually within 30 min", ha: "Yawanci cikin minti 30" },
    since: "2022"
  },
  "Aminu Snacks": {
    name: "Aminu Snacks",
    area: "Kofar Ruwa",
    rating: 4.5,
    totalOrders: 620,
    fulfillmentRate: 94,
    responseTime: { en: "Usually within 1 hour", ha: "Yawanci cikin sa'a 1" },
    since: "2023"
  },
  "Kantin Kwari Textiles": {
    name: "Kantin Kwari Textiles",
    area: "Kantin Kwari",
    rating: 4.8,
    totalOrders: 2100,
    fulfillmentRate: 98,
    responseTime: { en: "Usually within 2 hours", ha: "Yawanci cikin sa'a 2" },
    since: "2020"
  },
  "Alhaji Musa Wears": {
    name: "Alhaji Musa Wears",
    area: "Fagge",
    rating: 4.6,
    totalOrders: 780,
    fulfillmentRate: 95,
    responseTime: { en: "Usually within 2 hours", ha: "Yawanci cikin sa'a 2" },
    since: "2021"
  },
  "Rayyan Fragrance": {
    name: "Rayyan Fragrance",
    area: "Zoo Road",
    rating: 4.7,
    totalOrders: 450,
    fulfillmentRate: 99,
    responseTime: { en: "Usually within 1 hour", ha: "Yawanci cikin sa'a 1" },
    since: "2022"
  },
  "Kano Footwear Hub": {
    name: "Kano Footwear Hub",
    area: "Naibawa",
    rating: 4.4,
    totalOrders: 560,
    fulfillmentRate: 93,
    responseTime: { en: "Usually within 3 hours", ha: "Yawanci cikin sa'a 3" },
    since: "2021"
  },
  "Amina Boutique": {
    name: "Amina Boutique",
    area: "Farm Centre",
    rating: 4.8,
    totalOrders: 930,
    fulfillmentRate: 97,
    responseTime: { en: "Usually within 2 hours", ha: "Yawanci cikin sa'a 2" },
    since: "2020"
  },
  "Safara Beauty": {
    name: "Safara Beauty",
    area: "Sheka",
    rating: 4.6,
    totalOrders: 340,
    fulfillmentRate: 96,
    responseTime: { en: "Usually within 1 hour", ha: "Yawanci cikin sa'a 1" },
    since: "2023"
  },
  "Back To School Kano": {
    name: "Back To School Kano",
    area: "Hotoro",
    rating: 4.5,
    totalOrders: 1100,
    fulfillmentRate: 94,
    responseTime: { en: "Usually within 2 hours", ha: "Yawanci cikin sa'a 2" },
    since: "2021"
  },
  "Bayero Bookshop": {
    name: "Bayero Bookshop",
    area: "Gwale",
    rating: 4.7,
    totalOrders: 860,
    fulfillmentRate: 98,
    responseTime: { en: "Usually within 1 hour", ha: "Yawanci cikin sa'a 1" },
    since: "2019"
  },
  "Kano Learning Hub": {
    name: "Kano Learning Hub",
    area: "Bompai",
    rating: 4.9,
    totalOrders: 320,
    fulfillmentRate: 100,
    responseTime: { en: "Usually within 30 min", ha: "Yawanci cikin minti 30" },
    since: "2022"
  }
};
var seedReviews = [
  {
    id: "seed-r1",
    productId: "food-rice",
    reviewerName: "Aisha M.",
    rating: 5,
    comment: "Quality rice, delivered same day. Dan Marke never disappoints!",
    createdAt: "2025-04-10T09:00:00Z"
  },
  {
    id: "seed-r2",
    productId: "food-rice",
    reviewerName: "Bello K.",
    rating: 4,
    comment: "Good price and fresh stock. Will order again.",
    createdAt: "2025-04-08T14:30:00Z"
  },
  {
    id: "seed-r3",
    productId: "food-tuwo",
    reviewerName: "Fatima A.",
    rating: 5,
    comment: "Hajiya Ladi's miyan kuka is the best in Tarauni. Hot and fresh!",
    createdAt: "2025-04-12T12:15:00Z"
  },
  {
    id: "seed-r4",
    productId: "fashion-fabric",
    reviewerName: "Zainab U.",
    rating: 5,
    comment: "Beautiful Ankara, exactly as described. Fast delivery from Kantin Kwari.",
    createdAt: "2025-04-09T11:00:00Z"
  },
  {
    id: "seed-r5",
    productId: "fashion-fabric",
    reviewerName: "Maryam S.",
    rating: 4,
    comment: "Good quality fabric, colors are vibrant. Slightly delayed but worth it.",
    createdAt: "2025-04-07T16:45:00Z"
  },
  {
    id: "seed-r6",
    productId: "fashion-jallabiya",
    reviewerName: "Usman B.",
    rating: 5,
    comment: "Perfect fit. Alhaji Musa's quality is always top notch.",
    createdAt: "2025-04-11T10:20:00Z"
  },
  {
    id: "seed-r7",
    productId: "children-bag",
    reviewerName: "Hauwa I.",
    rating: 4,
    comment: "Durable bag, my son loves it. Good value for the price.",
    createdAt: "2025-04-06T08:30:00Z"
  },
  {
    id: "seed-r8",
    productId: "children-books",
    reviewerName: "Ibrahim D.",
    rating: 5,
    comment: "Bulk order for the new term. Bayero Bookshop always has everything ready.",
    createdAt: "2025-04-05T15:00:00Z"
  },
  {
    id: "seed-r9",
    productId: "fashion-perfume",
    reviewerName: "Sadiya R.",
    rating: 5,
    comment: "Amazing scent, long lasting. Best oil perfume in Kano!",
    createdAt: "2025-04-13T09:45:00Z"
  },
  {
    id: "seed-r10",
    productId: "fashion-boutique",
    reviewerName: "Khadija M.",
    rating: 5,
    comment: "Amina Boutique never disappoints. Modest and beautiful.",
    createdAt: "2025-04-14T13:00:00Z"
  }
];
var products = [
  {
    id: "food-rice",
    name: { en: "Kano local rice 10kg", ha: "Shinkafar Kano kilo 10" },
    category: { en: "Food", ha: "Abinci" },
    subcategory: { en: "Groceries", ha: "Kayan masarufi" },
    price: "NGN 18,500",
    vendor: "Dan Marke Stores",
    area: "Sabon Gari",
    availability: { en: "Available today", ha: "Akwai yau" },
    accent: "#176b4d",
    tags: ["rice", "shinkafa", "groceries", "kayan masarufi", "food", "abinci", "grain"]
  },
  {
    id: "food-tuwo",
    name: { en: "Tuwo and miyan kuka pack", ha: "Tuwo da miyan kuka" },
    category: { en: "Food", ha: "Abinci" },
    subcategory: { en: "Traditional dishes", ha: "Abincin gargajiya" },
    price: "NGN 2,800",
    vendor: "Hajiya Ladi Kitchen",
    area: "Tarauni",
    availability: { en: "Ready from 12pm", ha: "A shirye daga 12 na rana" },
    accent: "#b64232",
    tags: ["tuwo", "miyan kuka", "traditional", "abincin gargajiya", "restaurant", "gidajen abinci"]
  },
  {
    id: "food-snacks",
    name: { en: "Masa and spicy sauce", ha: "Masa da yaji" },
    category: { en: "Food", ha: "Abinci" },
    subcategory: { en: "Fast food and snacks", ha: "Kayan ciye-ciye" },
    price: "NGN 1,200",
    vendor: "Aminu Snacks",
    area: "Kofar Ruwa",
    availability: { en: "Fresh daily", ha: "Sabo kullum" },
    accent: "#d69b2d",
    tags: ["masa", "snacks", "fast food", "kayan ciye ciye", "yaji", "abinci"]
  },
  {
    id: "fashion-fabric",
    name: { en: "Ankara fabric bundle", ha: "Yadukan Ankara" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Fabrics", ha: "Yaduka" },
    price: "NGN 14,000",
    vendor: "Kantin Kwari Textiles",
    area: "Kantin Kwari",
    availability: { en: "New colors in stock", ha: "Sabbin launuka suna nan" },
    accent: "#5c4f83",
    tags: ["fabric", "fabrics", "yaduka", "ankara", "kaya", "textile", "fashion"]
  },
  {
    id: "fashion-jallabiya",
    name: { en: "Men jallabiya", ha: "Jallabiyar maza" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Jallabiya", ha: "Jallabiya" },
    price: "NGN 22,000",
    vendor: "Alhaji Musa Wears",
    area: "Fagge",
    availability: { en: "Sizes M to XXL", ha: "Girma M zuwa XXL" },
    accent: "#1f7b84",
    tags: ["jallabiya", "clothes", "boutique", "kayan boutique", "fashion", "kaya"]
  },
  {
    id: "fashion-perfume",
    name: { en: "Oil perfume set", ha: "Turaren mai" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Perfumes", ha: "Turare" },
    price: "NGN 6,500",
    vendor: "Rayyan Fragrance",
    area: "Zoo Road",
    availability: { en: "Top seller", ha: "Ana yawan saya" },
    accent: "#0f4b37",
    tags: ["perfume", "perfumes", "turare", "oil", "fragrance", "fashion", "kaya"]
  },
  {
    id: "fashion-shoes",
    name: { en: "Leather sandals", ha: "Takalman fata" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Shoes", ha: "Takalma" },
    price: "NGN 11,000",
    vendor: "Kano Footwear Hub",
    area: "Naibawa",
    availability: { en: "Made in Kano", ha: "An yi a Kano" },
    accent: "#854d2a",
    tags: ["shoes", "takalma", "sandals", "leather", "fashion", "kaya"]
  },
  {
    id: "fashion-boutique",
    name: { en: "Modest boutique gown", ha: "Rigar boutique" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Boutique clothes", ha: "Kayan boutique" },
    price: "NGN 17,500",
    vendor: "Amina Boutique",
    area: "Farm Centre",
    availability: { en: "New arrivals", ha: "Sabbin kaya sun iso" },
    accent: "#5c4f83",
    tags: ["boutique", "clothes", "kayan boutique", "gown", "riga", "fashion", "kaya"]
  },
  {
    id: "fashion-cosmetics",
    name: { en: "Cosmetics starter kit", ha: "Kayan kwalliya" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Cosmetics", ha: "Kayan kwalliya" },
    price: "NGN 8,700",
    vendor: "Safara Beauty",
    area: "Sheka",
    availability: { en: "Verified vendor", ha: "Tabbataccen dan kasuwa" },
    accent: "#b64232",
    tags: ["cosmetics", "makeup", "kwalliya", "kayan kwalliya", "beauty", "fashion", "kaya"]
  },
  {
    id: "fashion-caps",
    name: { en: "Embroidered northern cap", ha: "Hular zanna" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Caps", ha: "Huluna" },
    price: "NGN 4,500",
    vendor: "Huluna Kano",
    area: "Kofar Wambai",
    availability: { en: "Many patterns", ha: "Zane-zane da yawa" },
    accent: "#176b4d",
    tags: ["caps", "cap", "huluna", "hula", "zanna", "fashion", "kaya"]
  },
  {
    id: "fashion-watch",
    name: { en: "Everyday wristwatch", ha: "Agogon hannu" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Watches", ha: "Agogo" },
    price: "NGN 12,500",
    vendor: "Time House Kano",
    area: "Murtala Mohammed Way",
    availability: { en: "Warranty included", ha: "Akwai garanti" },
    accent: "#0f4b37",
    tags: ["watch", "watches", "agogo", "agogon hannu", "fashion", "kaya"]
  },
  {
    id: "fashion-glasses",
    name: { en: "Reading glasses", ha: "Tabarau" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Glasses", ha: "Tabarau" },
    price: "NGN 5,500",
    vendor: "Clear View Optics",
    area: "Dangi Roundabout",
    availability: { en: "Multiple strengths", ha: "Girma daban-daban" },
    accent: "#1f7b84",
    tags: ["glasses", "tabarau", "reading glasses", "fashion", "kaya"]
  },
  {
    id: "fashion-bag",
    name: { en: "Ladies handbag", ha: "Jakar hannu" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Bags", ha: "Jakunkuna" },
    price: "NGN 13,000",
    vendor: "Zahra Bags",
    area: "Aminu Kano Way",
    availability: { en: "Popular colors available", ha: "Akwai shahararrun launuka" },
    accent: "#854d2a",
    tags: ["bags", "bag", "jakunkuna", "jakar hannu", "handbag", "fashion", "kaya"]
  },
  {
    id: "fashion-jewelry",
    name: { en: "Jewelry set", ha: "Kayan ado" },
    category: { en: "Fashion", ha: "Kaya" },
    subcategory: { en: "Jewelry", ha: "Kayan ado" },
    price: "NGN 7,800",
    vendor: "Maryam Accessories",
    area: "Court Road",
    availability: { en: "Gift packs ready", ha: "Akwai kunshin kyauta" },
    accent: "#d69b2d",
    tags: ["jewelry", "jewellery", "kayan ado", "accessories", "fashion", "kaya"]
  },
  {
    id: "children-bag",
    name: { en: "Primary school bag", ha: "Jakar makarantar firamare" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "School bags", ha: "Jakunkunan makaranta" },
    price: "NGN 9,500",
    vendor: "Back To School Kano",
    area: "Hotoro",
    availability: { en: "Limited colors", ha: "Launuka kadan sun rage" },
    accent: "#2563eb",
    tags: ["school bag", "school bags", "jakar makaranta", "jakunkunan makaranta", "children", "yara"]
  },
  {
    id: "children-books",
    name: { en: "Exercise books pack", ha: "Kunshin littattafan rubutu" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "Books", ha: "Littattafai" },
    price: "NGN 3,200",
    vendor: "Bayero Bookshop",
    area: "Gwale",
    availability: { en: "Bulk prices available", ha: "Akwai farashin yawa" },
    accent: "#7c3aed",
    tags: ["books", "book", "littattafai", "exercise", "school", "education", "makaranta", "ilimi"]
  },
  {
    id: "children-lunch",
    name: { en: "Insulated lunch box", ha: "Akwatin abincin makaranta" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "Lunch box", ha: "Akwatin abincin makaranta" },
    price: "NGN 4,800",
    vendor: "Yara Essentials",
    area: "Nassarawa",
    availability: { en: "Available this week", ha: "Akwai a wannan mako" },
    accent: "#b64232",
    tags: ["lunch box", "akwatin abinci", "children", "school", "yara", "makaranta"]
  },
  {
    id: "children-education",
    name: { en: "After-school lesson booking", ha: "Rajistar karin karatu" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "Schools and education", ha: "Makarantu da ilimi" },
    price: "NGN 10,000",
    vendor: "Kano Learning Hub",
    area: "Bompai",
    availability: { en: "Weekday slots", ha: "Lokutan ranakun aiki" },
    accent: "#176b4d",
    tags: ["school", "schools", "education", "lesson", "makarantu", "ilimi", "karatu", "children", "yara"]
  },
  {
    id: "children-wears",
    name: { en: "Children native wear set", ha: "Kayan yara na gargajiya" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "Children wears", ha: "Kayan yara" },
    price: "NGN 12,000",
    vendor: "Little Kano Wears",
    area: "Sharada",
    availability: { en: "Ages 2 to 10", ha: "Shekara 2 zuwa 10" },
    accent: "#5c4f83",
    tags: ["children wears", "children clothes", "kayan yara", "native wear", "yara"]
  },
  {
    id: "children-shoes",
    name: { en: "Children school shoes", ha: "Takalman yara na makaranta" },
    category: { en: "Children", ha: "Yara" },
    subcategory: { en: "Children shoes", ha: "Takalman yara" },
    price: "NGN 8,200",
    vendor: "Yara Footwear",
    area: "Kawo",
    availability: { en: "Black and brown", ha: "Baki da ruwan kasa" },
    accent: "#1f7b84",
    tags: ["children shoes", "school shoes", "takalman yara", "shoes", "takalma", "yara", "makaranta"]
  }
];
var demoOrders = [
  {
    id: "KM-1042",
    item: { en: "Kano local rice 10kg", ha: "Shinkafar Kano kilo 10" },
    status: { en: "Ready for delivery", ha: "A shirye domin kaiwa" }
  },
  {
    id: "KM-1041",
    item: { en: "Ankara fabric bundle", ha: "Yadukan Ankara" },
    status: { en: "Vendor confirmed", ha: "Dan kasuwa ya tabbatar" }
  },
  {
    id: "KM-1040",
    item: { en: "Primary school bag", ha: "Jakar makarantar firamare" },
    status: { en: "Packed", ha: "An hada kaya" }
  }
];

// src/state.ts
var savedLanguage = localStorage.getItem(storageKeys.language);
var savedSession = localStorage.getItem(storageKeys.session);
var savedAdminSession = localStorage.getItem(storageKeys.adminSession);
function loadSession() {
  try {
    return savedSession ? JSON.parse(savedSession) : null;
  } catch {
    return null;
  }
}
var state = {
  language: savedLanguage === "ha" ? "ha" : "en",
  cartCount: 0,
  lastQuery: "",
  lastResults: [],
  visibleProductCount: 8,
  currentUser: loadSession(),
  adminAuthenticated: !!savedAdminSession
};
var elements = {
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#marketSearch"),
  resultsGrid: document.querySelector("#resultsGrid"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultsIntro: document.querySelector("#resultsIntro"),
  resultStatus: document.querySelector("#resultStatus"),
  emptyState: document.querySelector("#emptyState"),
  loadMoreProducts: document.querySelector("#loadMoreProducts"),
  quickSearches: document.querySelector(".quick-searches"),
  languageButtons: document.querySelectorAll("[data-language]"),
  appSidebar: document.querySelector("#appSidebar"),
  sidebarOpen: document.querySelector("#sidebarOpen"),
  sidebarClose: document.querySelector("#sidebarClose"),
  sidebarCollapse: document.querySelector("#sidebarCollapse"),
  sidebarOverlay: document.querySelector("#sidebarOverlay"),
  cartCountEl: document.querySelector("[data-cart-count]"),
  wishlistCountEl: document.querySelector("[data-wishlist-count]"),
  cartPanel: document.querySelector("#cartPanel"),
  cartOverlay: document.querySelector("#cartOverlay"),
  cartItemsEl: document.querySelector("#cartItems"),
  cartSubtotal: document.querySelector("#cartSubtotal"),
  cartEmptyState: document.querySelector("#cartEmptyState"),
  checkoutButton: document.querySelector("#checkoutButton"),
  vendorForm: document.querySelector("#vendorForm"),
  vendorMessage: document.querySelector("#vendorMessage"),
  totalSearches: document.querySelector("#totalSearches"),
  failedSearches: document.querySelector("#failedSearches"),
  savedVendors: document.querySelector("#savedVendors"),
  topDemand: document.querySelector("#topDemand"),
  popularSearches: document.querySelector("#popularSearches"),
  failedSearchList: document.querySelector("#failedSearchList"),
  demandTrends: document.querySelector("#demandTrends"),
  vendorApprovals: document.querySelector("#vendorApprovals"),
  productModeration: document.querySelector("#productModeration"),
  withdrawalQueue: document.querySelector("#withdrawalQueue"),
  vendorPerformance: document.querySelector("#vendorPerformance"),
  orderRecords: document.querySelector("#orderRecords"),
  paymentStatus: document.querySelector("#paymentStatus"),
  searchHistoryTable: document.querySelector("#searchHistoryTable"),
  exportSearches: document.querySelector("#exportSearches"),
  clearSearches: document.querySelector("#clearSearches"),
  adminGate: document.querySelector("#adminGate"),
  adminContent: document.querySelector("#adminContent"),
  adminPinForm: document.querySelector("#adminPinForm"),
  adminPinError: document.querySelector("#adminPinError"),
  userButton: document.querySelector("#userButton"),
  userButtonLabel: document.querySelector("#userButtonLabel"),
  toastContainer: document.querySelector("#toastContainer")
};

// src/utils.ts
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
function sanitizePlainText(value, maxLength = 160) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}
function normalize(value) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function parsePrice(price) {
  return parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
}
function formatPrice(amount) {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}
function getCopy(en, ha) {
  return state.language === "ha" ? ha : en;
}
function getLocalizedValue(value) {
  if (value !== null && typeof value === "object") {
    return value[state.language] || value.en || "";
  }
  return value || "";
}
function localizeCategory(category) {
  const key = String(category || "").toLowerCase().trim();
  return categoryLabels[key]?.[state.language] ?? category;
}
function formatDate(value) {
  return new Intl.DateTimeFormat(state.language === "ha" ? "ha-NG" : "en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
function groupByValue(items, accessor) {
  return items.reduce(
    (acc, item) => {
      const key = accessor(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {}
  );
}
function sortEntries(grouped) {
  return Object.entries(grouped).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
function setActiveLanguageButtons(language) {
  document.querySelectorAll("[data-language]").forEach((button) => {
    const isActive = button.dataset.language === language;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}
function renderStars(rating) {
  const full = Math.round(rating);
  return Array.from(
    { length: 5 },
    (_, i) => `<span class="star${i < full ? " star-filled" : ""}" aria-hidden="true">\u2605</span>`
  ).join("");
}

export {
  storageKeys,
  ADMIN_PIN,
  orderStatusLabels,
  vendorProfiles,
  seedReviews,
  products,
  demoOrders,
  state,
  elements,
  escapeHtml,
  sanitizePlainText,
  normalize,
  parsePrice,
  formatPrice,
  getCopy,
  getLocalizedValue,
  localizeCategory,
  formatDate,
  groupByValue,
  sortEntries,
  setActiveLanguageButtons,
  renderStars
};
