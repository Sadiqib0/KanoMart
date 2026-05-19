import type { AppState } from "./types";
import { storageKeys } from "./data";

const savedLanguage = localStorage.getItem(storageKeys.language);

export const state: AppState = {
  language: savedLanguage === "ha" ? "ha" : "en",
  cartCount: Number(localStorage.getItem(storageKeys.cart) || 0),
  lastQuery: "",
  lastResults: [],
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
  cartCount: document.querySelector<HTMLElement>("[data-cart-count]")!,
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
};
