import type { SearchRecord } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList } from "./storage";
import { state, elements } from "./state";
import { getCopy } from "./utils";
import { renderAdminDashboard } from "./render";

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
