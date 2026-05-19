"use strict";
(() => {
  // src/data.ts
  var storageKeys = {
    searches: "kanoMart.searchHistory",
    vendors: "kanoMart.vendorRequests",
    cart: "kanoMart.cartCount",
    language: "kanoMart.language"
  };
  var categoryLabels = {
    food: { en: "Food", ha: "Abinci" },
    fashion: { en: "Fashion", ha: "Kaya" },
    children: { en: "Children", ha: "Yara" },
    essentials: { en: "Essentials", ha: "Kayan yau da kullum" },
    "unmatched demand": { en: "Unmatched demand", ha: "Bukatar da ba a daidaita ba" }
  };
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
  var state = {
    language: savedLanguage === "ha" ? "ha" : "en",
    cartCount: Number(localStorage.getItem(storageKeys.cart) || 0),
    lastQuery: "",
    lastResults: []
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
    cartCount: document.querySelector("[data-cart-count]"),
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
    clearSearches: document.querySelector("#clearSearches")
  };

  // src/utils.ts
  function escapeHtml(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }
  function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
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
  function getSearchResults(query) {
    const cleanQuery = normalize(query);
    const terms = cleanQuery.split(" ").filter(Boolean);
    return products.filter((product) => {
      const text = getProductText(product);
      return text.includes(cleanQuery) || terms.some((term) => text.includes(term));
    });
  }
  var demandDictionary = [
    { category: "food", terms: ["food", "abinci", "rice", "shinkafa", "tuwo", "snack", "groceries"] },
    { category: "fashion", terms: ["fashion", "kaya", "yaduka", "shoe", "takalma", "turare", "perfume"] },
    { category: "children", terms: ["children", "yara", "school", "makaranta", "book", "littafi", "bag"] }
  ];
  function inferDemandCategory(query, results) {
    if (results.length > 0) {
      return results[0].category.en.toLowerCase();
    }
    const value = normalize(query);
    const match = demandDictionary.find((entry) => entry.terms.some((term) => value.includes(term)));
    return match ? match.category : "unmatched demand";
  }
  function saveSearch(query, results) {
    const history = getStoredList(storageKeys.searches);
    const record = {
      id: createId(),
      query,
      language: state.language,
      resultCount: results.length,
      category: inferDemandCategory(query, results),
      status: results.length > 0 ? "matched" : "saved demand",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    history.unshift(record);
    setStoredList(storageKeys.searches, history.slice(0, 100));
  }

  // src/render.ts
  function renderProductCard(product) {
    const primaryName = product.name[state.language];
    const category = product.category[state.language];
    const subcategory = product.subcategory[state.language];
    const availability = product.availability[state.language];
    return `
    <article class="product-card">
      <div class="product-thumb" style="--accent: ${product.accent}">
        <span>${escapeHtml(subcategory)}</span>
      </div>
      <h3>${escapeHtml(primaryName)}</h3>
      <p class="product-meta">
        <span>${escapeHtml(category)}</span>
        <span>${escapeHtml(product.vendor)}</span>
        <span>${escapeHtml(product.area)}</span>
      </p>
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
        "Clear saved prototype search and vendor data?",
        "A goge bayanan bincike da dillalai na gwaji?"
      )
    );
    if (!ok) return;
    localStorage.removeItem(storageKeys.searches);
    localStorage.removeItem(storageKeys.vendors);
    localStorage.removeItem(storageKeys.cart);
    state.cartCount = 0;
    localStorage.setItem(storageKeys.cart, "0");
    elements.cartCount.textContent = "0";
    renderAdminDashboard();
  }

  // src/app.ts
  function updateCartCount(nextCount) {
    state.cartCount = nextCount;
    localStorage.setItem(storageKeys.cart, String(nextCount));
    elements.cartCount.textContent = String(nextCount);
  }
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
    } else {
      elements.resultsTitle.textContent = getCopy("Welcome to Kano Mart", "Barka da zuwa Kano Mart");
      elements.resultsIntro.textContent = getCopy(
        "Search for an item to see local results. Every completed search helps Kano Mart understand demand.",
        "Nemi kaya domin ganin sakamako. Kowane bincike yana taimakawa Kano Mart fahimtar bukatun mutane."
      );
    }
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
    const button = event.target?.closest("[data-add-to-cart]");
    if (!button) return;
    updateCartCount(state.cartCount + 1);
    button.textContent = getCopy("Added", "An saka");
    window.setTimeout(() => {
      button.textContent = getCopy("Add", "Saka");
    }, 1200);
  });
  elements.languageButtons.forEach((button) => {
    button.addEventListener("click", () => setLanguage(button.dataset.language === "ha" ? "ha" : "en"));
  });
  elements.vendorForm.addEventListener("submit", saveVendorRequest);
  elements.exportSearches.addEventListener("click", exportSearchHistory);
  elements.clearSearches.addEventListener("click", clearPrototypeData);
  updateCartCount(state.cartCount);
  setLanguage(state.language);
  renderAdminDashboard();
})();
