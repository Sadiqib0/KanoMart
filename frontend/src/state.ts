import type { AppState, UserSession } from "../backend/types";
import { storageKeys } from "../backend/data";
import { migrateSession } from "../backend/users";

const savedLanguage = localStorage.getItem(storageKeys.language);
const savedSession = localStorage.getItem(storageKeys.session);
const savedAdminSession = localStorage.getItem(storageKeys.adminSession);

function loadSession(): UserSession | null {
  try {
    const parsed = savedSession ? (JSON.parse(savedSession) as Partial<UserSession>) : null;
    if (!parsed?.phone) return null;
    // API-issued sessions carry a token and role — restore them verbatim.
    // migrateSession() re-derives the role from legacy localStorage profiles,
    // which demotes API vendors/admins to "customer" and drops the token.
    if (parsed.token && parsed.role) return parsed as UserSession;
    return migrateSession(parsed);
  } catch {
    return null;
  }
}

export const state: AppState = {
  language: savedLanguage === "ha" ? "ha" : "en",
  cartCount: 0,
  lastQuery: "",
  lastResults: [],
  visibleProductCount: 8,
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
  loadMoreProducts: document.querySelector<HTMLButtonElement>("#loadMoreProducts")!,
  quickSearches: document.querySelector<HTMLElement>(".quick-searches")!,
  languageButtons: document.querySelectorAll<HTMLButtonElement>("[data-language]"),
  appSidebar: document.querySelector<HTMLElement>("#appSidebar")!,
  sidebarOpen: document.querySelector<HTMLButtonElement>("#sidebarOpen")!,
  sidebarClose: document.querySelector<HTMLButtonElement>("#sidebarClose")!,
  sidebarCollapse: document.querySelector<HTMLButtonElement>("#sidebarCollapse")!,
  sidebarOverlay: document.querySelector<HTMLElement>("#sidebarOverlay")!,
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
  vendorApprovals: document.querySelector<HTMLElement>("#vendorApprovals")!,
  productModeration: document.querySelector<HTMLElement>("#productModeration")!,
  withdrawalQueue: document.querySelector<HTMLElement>("#withdrawalQueue")!,
  vendorPerformance: document.querySelector<HTMLElement>("#vendorPerformance")!,
  orderRecords: document.querySelector<HTMLElement>("#orderRecords")!,
  paymentStatus: document.querySelector<HTMLElement>("#paymentStatus")!,
  reviewModeration: document.querySelector<HTMLElement>("#reviewModeration")!,
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
