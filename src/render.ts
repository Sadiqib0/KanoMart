import type { Product, SearchRecord, VendorRequest } from "./types";
import { demoOrders, demoPayments, storageKeys } from "./data";
import { getStoredList } from "./storage";
import { state, elements } from "./state";
import {
  escapeHtml,
  getCopy,
  getLocalizedValue,
  localizeCategory,
  formatDate,
  groupByValue,
  sortEntries,
} from "./utils";
import { isWishlisted } from "./wishlist";
import { getAverageRating, getProductReviews } from "./reviews";
import { renderStars } from "./utils";

export function renderProductCard(product: Product): string {
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

export function updateResultCopy(query: string, results: Product[]): void {
  elements.resultsTitle.textContent = getCopy("Search results", "Sakamakon bincike");
  elements.resultsIntro.textContent = getCopy(
    `Results related to "${query}" from trusted local vendors.`,
    `Sakamakon da ya shafi "${query}" daga amintattun dillalai.`
  );
  elements.resultStatus.hidden = false;
  elements.resultStatus.textContent =
    results.length === 0
      ? getCopy("No result found. Search saved for Kano Mart.", "Ba a samu sakamako ba. An ajiye binciken.")
      : getCopy(
          `${results.length} result${results.length === 1 ? "" : "s"} found`,
          `An samu sakamako ${results.length}`
        );
}

export function renderRankList(
  container: HTMLElement,
  entries: Array<[string, number]>,
  emptyText: string
): void {
  if (entries.length === 0) {
    container.innerHTML = `<p class="muted">${escapeHtml(emptyText)}</p>`;
    return;
  }
  container.innerHTML = entries
    .slice(0, 5)
    .map(
      ([label, count]) =>
        `<div class="rank-row"><strong>${escapeHtml(label)}</strong><span>${count}</span></div>`
    )
    .join("");
}

export function renderDemandTrends(history: SearchRecord[]): void {
  const entries = sortEntries(groupByValue(history, (item) => item.category));
  const max = entries[0]?.[1] || 1;

  if (entries.length === 0) {
    elements.demandTrends.innerHTML = `<p class="muted">${getCopy("No trends yet.", "Babu yanayi tukuna.")}</p>`;
    return;
  }

  elements.demandTrends.innerHTML = entries
    .slice(0, 6)
    .map(([label, count]) => {
      const width = Math.max(10, Math.round((count / max) * 100));
      return `
        <div class="trend-row">
          <div class="trend-label"><strong>${escapeHtml(localizeCategory(label))}</strong><span>${count}</span></div>
          <div class="trend-track"><span class="trend-fill" style="width: ${width}%"></span></div>
        </div>
      `;
    })
    .join("");
}

export function renderRecords(history: SearchRecord[], vendors: VendorRequest[]): void {
  const vendorRows = vendors.slice(0, 3).map((vendor) => ({
    label: vendor.businessName,
    value: `${localizeCategory(vendor.category)} — ${vendor.area}`,
  }));

  const defaultVendors = [
    { label: "Hajiya Ladi Kitchen", value: { en: "96% fulfilled orders", ha: "An cika oda 96%" } },
    { label: "Kantin Kwari Textiles", value: { en: "Fast stock updates", ha: "Saurin sabunta kaya" } },
    { label: "Back To School Kano", value: { en: "High school demand", ha: "Bukatar makaranta ta yi yawa" } },
  ];

  elements.vendorPerformance.innerHTML = [...vendorRows, ...defaultVendors]
    .slice(0, 4)
    .map(
      (row) =>
        `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(getLocalizedValue(row.value))}</span></div>`
    )
    .join("");

  elements.orderRecords.innerHTML = demoOrders
    .map(
      (order) =>
        `<div class="record-row"><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(getLocalizedValue(order.status))}</span></div>`
    )
    .join("");

  elements.paymentStatus.innerHTML = demoPayments
    .map(
      (payment) =>
        `<div class="record-row"><strong>${escapeHtml(getLocalizedValue(payment.label))}</strong><span>${escapeHtml(getLocalizedValue(payment.value))}</span></div>`
    )
    .join("");
}

export function renderAdminDashboard(): void {
  const history = getStoredList<SearchRecord>(storageKeys.searches);
  const vendors = getStoredList<VendorRequest>(storageKeys.vendors);
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

  elements.searchHistoryTable.innerHTML =
    history.length === 0
      ? `<tr><td colspan="5">${getCopy("No search history yet.", "Babu tarihin bincike tukuna.")}</td></tr>`
      : history
          .slice(0, 20)
          .map((item) => {
            const failedClass = item.resultCount === 0 ? " failed" : "";
            const status =
              item.resultCount === 0
                ? getCopy("Saved demand", "An ajiye bukata")
                : getCopy("Matched", "An samu");
            return `
              <tr>
                <td>${escapeHtml(item.query)}</td>
                <td>${item.resultCount}</td>
                <td>${escapeHtml(localizeCategory(item.category))}</td>
                <td><span class="status-pill${failedClass}">${escapeHtml(status)}</span></td>
                <td>${escapeHtml(formatDate(item.createdAt))}</td>
              </tr>
            `;
          })
          .join("");
}
