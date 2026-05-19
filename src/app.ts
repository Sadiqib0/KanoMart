import type { Language, VendorRequest } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { state, elements } from "./state";
import { getCopy, setActiveLanguageButtons } from "./utils";
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
import { toggleWishlist, syncWishlistCount, syncAllWishlistButtons } from "./wishlist";
import { openUserPanel, syncUserButton } from "./auth";
import { renderAdminGate, handlePinSubmit } from "./admin-gate";

// — Search —

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
  syncAllWishlistButtons();
  document.querySelector<HTMLElement>("#results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  renderAdminDashboard();
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

// — Vendor form —

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

// Product grid: delegated events for wish, add-to-cart, and card click → modal
elements.resultsGrid.addEventListener("click", (event) => {
  const target = event.target as Element | null;

  const wishBtn = target?.closest<HTMLButtonElement>("[data-wishlist]");
  if (wishBtn) {
    const id = wishBtn.dataset.wishlist!;
    const product = state.lastResults.find((p) => p.id === id);
    toggleWishlist(id, product?.name[state.language] ?? id);
    syncWishlistCount();
    return;
  }

  const addBtn = target?.closest<HTMLButtonElement>("[data-add-to-cart]");
  if (addBtn) {
    addToCart(addBtn.dataset.addToCart!);
    elements.cartCountEl.textContent = String(state.cartCount);
    addBtn.textContent = getCopy("Added", "An saka");
    window.setTimeout(() => { addBtn.textContent = getCopy("Add", "Saka"); }, 1200);
    return;
  }

  const card = target?.closest<HTMLElement>(".product-card");
  if (card?.dataset.productId) {
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
document.querySelector<HTMLElement>(".cart-button")?.addEventListener("click", () => {
  renderCartPanel();
  openCart();
});
elements.cartOverlay.addEventListener("click", closeCart);
document.querySelector<HTMLButtonElement>(".cart-close")?.addEventListener("click", closeCart);
elements.checkoutButton.addEventListener("click", () => {
  closeCart();
  openCheckoutModal();
});

// Language toggle
elements.languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language === "ha" ? "ha" : "en"));
});

// Vendor form
elements.vendorForm.addEventListener("submit", saveVendorRequest);

// Admin
elements.exportSearches.addEventListener("click", exportSearchHistory);
elements.clearSearches.addEventListener("click", clearPrototypeData);
elements.adminPinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const pin = elements.adminPinForm.querySelector<HTMLInputElement>("input[name='pin']")?.value || "";
  handlePinSubmit(pin);
  elements.adminPinForm.reset();
});

// User / auth
elements.userButton.addEventListener("click", openUserPanel);

// Global Escape key closes cart
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCart();
});

// — Init —
syncCart();
syncWishlistCount();
setLanguage(state.language);
syncUserButton();
renderAdminGate();
renderAdminDashboard();
