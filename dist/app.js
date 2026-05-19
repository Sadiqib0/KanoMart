"use strict";
(() => {
  // src/data.ts
  var storageKeys = {
    searches: "kanoMart.searchHistory",
    vendors: "kanoMart.vendorRequests",
    cart: "kanoMart.cart",
    orders: "kanoMart.orders",
    reviews: "kanoMart.reviews",
    wishlist: "kanoMart.wishlist",
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
  var demoPayments = [
    {
      label: { en: "Card payment", ha: "Biyan kati" },
      value: { en: "Paid", ha: "An biya" }
    },
    {
      label: { en: "Bank transfer", ha: "Tura kudi ta banki" },
      value: { en: "Pending match", ha: "Ana jiran daidaitawa" }
    },
    {
      label: { en: "Pay on delivery", ha: "Biya idan an kawo" },
      value: { en: "Awaiting delivery", ha: "Ana jiran kai kaya" }
    }
  ];

  // src/storage.ts
  function getStoredList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  }
  function setStoredList(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
  function createId() {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
    return `km-${Date.now()}-${Math.round(Math.random() * 1e5)}`;
  }

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
    quickSearches: document.querySelector(".quick-searches"),
    languageButtons: document.querySelectorAll("[data-language]"),
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
    return products.filter((product) => {
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
  function showToast({ message, type = "success", duration = 3e3 }) {
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
    } else {
      list.splice(idx, 1);
      showToast({
        message: getCopy("Removed from wishlist", "An cire daga jerin da aka ajiye"),
        type: "info"
      });
    }
    setStoredList(storageKeys.wishlist, list);
    syncWishlistCount();
    syncWishlistButtons(productId);
  }
  function syncWishlistCount() {
    const count = getWishlist().length;
    elements.wishlistCountEl.textContent = String(count);
    elements.wishlistCountEl.hidden = count === 0;
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

  // src/reviews.ts
  function getAllReviews() {
    const stored = getStoredList(storageKeys.reviews);
    const storedIds = new Set(stored.map((r) => r.id));
    const seeds = seedReviews.filter((r) => !storedIds.has(r.id));
    return [...stored, ...seeds];
  }
  function getProductReviews(productId) {
    return getAllReviews().filter((r) => r.productId === productId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  function getAverageRating(productId) {
    const reviews = getProductReviews(productId);
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }
  function addReview(productId, reviewerName, rating, comment) {
    const stored = getStoredList(storageKeys.reviews);
    stored.unshift({
      id: createId(),
      productId,
      reviewerName,
      rating,
      comment,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    setStoredList(storageKeys.reviews, stored);
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

  // src/render.ts
  function renderProductCard(product) {
    const name = product.name[state.language];
    const category = product.category[state.language];
    const subcategory = product.subcategory[state.language];
    const availability = product.availability[state.language];
    const wished = isWishlisted(product.id);
    const avg = getAverageRating(product.id);
    const reviewCount = getProductReviews(product.id).length;
    return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="product-thumb" style="--accent: ${product.accent}">
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
      <footer>
        <span class="price">${escapeHtml(product.price)}</span>
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
    const vendorRows = vendors.slice(0, 3).map((vendor) => ({
      label: vendor.businessName,
      value: `${localizeCategory(vendor.category)} \u2014 ${vendor.area}`
    }));
    const defaultVendors = [
      { label: "Hajiya Ladi Kitchen", value: { en: "96% fulfilled orders", ha: "An cika oda 96%" } },
      { label: "Kantin Kwari Textiles", value: { en: "Fast stock updates", ha: "Saurin sabunta kaya" } },
      { label: "Back To School Kano", value: { en: "High school demand", ha: "Bukatar makaranta ta yi yawa" } }
    ];
    elements.vendorPerformance.innerHTML = [...vendorRows, ...defaultVendors].slice(0, 4).map(
      (row) => `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(getLocalizedValue(row.value))}</span></div>`
    ).join("");
    elements.orderRecords.innerHTML = demoOrders.map(
      (order) => `<div class="record-row"><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(getLocalizedValue(order.status))}</span></div>`
    ).join("");
    elements.paymentStatus.innerHTML = demoPayments.map(
      (payment) => `<div class="record-row"><strong>${escapeHtml(getLocalizedValue(payment.label))}</strong><span>${escapeHtml(getLocalizedValue(payment.value))}</span></div>`
    ).join("");
  }
  function renderAdminDashboard() {
    const history = getStoredList(storageKeys.searches);
    const vendors = getStoredList(storageKeys.vendors);
    const failed = history.filter((item) => item.resultCount === 0);
    const popular = sortEntries(groupByValue(history, (item) => item.query.toLowerCase()));
    const failedPopular = sortEntries(groupByValue(failed, (item) => item.query.toLowerCase()));
    elements.totalSearches.textContent = String(history.length);
    elements.failedSearches.textContent = String(failed.length);
    elements.savedVendors.textContent = String(vendors.length);
    elements.topDemand.textContent = popular[0]?.[0] || getCopy("None", "Babu");
    renderRankList(elements.popularSearches, popular, getCopy("No searches yet.", "Babu bincike tukuna."));
    renderRankList(
      elements.failedSearchList,
      failedPopular,
      getCopy("No failed searches yet.", "Babu binciken da ya gaza tukuna.")
    );
    renderDemandTrends(history);
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

  // src/cart.ts
  function getCartItems() {
    return getStoredList(storageKeys.cart);
  }
  function getCartProduct(productId) {
    return products.find((p) => p.id === productId);
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
    const items = getCartItems();
    const existing = items.find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ productId, quantity: 1, addedAt: (/* @__PURE__ */ new Date()).toISOString() });
    }
    setStoredList(storageKeys.cart, items);
    syncCart();
    const product = getCartProduct(productId);
    if (product) {
      showToast({ message: getCopy(`Added: ${product.name.en}`, `An saka: ${product.name.ha}`) });
    }
  }
  function updateQuantity(productId, delta) {
    const items = getCartItems();
    const item = items.find((i) => i.productId === productId);
    if (!item) return;
    item.quantity = Math.max(0, item.quantity + delta);
    const updated = items.filter((i) => i.quantity > 0);
    setStoredList(storageKeys.cart, updated);
    syncCart();
  }
  function removeFromCart(productId) {
    const items = getCartItems().filter((i) => i.productId !== productId);
    setStoredList(storageKeys.cart, items);
    syncCart();
  }
  function clearCart() {
    setStoredList(storageKeys.cart, []);
    syncCart();
  }
  function syncCart() {
    const count = getCartCount();
    state.cartCount = count;
    elements.cartCountEl.textContent = String(count);
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
      storageKeys.cart,
      storageKeys.orders,
      storageKeys.reviews,
      storageKeys.wishlist
    ].forEach((key) => localStorage.removeItem(key));
    state.cartCount = 0;
    elements.cartCountEl.textContent = "0";
    syncCart();
    syncWishlistCount();
    renderAdminDashboard();
  }

  // src/orders.ts
  function getOrders() {
    return getStoredList(storageKeys.orders);
  }
  function getUserOrders() {
    const user = state.currentUser;
    if (!user) return [];
    return getOrders().filter((o) => o.customerPhone === user.phone);
  }
  function placeOrder(customerName, customerPhone, deliveryArea, paymentMethod) {
    const cartItems = getCartItems();
    if (cartItems.length === 0) return null;
    const orderItems = cartItems.map((item) => {
      const product = getCartProduct(item.productId);
      return {
        productId: item.productId,
        quantity: item.quantity,
        name: product?.name.en ?? item.productId,
        price: product?.price ?? "NGN 0",
        priceValue: product ? parsePrice(product.price) : 0
      };
    });
    const order = {
      id: `KM-${Date.now().toString().slice(-6)}`,
      items: orderItems,
      customerName,
      customerPhone,
      deliveryArea,
      paymentMethod,
      subtotal: getCartSubtotal(),
      status: "placed",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const orders = getOrders();
    orders.unshift(order);
    setStoredList(storageKeys.orders, orders);
    clearCart();
    showToast({
      message: getCopy(`Order ${order.id} placed!`, `An sanya oda ${order.id}!`),
      duration: 4e3
    });
    return order;
  }
  function renderOrderStatusBadge(status) {
    const label = escapeHtml(getLocalizedValue(orderStatusLabels[status] ?? { en: status, ha: status }));
    return `<span class="order-status order-status-${status}">${label}</span>`;
  }
  function renderOrderTimeline(order) {
    const steps = ["placed", "confirmed", "packed", "dispatched", "delivered"];
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
    const orders = getUserOrders();
    if (orders.length === 0) {
      return `<p class="muted">${getCopy("No orders yet.", "Babu oda tukuna.")}</p>`;
    }
    return orders.slice(0, 10).map((order) => {
      const itemSummary = order.items.map((i) => `${escapeHtml(i.name)} \xD7${i.quantity}`).join(", ");
      return `
        <div class="order-card">
          <div class="order-card-header">
            <strong>${escapeHtml(order.id)}</strong>
            ${renderOrderStatusBadge(order.status)}
          </div>
          <p class="order-items">${itemSummary}</p>
          <div class="order-meta">
            <span>${escapeHtml(formatPrice(order.subtotal))}</span>
            <span>${escapeHtml(formatDate(order.createdAt))}</span>
          </div>
          ${renderOrderTimeline(order)}
        </div>
      `;
    }).join("");
  }

  // src/checkout.ts
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
          <div class="checkout-total">
            <strong>${getCopy("Total", "Jimla")}</strong>
            <strong>${escapeHtml(formatPrice(subtotal))}</strong>
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
            <span>${getCopy("Delivery area", "Yankin isarwa")}</span>
            <input type="text" name="deliveryArea" required
              placeholder="${getCopy("e.g. Sabon Gari, Tarauni", "misali Sabon Gari, Tarauni")}" />
          </label>
          <label>
            <span>${getCopy("Payment method", "Hanyar biya")}</span>
            <select name="paymentMethod" required>
              <option value="" disabled selected>${getCopy("Choose", "Zaba")}</option>
              <option value="card">${getCopy("Card payment", "Biyan kati")}</option>
              <option value="transfer">${getCopy("Bank transfer", "Tura kudi ta banki")}</option>
              <option value="ussd">${getCopy("USSD", "USSD")}</option>
              <option value="wallet">${getCopy("Wallet", "Aljihun kudi")}</option>
              <option value="delivery">${getCopy("Pay on delivery", "Biya idan an kawo")}</option>
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
      e.preventDefault();
      const form = e.target;
      const data = new FormData(form);
      const errorEl = modal.querySelector("#checkoutError");
      const order = placeOrder(
        String(data.get("customerName") || ""),
        String(data.get("customerPhone") || ""),
        String(data.get("deliveryArea") || ""),
        String(data.get("paymentMethod") || "")
      );
      if (!order) {
        errorEl.textContent = getCopy("Cart is empty.", "Kwandona a fanko.");
        return;
      }
      modal.querySelector("#checkoutFormView").hidden = true;
      const successView = modal.querySelector("#checkoutSuccessView");
      successView.hidden = false;
      modal.querySelector("#checkoutOrderId").textContent = getCopy(`Order ID: ${order.id}`, `Lambar oda: ${order.id}`);
    });
    modal.querySelector(".checkout-done")?.addEventListener("click", () => closeCheckoutModal());
  }
  function closeCheckoutModal() {
    const modal = document.getElementById("checkoutModal");
    if (!modal) return;
    modal.classList.remove("modal-visible");
    modal.addEventListener("transitionend", () => modal.remove(), { once: true });
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
            <span>${escapeHtml(subcategory)}</span>
          </div>

          <div class="product-modal-meta">
            <p class="product-meta">
              <span>${escapeHtml(product.category[state.language])}</span>
              <span>${escapeHtml(product.vendor)}</span>
              <span>${escapeHtml(product.area)}</span>
            </p>
            <p class="availability">${escapeHtml(availability)}</p>
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
    const product = products.find((p) => p.id === productId);
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
    modal.querySelector("#modalAddToCart")?.addEventListener("click", () => {
      addToCart(productId);
      const btn = modal.querySelector("#modalAddToCart");
      btn.textContent = getCopy("Added!", "An saka!");
      window.setTimeout(() => {
        btn.textContent = getCopy("Add to cart", "Saka a kwando");
      }, 1400);
    });
    modal.querySelector("#modalWishlist")?.addEventListener("click", () => {
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

  // src/auth.ts
  var MOCK_OTP = "123456";
  function saveSession(session) {
    state.currentUser = session;
    localStorage.setItem(storageKeys.session, JSON.stringify(session));
    syncUserButton();
  }
  function signOut() {
    state.currentUser = null;
    localStorage.removeItem(storageKeys.session);
    syncUserButton();
    closeUserPanel();
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
            <span>${getCopy("Phone number", "Lambar waya")}</span>
            <input type="tel" id="authPhone" name="phone" placeholder="08012345678"
              pattern="^(\\+234|0)[7-9][0-1]\\d{8}$" required autocomplete="tel" />
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
          <label>
            <span>${getCopy("Your name (optional)", "Sunanka (za\u0253i ne)")}</span>
            <input type="text" id="authName" name="name" autocomplete="name" />
          </label>
          <button type="submit">${getCopy("Verify", "Tabbatar")}</button>
          <p class="form-message" id="authOtpError" role="alert"></p>
        </form>
        <button type="button" class="link-button" id="authBack">${getCopy("\u2190 Change number", "\u2190 Canza lambar")}</button>
      </div>
    </div>
  `;
    return el;
  }
  function openAuthModal() {
    const existing = document.getElementById("authModal");
    if (existing) {
      existing.hidden = false;
      return;
    }
    const modal = buildAuthModal();
    document.body.appendChild(modal);
    wireAuthModal(modal);
    requestAnimationFrame(() => modal.classList.add("modal-visible"));
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
    let pendingPhone = "";
    phoneForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const phone = (modal.querySelector("#authPhone")?.value || "").trim();
      if (!phone) return;
      pendingPhone = phone;
      otpHint.textContent = getCopy(
        `A demo code has been sent to ${phone}. Use: ${MOCK_OTP}`,
        `An aika lambar gwaji zuwa ${phone}. Yi amfani da: ${MOCK_OTP}`
      );
      phonePhase.hidden = true;
      otpPhase.hidden = false;
      modal.querySelector("#authOtp")?.focus();
    });
    otpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const otp = (modal.querySelector("#authOtp")?.value || "").trim();
      const name = (modal.querySelector("#authName")?.value || "").trim();
      if (otp !== MOCK_OTP) {
        otpError.textContent = getCopy("Invalid code. Try: 123456", "Lambar ba daidai ba. Gwada: 123456");
        return;
      }
      otpError.textContent = "";
      saveSession({ phone: pendingPhone, name: name || pendingPhone, createdAt: (/* @__PURE__ */ new Date()).toISOString() });
      closeAuthModal();
      showToast({ message: getCopy("Signed in successfully!", "An shiga cikin nasara!") });
    });
    modal.querySelector("#authBack")?.addEventListener("click", () => {
      phonePhase.hidden = false;
      otpPhase.hidden = true;
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
        <p><strong>${escapeHtml(user.name)}</strong> \xB7 ${escapeHtml(user.phone)}</p>
        <button type="button" class="link-button" id="signOutBtn">${getCopy("Sign out", "Fita")}</button>
      </div>
      <h3>${getCopy("My orders", "Odana")}</h3>
      <div id="userOrdersList">${renderOrdersPanel()}</div>
    </div>
  `;
    return el;
  }
  function openUserPanel() {
    if (!state.currentUser) {
      openAuthModal();
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
    panel.querySelector(".modal-close")?.addEventListener("click", closeUserPanel);
    panel.addEventListener("click", (e) => {
      if (e.target === panel) closeUserPanel();
    });
    panel.querySelector("#signOutBtn")?.addEventListener("click", signOut);
  }
  function closeUserPanel() {
    const panel = document.getElementById("userPanel");
    if (!panel) return;
    panel.classList.remove("modal-visible");
    panel.addEventListener("transitionend", () => panel.remove(), { once: true });
  }

  // src/admin-gate.ts
  function isAdminUnlocked() {
    return state.adminAuthenticated;
  }
  function unlockAdmin(pin) {
    if (pin !== ADMIN_PIN) return false;
    state.adminAuthenticated = true;
    localStorage.setItem(storageKeys.adminSession, (/* @__PURE__ */ new Date()).toISOString());
    renderAdminGate();
    return true;
  }
  function renderAdminGate() {
    if (isAdminUnlocked()) {
      elements.adminGate.hidden = true;
      elements.adminContent.hidden = false;
    } else {
      elements.adminGate.hidden = false;
      elements.adminContent.hidden = true;
      elements.adminPinError.textContent = "";
    }
  }
  function handlePinSubmit(pin) {
    const ok = unlockAdmin(pin);
    if (!ok) {
      elements.adminPinError.textContent = getCopy("Incorrect PIN.", "PIN ba daidai ba.");
      showToast({ message: getCopy("Incorrect PIN.", "PIN ba daidai ba."), type: "error" });
    } else {
      showToast({ message: getCopy("Admin unlocked.", "An bu\u0257e admin.") });
    }
  }

  // src/app.ts
  function performSearch(rawQuery) {
    const query = rawQuery.trim();
    if (!query) return;
    const results = getSearchResults(query);
    saveSearch(query, results);
    state.lastQuery = query;
    state.lastResults = results;
    updateResultCopy(query, results);
    elements.resultsGrid.innerHTML = results.map(renderProductCard).join("");
    elements.emptyState.hidden = results.length > 0;
    syncAllWishlistButtons();
    document.querySelector("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    renderAdminDashboard();
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
    if (state.lastQuery) {
      state.lastResults = getSearchResults(state.lastQuery);
      updateResultCopy(state.lastQuery, state.lastResults);
      elements.resultsGrid.innerHTML = state.lastResults.map(renderProductCard).join("");
      elements.emptyState.hidden = state.lastResults.length > 0;
      syncAllWishlistButtons();
    } else {
      elements.resultsTitle.textContent = getCopy("Welcome to Kano Mart", "Barka da zuwa Kano Mart");
      elements.resultsIntro.textContent = getCopy(
        "Search for an item to see local results. Every completed search helps Kano Mart understand demand.",
        "Nemi kaya domin ganin sakamako. Kowane bincike yana taimakawa Kano Mart fahimtar bukatun mutane."
      );
    }
    syncUserButton();
    renderAdminDashboard();
  }
  function saveVendorRequest(event) {
    event.preventDefault();
    const formData = new FormData(elements.vendorForm);
    const vendors = getStoredList(storageKeys.vendors);
    vendors.unshift({
      id: createId(),
      businessName: String(formData.get("businessName") || ""),
      phone: String(formData.get("phone") || ""),
      area: String(formData.get("area") || ""),
      category: String(formData.get("category") || ""),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    setStoredList(storageKeys.vendors, vendors);
    elements.vendorForm.reset();
    elements.vendorMessage.textContent = getCopy(
      "Vendor request saved for admin review.",
      "An ajiye bukatar rajista domin admin ya duba."
    );
    renderAdminDashboard();
  }
  elements.searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performSearch(elements.searchInput.value);
  });
  elements.quickSearches.addEventListener("click", (event) => {
    const button = event.target?.closest("[data-query-en][data-query-ha]");
    if (!button) return;
    const query = button.dataset[state.language === "ha" ? "queryHa" : "queryEn"] || "";
    elements.searchInput.value = query;
    performSearch(query);
  });
  elements.resultsGrid.addEventListener("click", (event) => {
    const target = event.target;
    const wishBtn = target?.closest("[data-wishlist]");
    if (wishBtn) {
      const id = wishBtn.dataset.wishlist;
      const product = state.lastResults.find((p) => p.id === id);
      toggleWishlist(id, product?.name[state.language] ?? id);
      syncWishlistCount();
      return;
    }
    const addBtn = target?.closest("[data-add-to-cart]");
    if (addBtn) {
      addToCart(addBtn.dataset.addToCart);
      elements.cartCountEl.textContent = String(state.cartCount);
      addBtn.textContent = getCopy("Added", "An saka");
      window.setTimeout(() => {
        addBtn.textContent = getCopy("Add", "Saka");
      }, 1200);
      return;
    }
    const card = target?.closest(".product-card");
    if (card?.dataset.productId) {
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
  document.querySelector(".cart-button")?.addEventListener("click", () => {
    renderCartPanel();
    openCart();
  });
  elements.cartOverlay.addEventListener("click", closeCart);
  document.querySelector(".cart-close")?.addEventListener("click", closeCart);
  elements.checkoutButton.addEventListener("click", () => {
    closeCart();
    openCheckoutModal();
  });
  elements.languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language === "ha" ? "ha" : "en"));
  });
  elements.vendorForm.addEventListener("submit", saveVendorRequest);
  elements.exportSearches.addEventListener("click", exportSearchHistory);
  elements.clearSearches.addEventListener("click", clearPrototypeData);
  elements.adminPinForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const pin = elements.adminPinForm.querySelector("input[name='pin']")?.value || "";
    handlePinSubmit(pin);
    elements.adminPinForm.reset();
  });
  elements.userButton.addEventListener("click", openUserPanel);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCart();
  });
  syncCart();
  syncWishlistCount();
  setLanguage(state.language);
  syncUserButton();
  renderAdminGate();
  renderAdminDashboard();
})();
