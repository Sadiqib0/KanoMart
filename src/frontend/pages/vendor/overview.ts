import type { UserSession } from "../../../backend/types";
import { getVendorDashboardData, productToMiniMeta } from "../../services/dashboard-data";
import {
  renderDashboardHeader,
  renderEmptyState,
  renderMiniRows,
  renderMoney,
  renderPanel,
  renderStatGrid,
} from "../../components/dashboard/primitives";
import { renderRoleDashboardNav } from "../../components/dashboard/role-nav";
import { escapeHtml, formatDate, getLocalizedValue } from "../../utils";

function renderApprovalBanner(status: string, note?: string): string {
  if (status === "approved") {
    return `
      <div class="dash-alert dash-alert-success">
        <strong>Store approved</strong>
        <span>Your products can be submitted for catalog moderation and orders can flow to this workspace.</span>
      </div>
    `;
  }

  const rejected = status === "rejected";
  return `
    <div class="dash-alert ${rejected ? "dash-alert-danger" : "dash-alert-warning"}">
      <strong>${rejected ? "Store needs attention" : "Store approval pending"}</strong>
      <span>${escapeHtml(note || (rejected ? "Review your business details and contact support before resubmitting." : "You can prepare products, but publishing is limited until admin approval."))}</span>
    </div>
  `;
}

