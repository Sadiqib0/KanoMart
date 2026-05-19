import type { AppState, UserSession } from "./types";
import { storageKeys } from "./data";

const savedLanguage = localStorage.getItem(storageKeys.language);
const savedSession = localStorage.getItem(storageKeys.session);
const savedAdminSession = localStorage.getItem(storageKeys.adminSession);

function loadSession(): UserSession | null {
  try {
    return savedSession ? (JSON.parse(savedSession) as UserSession) : null;
  } catch {
    return null;
  }
}

export const state: AppState = {
  language: savedLanguage === "ha" ? "ha" : "en",
  cartCount: 0,
  lastQuery: "",
  lastResults: [],
  currentUser: loadSession(),
  adminAuthenticated: !!savedAdminSession,
};

export const elements = {
  searchForm: document.querySelector<HTMLFormElement>("#searchForm")!,
  searchInput: document.querySelector<HTMLInputElement>("#marketSearch")!,
  resultsGrid: document.querySelector<HTMLElement>("#resultsGrid")!,
  resultsTitle: document.querySelector<HTMLElement>("#resultsTitle")!,
  resultsIntro: document.querySelector<HTMLElement>("#resultsIntro")!,
  resultStatus: document.querySelector<HTMLElement>("#resultStatus")!,
  emptyState: document.querySelector<HTMLElement>("#emptyState")!,
  quickSearches: document.querySelector<HTMLElement>(".quick-searches")!,
  languageButtons: document.querySelectorAll<HTMLButtonElement>("[data-language]"),
  cartCountEl: document.querySelector<HTMLElement>("[data-cart-count]")!,
  wishlistCountEl: document.querySelector<HTMLElement>("[data-wishlist-count]")!,
  cartPanel: document.querySelector<HTMLElement>("#cartPanel")!,
  cartOverlay: document.querySelector<HTMLElement>("#cartOverlay")!,
  cartItemsEl: document.querySelector<HTMLElement>("#cartItems")!,
  cartSubtotal: document.querySelector<HTMLElement>("#cartSubtotal")!,
  cartEmptyState: document.querySelector<HTMLElement>("#cartEmptyState")!,
  checkoutButton: document.querySelector<HTMLButtonElement>("#checkoutButton")!,
  vendorForm: document.querySelector<HTMLFormElement>("#vendorForm")!,
  vendorMessage: document.querySelector<HTMLElement>("#vendorMessage")!,
  totalSearches: document.querySelector<HTMLElement>("#totalSearches")!,
  failedSearches: document.querySelector<HTMLElement>("#failedSearches")!,
  savedVendors: document.querySelector<HTMLElement>("#savedVendors")!,
  topDemand: document.querySelector<HTMLElement>("#topDemand")!,
  popularSearches: document.querySelector<HTMLElement>("#popularSearches")!,
  failedSearchList: document.querySelector<HTMLElement>("#failedSearchList")!,
  demandTrends: document.querySelector<HTMLElement>("#demandTrends")!,
  vendorPerformance: document.querySelector<HTMLElement>("#vendorPerformance")!,
  orderRecords: document.querySelector<HTMLElement>("#orderRecords")!,
  paymentStatus: document.querySelector<HTMLElement>("#paymentStatus")!,
  searchHistoryTable: document.querySelector<HTMLElement>("#searchHistoryTable")!,
  exportSearches: document.querySelector<HTMLButtonElement>("#exportSearches")!,
  clearSearches: document.querySelector<HTMLButtonElement>("#clearSearches")!,
  adminGate: document.querySelector<HTMLElement>("#adminGate")!,
  adminContent: document.querySelector<HTMLElement>("#adminContent")!,
  adminPinForm: document.querySelector<HTMLFormElement>("#adminPinForm")!,
  adminPinError: document.querySelector<HTMLElement>("#adminPinError")!,
  userButton: document.querySelector<HTMLButtonElement>("#userButton")!,
  userButtonLabel: document.querySelector<HTMLElement>("#userButtonLabel")!,
  toastContainer: document.querySelector<HTMLElement>("#toastContainer")!,
};
