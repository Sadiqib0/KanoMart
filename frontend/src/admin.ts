import type { SearchRecord } from "../backend/types";
import { storageKeys } from "../backend/data";
import { getStoredList } from "../backend/storage";
import { state, elements } from "./state";
import { getCopy } from "./utils";
import { renderAdminDashboard } from "./render";
import { syncCart } from "./cart";
import { syncWishlistCount } from "./wishlist";

export function exportSearchHistory(): void {
  const history = getStoredList<SearchRecord>(storageKeys.searches);

  if (history.length === 0) {
    alert(getCopy("No search history to export.", "Babu tarihin bincike da za a fitar."));
    return;
  }

  const rows: Array<Array<string | number>> = [
    ["Query", "Language", "Results", "Category", "Status", "Time"],
    ...history.map((item) => [
      item.query,
      item.language,
      item.resultCount,
      item.category,
      item.status,
      item.createdAt,
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kano-mart-search-history.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function clearPrototypeData(): void {
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
    storageKeys.adminSession,
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
