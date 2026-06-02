import type { Product, SearchRecord, VendorRequest } from "../backend/types";
import { demoOrders, storageKeys } from "../backend/data";
import { getStoredList } from "../backend/storage";
import { state, elements } from "./state";
import {
  escapeHtml,
  getCopy,
  getLocalizedValue,
  localizeCategory,
  formatDate,
  formatPrice,
  groupByValue,
  sortEntries,
} from "./utils";
import { isWishlisted } from "./wishlist";
import { getAllReviews, getAverageRating, getProductReviews } from "./reviews";
import { renderStars } from "./utils";
import { getVendorRequests, getVendorStatusCounts } from "../backend/vendors";
import { getAllProducts, getProductStatus, getProductStatusCounts } from "../backend/products";
import { getPayments, getPaymentSummary } from "../backend/payments";
import { getPlatformCommissionTotal, getVendorWalletSummaries } from "../backend/wallet";
import { getOrders, renderOrderStatusBadge } from "./orders";
import { getWithdrawals } from "../backend/withdrawals";
import { getUserProfiles } from "../backend/users";
import { getPromotionForProduct, getDiscountedPrice, getPromotions } from "../backend/promotions";
import { getMarketplaceAnalytics } from "../backend/analytics";
import { getCommissionSettings, getVendorPlan } from "../backend/marketplace-settings";

