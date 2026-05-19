import type { Language } from "./types";
import type { VendorRequest } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { state, elements } from "./state";
import { getCopy, setActiveLanguageButtons } from "./utils";
import { getSearchResults, saveSearch } from "./search";
import { renderProductCard, updateResultCopy, renderAdminDashboard } from "./render";
import { exportSearchHistory, clearPrototypeData } from "./admin";

function updateCartCount(nextCount: number): void {
  state.cartCount = nextCount;
  localStorage.setItem(storageKeys.cart, String(nextCount));
  elements.cartCount.textContent = String(nextCount);
}

function performSearch(rawQuery: string): void {
  const query = rawQuery.trim();
  if (!query) return;

  const results = getSearchResults(query);
  saveSearch(query, results);
  state.lastQuery = query;
  state.lastResults = results;

  updateResultCopy(query, results);
  elements.resultsGrid.innerHTML = results.map(renderProductCard).join("");
  elements.emptyState.hidden = results.length > 0;
  document.querySelector<HTMLElement>("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderAdminDashboard();
}

function setLanguage(language: Language): void {
  state.language = language;
  localStorage.setItem(storageKeys.language, language);
  document.documentElement.lang = language;
  document.title = getCopy(
    "Kano Mart | Local Marketplace for Kano",
    "Kano Mart | Kasuwar Kano ta yanar gizo"
  );

  document.querySelectorAll<HTMLElement>("[data-en][data-ha]").forEach((node) => {
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

function saveVendorRequest(event: SubmitEvent): void {
  event.preventDefault();
  const formData = new FormData(elements.vendorForm);
  const vendors = getStoredList<VendorRequest>(storageKeys.vendors);
  vendors.unshift({
    id: createId(),
    businessName: String(formData.get("businessName") || ""),
    phone: String(formData.get("phone") || ""),
    area: String(formData.get("area") || ""),
    category: String(formData.get("category") || ""),
    createdAt: new Date().toISOString(),
  });

  setStoredList(storageKeys.vendors, vendors);
  elements.vendorForm.reset();
  elements.vendorMessage.textContent = getCopy(
    "Vendor request saved for admin review.",
    "An ajiye bukatar rajista domin admin ya duba."
  );
  renderAdminDashboard();
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
  performSearch(query);
});

elements.resultsGrid.addEventListener("click", (event) => {
  const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-add-to-cart]");
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

// — Init —
updateCartCount(state.cartCount);
setLanguage(state.language);
renderAdminDashboard();