export function renderVendorOverview(user: UserSession, currentPath = "vendor/overview"): string {
  const data = getVendorDashboardData(user);

  return `
    <div class="dash-shell dash-shell-vendor">
      ${renderDashboardHeader({
        eyebrow: "Vendor workspace",
        title: data.businessName,
        description: "Manage products, inventory, orders, revenue, payouts, reviews, analytics, and store readiness.",
        actions: [
          { label: "Add product", href: "#vendorProductForm" },
          { label: "Request payout", route: "vendor/payouts", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("vendor", currentPath)}

      <div class="vendor-dash-header dash-hidden-compat">
        <div class="vendor-dash-title">
          <p class="eyebrow">Vendor workspace</p>
          <h2 id="vendorDashBusinessName">${escapeHtml(data.businessName)}</h2>
        </div>
        <span class="vendor-status-badge" id="vendorStatusBadge" data-status="${escapeHtml(data.approvalStatus)}">${escapeHtml(data.approvalStatus)}</span>
      </div>

      ${renderApprovalBanner(data.approvalStatus, data.approvalNote)}

      ${renderStatGrid([
        { label: "Total sales", value: renderMoney(data.paidSales), detail: "Paid order value", tone: "success" },
        { label: "Pending orders", value: data.pendingOrders.length, detail: `${data.orders.length} total orders`, tone: "warning" },
        { label: "Low stock", value: data.lowStock.length, detail: "Products at 3 or fewer units", tone: data.lowStock.length ? "danger" : "neutral" },
        { label: "Available payout", value: renderMoney(data.wallet?.availableBalance), detail: `${renderMoney(data.wallet?.pendingBalance)} pending`, tone: "info" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: "Fulfillment",
          title: "Recent orders",
          action: { label: "Orders", route: "vendor/orders" },
          body: renderMiniRows(
            data.orders.slice(0, 6).map((order) => ({
              title: order.id,
              meta: `${formatDate(order.createdAt)} - payment ${order.paymentStatus}`,
              value: renderMoney(order.total),
              status: order.status,
            })),
            { title: "No vendor orders yet", body: "New paid and pending orders will appear here when customers buy your products." }
          ),
        })}

        ${renderPanel({
          eyebrow: "Inventory",
          title: "Low stock products",
          action: { label: "Inventory", route: "vendor/inventory" },
          body: renderMiniRows(
            data.lowStock.slice(0, 5).map((product) => ({
              title: getLocalizedValue(product.name),
              meta: productToMiniMeta(product),
              status: (product.quantityAvailable ?? 0) === 0 ? "out_of_stock" : "low_stock",
            })),
            { title: "Inventory is healthy", body: "Products with low or empty stock will be highlighted here." }
          ),
        })}

        ${renderPanel({
          eyebrow: "Catalog",
          title: "Top products",
          action: { label: "Products", route: "vendor/products" },
          body: renderMiniRows(
            data.topProducts.map((product) => ({
              title: getLocalizedValue(product.name),
              meta: productToMiniMeta(product),
              status: product.moderationStatus ?? product.listingStatus ?? "active",
            })),
            { title: "No products yet", body: "Add your first product with price, stock, image, and bilingual description." }
          ),
        })}

        ${renderPanel({
          eyebrow: "Payouts",
          title: "Wallet and settlement",
          action: { label: "Payouts", route: "vendor/payouts" },
          body: `
            <div class="dash-money-stack">
              <article><span>Available</span><strong>${renderMoney(data.wallet?.availableBalance)}</strong></article>
              <article><span>Pending</span><strong>${renderMoney(data.wallet?.pendingBalance)}</strong></article>
              <article><span>Commission paid</span><strong>${renderMoney(data.wallet?.totalCommission)}</strong></article>
            </div>
            ${
              data.payouts.length
                ? renderMiniRows(
                    data.payouts.slice(0, 3).map((payout) => ({
                      title: payout.id,
                      meta: `${payout.bankName ?? "Bank"} - ${payout.requestedAt ? formatDate(payout.requestedAt) : "requested"}`,
                      value: renderMoney(payout.amount),
                      status: payout.status,
                    })),
                    { title: "No payout requests", body: "Request payouts once your available balance is ready." }
                  )
                : renderEmptyState("No payout requests", "Settlement requests and admin decisions will appear here.")
            }
          `,
        })}

        ${renderPanel({
          eyebrow: "Feedback",
          title: "Latest reviews",
          action: { label: "Reviews", route: "vendor/reviews" },
          body: renderMiniRows(
            data.reviews.map((review) => ({
              title: `${review.rating}/5 - ${review.reviewerName ?? "Customer"}`,
              meta: review.comment,
              status: review.hidden ? "hidden" : "visible",
            })),
            { title: "No reviews yet", body: "Customer reviews will help you monitor quality and trust." }
          ),
        })}

        ${renderPanel({
          eyebrow: "Manage",
          title: "Product operations",
          className: "dash-panel-wide",
          body: `
            <div class="vendor-product-manager dash-embedded-manager" aria-labelledby="vendor-products-title">
              <div class="vendor-product-heading">
                <div>
                  <span>Seller catalog</span>
                  <h3 id="vendor-products-title">Add and manage products</h3>
                </div>
                <p>Products are submitted for admin moderation before appearing in the public catalog.</p>
              </div>
              <div class="vendor-product-gate" id="vendorProductGate" role="status" aria-live="polite"></div>
              <form class="vendor-product-form" id="vendorProductForm" novalidate>
                <label><span>Product name (English)</span><input type="text" name="productName" minlength="2" maxlength="90" required placeholder="e.g. Plain black jallabiya" /></label>
                <label><span>Product name (Hausa)</span><input type="text" name="productNameHa" minlength="2" maxlength="90" placeholder="misali Jallabiya baki" /></label>
                <label><span>Description (English)</span><input type="text" name="descriptionEn" maxlength="240" placeholder="Short product description" /></label>
                <label><span>Description (Hausa)</span><input type="text" name="descriptionHa" maxlength="240" placeholder="Takaitaccen bayanin kaya" /></label>
                <label><span>Value / price</span><input type="text" inputmode="numeric" name="productValue" required placeholder="e.g. 15000" autocomplete="off" /></label>
                <label><span>Quantity available</span><input type="number" name="quantityAvailable" min="0" step="1" required placeholder="10" /></label>
                <label><span>Category</span><select name="productCategory" required><option value="food">Food</option><option value="fashion">Fashion</option><option value="children">Children</option><option value="essentials">Essentials</option></select></label>
                <label><span>Product picture</span><input type="file" name="productImage" accept="image/png,image/jpeg,image/webp" required /><small>JPEG, PNG, or WebP. Large phone photos are optimized before upload.</small></label>
                <button type="submit">Add product</button>
                <p class="form-message" id="vendorProductMessage" role="status" aria-live="polite"></p>
              </form>
              <div class="vendor-products-list" id="vendorProductsList" aria-live="polite"></div>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: "Compatibility",
          title: "Order queue and notifications",
          className: "dash-panel-wide",
          body: `<div class="vendor-commerce-list" id="vendorCommerceList" aria-live="polite"></div>`,
        })}
      </div>
    </div>
  `;
}