export function renderProductCard(product: Product): string {
  const name = product.name[state.language];
  const category = product.category[state.language];
  const subcategory = product.subcategory[state.language];
  const availability = product.availability[state.language];
  const wished = isWishlisted(product.id);
  const avg = getAverageRating(product.id);
  const reviewCount = getProductReviews(product.id).length;
  const promotion = getPromotionForProduct(product);
  const basePrice = Number(product.price.replace(/[^0-9]/g, ""));
  const discountedPrice = getDiscountedPrice(basePrice, promotion);

  return `
    <article class="product-card" data-product-id="${escapeHtml(product.id)}">
      <div class="product-thumb" style="--accent: ${product.accent}">
        ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(name)}" loading="lazy" />` : ""}
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
      ${promotion ? `<span class="promo-badge">${escapeHtml(promotion.title[state.language])}${promotion.discountPercent ? ` - ${promotion.discountPercent}%` : ""}</span>` : ""}
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
      ${product.description?.[state.language] ? `<p>${escapeHtml(product.description[state.language])}</p>` : ""}
      <footer>
        <span class="price">
          ${
            promotion?.discountPercent
              ? `<del>${escapeHtml(product.price)}</del> ${escapeHtml(formatPrice(discountedPrice))}`
              : escapeHtml(product.price)
          }
        </span>
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
  const approvedVendors = vendors.filter((vendor) => (vendor.status ?? "pending") === "approved");
  const wallets = getVendorWalletSummaries();
  const walletRows = wallets.slice(0, 4).map((wallet) => ({
    label: wallet.vendor,
    value: getCopy(
      `${formatPrice(wallet.availableBalance)} available`,
      `${formatPrice(wallet.availableBalance)} akwai`
    ),
  }));
  const vendorRows = approvedVendors.slice(0, 3).map((vendor) => ({
    label: vendor.businessName,
    value: `${localizeCategory(vendor.category)} - ${vendor.area}`,
  }));

  const defaultVendors = [
    { label: "Hajiya Ladi Kitchen", value: { en: "96% fulfilled orders", ha: "An cika oda 96%" } },
    { label: "Kantin Kwari Textiles", value: { en: "Fast stock updates", ha: "Saurin sabunta kaya" } },
    { label: "Back To School Kano", value: { en: "High school demand", ha: "Bukatar makaranta ta yi yawa" } },
  ];

  elements.vendorPerformance.innerHTML = [...walletRows, ...vendorRows, ...defaultVendors]
    .slice(0, 4)
    .map(
      (row) =>
        `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(getLocalizedValue(row.value))}</span></div>`
    )
    .join("");

  const orders = getOrders();
  elements.orderRecords.innerHTML =
    orders.length > 0
      ? orders
          .slice(0, 4)
          .map(
            (order) => {
              const canAdvance = order.status !== "delivered" && order.status !== "cancelled";
              return `
                <div class="order-admin-row">
                  <div>
                    <strong>${escapeHtml(order.id)}</strong>
                    <span>${escapeHtml(`${formatPrice(order.subtotal)} - ${order.paymentStatus}`)}</span>
                  </div>
                  ${renderOrderStatusBadge(order.status)}
                  ${
                    canAdvance
                      ? `<button type="button" data-order-advance="${escapeHtml(order.id)}">${getCopy("Advance", "Ci gaba")}</button>`
                      : `<span class="muted">${getCopy("Settled", "An kammala")}</span>`
                  }
                </div>
              `;
            }
          )
          .join("")
      : demoOrders
          .map(
            (order) =>
              `<div class="record-row"><strong>${escapeHtml(order.id)}</strong><span>${escapeHtml(getLocalizedValue(order.status))}</span></div>`
          )
          .join("");

  const paymentSummary = getPaymentSummary();
  const analytics = getMarketplaceAnalytics();
  const commissionSettings = getCommissionSettings();
  const paymentRows = [
    {
      label: getCopy("Paid volume", "Jimillar da aka biya"),
      value: `${formatPrice(paymentSummary.paidAmount)} - ${paymentSummary.paidCount}`,
    },
    {
      label: getCopy("Pending payment", "Biyan da ke jira"),
      value: `${formatPrice(paymentSummary.pendingAmount)} - ${paymentSummary.pendingCount}`,
    },
    {
      label: getCopy("Failed payment", "Biyan da ya gaza"),
      value: `${formatPrice(paymentSummary.failedAmount)} - ${paymentSummary.failedCount}`,
    },
    {
      label: getCopy("Refunded", "An mayar"),
      value: `${formatPrice(paymentSummary.refundedAmount)} - ${paymentSummary.refundedCount}`,
    },
    {
      label: getCopy("Platform commission", "Ribar dandali"),
      value: formatPrice(getPlatformCommissionTotal()),
    },
  ];
  const paymentActionRows = getPayments()
    .slice(0, 6)
    .map((payment) => {
      const canConfirm = payment.status === "pending" || payment.status === "failed";
      const canFail = payment.status === "pending";
      const canRefund = payment.status === "paid";
      return `
        <div class="payment-admin-row">
          <div>
            <strong>${escapeHtml(payment.reference)}</strong>
            <span>${escapeHtml(`${payment.orderId} - ${payment.method} - ${formatPrice(payment.amount)}`)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(payment.status)}">${escapeHtml(payment.status)}</span>
          <div class="approval-actions">
            ${canConfirm ? `<button type="button" data-payment-action="confirm" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Confirm", "Tabbatar")}</button>` : ""}
            ${canFail ? `<button type="button" class="secondary-action" data-payment-action="fail" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Fail", "Gaza")}</button>` : ""}
            ${canRefund ? `<button type="button" class="secondary-action" data-payment-action="refund" data-payment-id="${escapeHtml(payment.id)}">${getCopy("Refund", "Mayar")}</button>` : ""}
          </div>
        </div>
      `;
    })
    .join("");
  elements.paymentStatus.innerHTML = `
    ${paymentRows
      .map((payment) => `<div class="record-row"><strong>${escapeHtml(payment.label)}</strong><span>${escapeHtml(payment.value)}</span></div>`)
      .join("")}
    ${paymentActionRows || `<p class="muted">${getCopy("No payments yet.", "Babu biya tukuna.")}</p>`}
  `;

  const withdrawals = getWithdrawals();
  elements.withdrawalQueue.innerHTML =
    withdrawals.length > 0
      ? withdrawals
          .slice(0, 4)
          .map((withdrawal) => {
            const canReview = withdrawal.status === "pending";
            return `
              <div class="withdrawal-row">
                <div>
                  <strong>${escapeHtml(withdrawal.vendor)}</strong>
                  <span>${escapeHtml(formatPrice(withdrawal.amount))}</span>
                </div>
                <span class="status-pill status-${escapeHtml(withdrawal.status)}">${escapeHtml(withdrawal.status)}</span>
                ${
                  canReview
                    ? `
                      <div class="approval-actions">
                        <button type="button" data-withdrawal-id="${escapeHtml(withdrawal.id)}" data-withdrawal-action="approved">${getCopy("Approve", "Amince")}</button>
                        <button type="button" class="secondary-action" data-withdrawal-id="${escapeHtml(withdrawal.id)}" data-withdrawal-action="rejected">${getCopy("Reject", "Ki")}</button>
                      </div>
                    `
                    : withdrawal.reviewedAt
                      ? `<small>${escapeHtml(formatDate(withdrawal.reviewedAt))}</small>`
                      : ""
                }
              </div>
            `;
          })
          .join("")
      : `<p class="muted">${getCopy("No withdrawal requests yet.", "Babu bukatar cire kudi tukuna.")}</p>`;

  const promotions = getPromotions();
  const analyticsRows = [
    [getCopy("Total sales", "Jimillar sayarwa"), formatPrice(analytics.totalSales)],
    [getCopy("Platform revenue", "Kudin dandali"), formatPrice(analytics.platformRevenue)],
    [getCopy("Total orders", "Jimillar ododi"), String(analytics.totalOrders)],
    [getCopy("Cancelled orders", "Ododin da aka soke"), String(analytics.cancelledOrders)],
    [getCopy("Customer growth", "Karin kwastomomi"), String(analytics.customerGrowth)],
    [getCopy("Vendor growth", "Karin dillalai"), String(analytics.vendorGrowth)],
  ];
  const renderAnalyticList = (title: string, rows: Array<{ label: string; value: number }>) => `
    <div class="analytics-mini-list">
      <h4>${escapeHtml(title)}</h4>
      ${
        rows.length
          ? rows.map((row) => `<div class="record-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(String(row.value))}</span></div>`).join("")
          : `<p class="muted">${getCopy("No data yet.", "Babu bayanai tukuna.")}</p>`
      }
    </div>
  `;
  const analyticsEl = document.querySelector<HTMLElement>("#advancedAnalytics");
  if (analyticsEl) {
    analyticsEl.innerHTML = `
      <div class="advanced-kpi-grid">
        ${analyticsRows.map(([label, value]) => `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join("")}
      </div>
      <div class="advanced-analytics-grid">
        ${renderAnalyticList(getCopy("Most viewed products", "Kayayyakin da aka fi kallo"), analytics.mostViewedProducts)}
        ${renderAnalyticList(getCopy("Most searched items", "Abubuwan da aka fi nema"), analytics.mostSearchedItems)}
        ${renderAnalyticList(getCopy("Best-selling products", "Kayayyakin da suka fi sayuwa"), analytics.bestSellingProducts)}
        ${renderAnalyticList(getCopy("Best-performing vendors", "Dillalai mafi aiki"), analytics.bestPerformingVendors)}
      </div>
    `;
  }

  const controlsEl = document.querySelector<HTMLElement>("#phaseThreeControls");
  if (controlsEl) {
    controlsEl.innerHTML = `
      <div class="phase3-grid">
        <form id="commissionForm" class="phase3-card">
          <h4>${getCopy("Commission settings", "Saitin kwamishan")}</h4>
          <label>
            <span>${getCopy("Default commission (%)", "Kwamishan na asali (%)")}</span>
            <input type="number" min="0" max="50" step="1" name="defaultRate" value="${Math.round(commissionSettings.defaultRate * 100)}" />
          </label>
          <button type="submit">${getCopy("Save commission", "Ajiye kwamishan")}</button>
        </form>
        <form id="promotionForm" class="phase3-card">
          <h4>${getCopy("Promotion campaign", "Kamfen talla")}</h4>
          <label><span>${getCopy("Title", "Suna")}</span><input name="title" required placeholder="Ramadan food deals" /></label>
          <label><span>${getCopy("Type", "Nau'i")}</span>
            <select name="type">
              <option value="seasonal_campaign">Seasonal campaign</option>
              <option value="flash_sale">Flash sale</option>
              <option value="discount_code">Discount code</option>
              <option value="featured_product">Featured product</option>
              <option value="featured_vendor">Featured vendor</option>
            </select>
          </label>
          <label><span>${getCopy("Discount (%)", "Ragi (%)")}</span><input name="discountPercent" type="number" min="0" max="90" placeholder="10" /></label>
          <label><span>${getCopy("Code / vendor / product optional", "Code / dillali / kaya idan ana so")}</span><input name="target" placeholder="EIDFASHION" /></label>
          <button type="submit">${getCopy("Create promotion", "Kirkiri talla")}</button>
        </form>
        <div class="phase3-card">
          <h4>${getCopy("Active promotions", "Tallace-tallace masu aiki")}</h4>
          ${
            promotions.length
              ? promotions.slice(0, 6).map((promo) => `<div class="record-row"><strong>${escapeHtml(promo.title[state.language])}</strong><span>${escapeHtml(promo.type)}</span></div>`).join("")
              : `<p class="muted">${getCopy("No promotions yet.", "Babu talla tukuna.")}</p>`
          }
        </div>
      </div>
    `;
  }

  const subscriptionEl = document.querySelector<HTMLElement>("#vendorSubscriptionSummary");
  if (subscriptionEl) {
    const vendorRows = approvedVendors.slice(0, 8);
    subscriptionEl.innerHTML =
      vendorRows.length > 0
        ? vendorRows
            .map((vendor) => {
              const plan = getVendorPlan(vendor.businessName);
              return `
                <div class="subscription-row">
                  <div><strong>${escapeHtml(vendor.businessName)}</strong><span>${escapeHtml(plan.name)} - ${formatPrice(plan.monthlyFee)} / ${Math.round(plan.commissionRate * 100)}%</span></div>
                  <select data-vendor-plan="${escapeHtml(vendor.businessName)}">
                    <option value="free"${plan.id === "free" ? " selected" : ""}>Free</option>
                    <option value="standard"${plan.id === "standard" ? " selected" : ""}>Standard</option>
                    <option value="premium"${plan.id === "premium" ? " selected" : ""}>Premium</option>
                  </select>
                </div>
              `;
            })
            .join("")
        : `<p class="muted">${getCopy("Approve vendors to assign plans.", "Amince da dillalai domin ba su plan.")}</p>`;
  }

  const reviews = getAllReviews().filter((review) => !review.hidden).slice(0, 6);
  elements.reviewModeration.innerHTML =
    reviews.length > 0
      ? reviews
          .map(
            (review) => `
              <div class="review-admin-row">
                <div>
                  <strong>${escapeHtml(`${review.rating}/5 - ${review.reviewerName}`)}</strong>
                  <span>${escapeHtml(review.comment)}</span>
                </div>
                <button type="button" class="secondary-action" data-review-action="hide" data-review-id="${escapeHtml(review.id)}">
                  ${getCopy("Remove", "Cire")}
                </button>
              </div>
            `
          )
          .join("")
      : `<p class="muted">${getCopy("No visible reviews.", "Babu ra'ayi a fili.")}</p>`;
}

export function renderVendorApprovals(vendors: VendorRequest[]): void {
  if (vendors.length === 0) {
    elements.vendorApprovals.innerHTML = `<p class="muted">${getCopy("No vendor applications yet.", "Babu bukatar dillalai tukuna.")}</p>`;
    return;
  }

  const statusWeight = { pending: 0, approved: 1, rejected: 2 };

  elements.vendorApprovals.innerHTML = [...vendors]
    .sort((a, b) => {
      const statusA = a.status ?? "pending";
      const statusB = b.status ?? "pending";
      return statusWeight[statusA] - statusWeight[statusB] || b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, 8)
    .map((vendor) => {
      const status = vendor.status ?? "pending";
      const statusLabel =
        status === "approved"
          ? getCopy("Approved", "An amince")
          : status === "rejected"
            ? getCopy("Rejected", "An ki")
            : getCopy("Pending", "Ana dubawa");
      const canReview = status === "pending";

      return `
        <div class="vendor-approval-row">
          <div>
            <strong>${escapeHtml(vendor.businessName)}</strong>
            <span>${escapeHtml(vendor.area)} - ${escapeHtml(localizeCategory(vendor.category))} - ${escapeHtml(vendor.phone)}</span>
          </div>
          <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
          ${
            canReview
              ? `
                <div class="approval-actions">
                  <button type="button" data-vendor-id="${escapeHtml(vendor.id)}" data-vendor-action="approved">
                    ${getCopy("Approve", "Amince")}
                  </button>
                  <button type="button" class="secondary-action" data-vendor-id="${escapeHtml(vendor.id)}" data-vendor-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                </div>
              `
              : vendor.reviewedAt
                ? `<small>${escapeHtml(formatDate(vendor.reviewedAt))}</small>`
                : ""
          }
        </div>
      `;
    })
    .join("");
}

export function renderProductModeration(): void {
  const productStatusWeight = { pending: 0, hidden: 1, rejected: 2, approved: 3 };
  const visibleProducts = [...getAllProducts()]
    .sort((a, b) => productStatusWeight[getProductStatus(a.id)] - productStatusWeight[getProductStatus(b.id)])
    .slice(0, 8);
  if (visibleProducts.length === 0) {
    elements.productModeration.innerHTML = `<p class="muted">${getCopy("No products to moderate yet.", "Babu kaya da za a duba tukuna.")}</p>`;
    return;
  }

  elements.productModeration.innerHTML = visibleProducts
    .map((product) => {
      const status = getProductStatus(product.id);
      const statusLabel =
        status === "approved"
          ? getCopy("Approved", "An amince")
          : status === "pending"
            ? getCopy("Pending", "Ana dubawa")
            : status === "hidden"
              ? getCopy("Hidden", "An boye")
              : getCopy("Rejected", "An ki");
      const isVisible = status === "approved";

      return `
        <div class="product-moderation-row">
          <div class="moderation-product-thumb" style="--accent: ${product.accent}" aria-hidden="true"></div>
          <div>
            <strong>${escapeHtml(product.name[state.language])}</strong>
            <span>${escapeHtml(product.vendor)} - ${escapeHtml(product.category[state.language])}</span>
          </div>
          <span class="status-pill status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
          <div class="approval-actions">
            ${
              isVisible
                ? `
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="hidden">
                    ${getCopy("Hide", "Boye")}
                  </button>
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                `
                : `
                  <button type="button" data-product-id="${escapeHtml(product.id)}" data-product-action="approved">
                    ${getCopy("Approve", "Amince")}
                  </button>
                  <button type="button" class="secondary-action" data-product-id="${escapeHtml(product.id)}" data-product-action="rejected">
                    ${getCopy("Reject", "Ki")}
                  </button>
                `
            }
          </div>
        </div>
      `;
    })
    .join("");
}

export function renderAdminDashboard(): void {
  const history = getStoredList<SearchRecord>(storageKeys.searches);
  const vendors = getVendorRequests();
  const failed = history.filter((item) => item.resultCount === 0);
  const popular = sortEntries(groupByValue(history, (item) => item.query.toLowerCase()));
  const failedPopular = sortEntries(groupByValue(failed, (item) => item.query.toLowerCase()));
  const vendorCounts = getVendorStatusCounts(vendors);
  const productCounts = getProductStatusCounts();
  const orders = getOrders();

  elements.totalSearches.textContent = String(getUserProfiles().filter((user) => user.role === "customer").length);
  elements.failedSearches.textContent = String(vendors.length);
  elements.savedVendors.textContent = String(vendorCounts.pending);
  elements.topDemand.textContent = `${productCounts.approved} / ${orders.length}`;

  renderRankList(elements.popularSearches, popular, getCopy("No searches yet.", "Babu bincike tukuna."));
  renderRankList(
    elements.failedSearchList,
    failedPopular,
    getCopy("No failed searches yet.", "Babu binciken da ya gaza tukuna.")
  );
  renderDemandTrends(history);
  renderVendorApprovals(vendors);
  renderProductModeration();
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
