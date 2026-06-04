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
import { escapeHtml, formatDate, getCopy, getLocalizedValue } from "../../utils";

function renderApprovalBanner(status: string, note?: string): string {
  if (status === "approved") {
    return `
      <div class="dash-alert dash-alert-success">
        <strong>${getCopy("Store approved", "An amince da shago")}</strong>
        <span>${getCopy("Your products can be submitted for catalog moderation and orders can flow to this workspace.", "Ana iya aika kayanka don duba jerin kaya kuma ododi za su iya zuwa wannan wurin aiki.")}</span>
      </div>
    `;
  }

  const rejected = status === "rejected";
  return `
    <div class="dash-alert ${rejected ? "dash-alert-danger" : "dash-alert-warning"}">
      <strong>${rejected ? getCopy("Store needs attention", "Shago yana buƙatar kulawa") : getCopy("Store approval pending", "Amincewa da shago na jira")}</strong>
      <span>${escapeHtml(note || (rejected ? getCopy("Review your business details and contact support before resubmitting.", "Duba bayanan kasuwancinka ka tuntubi tallafi kafin sake aika.") : getCopy("You can prepare products, but publishing is limited until admin approval.", "Kana iya shirya kaya, amma buga yana iyakantacce har admin ya amince.")))}</span>
    </div>
  `;
}

export function renderVendorOverview(user: UserSession, currentPath = "vendor/overview"): string {
  const data = getVendorDashboardData(user);

  return `
    <div class="dash-shell dash-shell-vendor">
      ${renderDashboardHeader({
        eyebrow: getCopy("Vendor workspace", "Wurin aiki na dillali"),
        title: data.businessName,
        description: getCopy("Manage products, inventory, orders, revenue, payouts, reviews, analytics, and store readiness.", "Kula da kaya, ajiya, ododi, kuɗin shiga, biyan kuɗi, ra'ayoyi, nazari, da shirye-shiryen shago."),
        actions: [
          { label: getCopy("Add product", "Saka kaya"), href: "#vendorProductForm" },
          { label: getCopy("Request payout", "Neman biya"), route: "vendor/payouts", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("vendor", currentPath)}

      <div class="vendor-dash-header dash-hidden-compat">
        <div class="vendor-dash-title">
          <p class="eyebrow">${getCopy("Vendor workspace", "Wurin aiki na dillali")}</p>
          <h2 id="vendorDashBusinessName">${escapeHtml(data.businessName)}</h2>
        </div>
        <span class="vendor-status-badge" id="vendorStatusBadge" data-status="${escapeHtml(data.approvalStatus)}">${escapeHtml(data.approvalStatus)}</span>
      </div>

      ${renderApprovalBanner(data.approvalStatus, data.approvalNote)}

      ${renderStatGrid([
        { label: getCopy("Total sales", "Jimillar siyarwa"), value: renderMoney(data.paidSales), detail: getCopy("Paid order value", "Darajar oda da aka biya"), tone: "success" },
        { label: getCopy("Pending orders", "Ododi da ke jira"), value: data.pendingOrders.length, detail: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`, tone: "warning" },
        { label: getCopy("Low stock", "Ƙarancin ajiya"), value: data.lowStock.length, detail: getCopy("Products at 3 or fewer units", "Kaya da ke da naúra 3 ko ƙasa da haka"), tone: data.lowStock.length ? "danger" : "neutral" },
        { label: getCopy("Available payout", "Biya da ake da shi"), value: renderMoney(data.wallet?.availableBalance), detail: `${renderMoney(data.wallet?.pendingBalance)} ${getCopy("pending", "jira")}`, tone: "info" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: getCopy("Fulfillment", "Cika oda"),
          title: getCopy("Recent orders", "Ododi na kwanan nan"),
          action: { label: getCopy("Orders", "Ododi"), route: "vendor/orders" },
          body: renderMiniRows(
            data.orders.slice(0, 6).map((order) => ({
              title: order.id,
              meta: `${formatDate(order.createdAt)} - ${getCopy("payment", "biya")} ${order.paymentStatus}`,
              value: renderMoney(order.total),
              status: order.status,
            })),
            { title: getCopy("No vendor orders yet", "Babu ododi na dillali tukuna"), body: getCopy("New paid and pending orders will appear here when customers buy your products.", "Ododi sabbi da waɗanda aka biya da waɗanda ke jira za su bayyana a nan sa'ad da kwastoma suka sayi kayanka.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Inventory", "Ajiya"),
          title: getCopy("Low stock products", "Kaya da ƙarancin ajiya"),
          action: { label: getCopy("Inventory", "Ajiya"), route: "vendor/inventory" },
          body: renderMiniRows(
            data.lowStock.slice(0, 5).map((product) => ({
              title: getLocalizedValue(product.name),
              meta: productToMiniMeta(product),
              status: (product.quantityAvailable ?? 0) === 0 ? "out_of_stock" : "low_stock",
            })),
            { title: getCopy("Inventory is healthy", "Ajiya tana cikin lafiya"), body: getCopy("Products with low or empty stock will be highlighted here.", "Kaya da ke da ƙarancin ajiya ko babu za a nuna su a nan.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Catalog", "Jerin kaya"),
          title: getCopy("Top products", "Kayan da suka fi"),
          action: { label: getCopy("Products", "Kaya"), route: "vendor/products" },
          body: renderMiniRows(
            data.topProducts.map((product) => ({
              title: getLocalizedValue(product.name),
              meta: productToMiniMeta(product),
              status: product.moderationStatus ?? product.listingStatus ?? "active",
            })),
            { title: getCopy("No products yet", "Babu kaya tukuna"), body: getCopy("Add your first product with price, stock, image, and bilingual description.", "Ƙara kayan farko tare da farashin, ajiya, hoto, da bayani mai harsuna biyu.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Payouts", "Biyan kuɗi"),
          title: getCopy("Wallet and settlement", "Walat da tantancewa"),
          action: { label: getCopy("Payouts", "Biyan kuɗi"), route: "vendor/payouts" },
          body: `
            <div class="dash-money-stack">
              <article><span>${getCopy("Available", "Da ake da shi")}</span><strong>${renderMoney(data.wallet?.availableBalance)}</strong></article>
              <article><span>${getCopy("Pending", "Jira")}</span><strong>${renderMoney(data.wallet?.pendingBalance)}</strong></article>
              <article><span>${getCopy("Commission paid", "Kwamiti da aka biya")}</span><strong>${renderMoney(data.wallet?.totalCommission)}</strong></article>
            </div>
            ${
              data.payouts.length
                ? renderMiniRows(
                    data.payouts.slice(0, 3).map((payout) => ({
                      title: payout.id,
                      meta: `${payout.bankName ?? getCopy("Bank", "Banki")} - ${payout.requestedAt ? formatDate(payout.requestedAt) : getCopy("requested", "an nema")}`,
                      value: renderMoney(payout.amount),
                      status: payout.status,
                    })),
                    { title: getCopy("No payout requests", "Babu buƙatun biya"), body: getCopy("Request payouts once your available balance is ready.", "Nemi biyan kuɗi da zarar kuɗin da ake da shi ya shirya.") }
                  )
                : renderEmptyState(getCopy("No payout requests", "Babu buƙatun biya"), getCopy("Settlement requests and admin decisions will appear here.", "Buƙatun tantancewa da yanke shawara na admin za su bayyana a nan."))
            }
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Feedback", "Ra'ayi"),
          title: getCopy("Latest reviews", "Ra'ayoyi na kwanan nan"),
          action: { label: getCopy("Reviews", "Ra'ayoyi"), route: "vendor/reviews" },
          body: renderMiniRows(
            data.reviews.map((review) => ({
              title: `${review.rating}/5 - ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
              meta: review.comment,
              status: review.hidden ? "hidden" : "visible",
            })),
            { title: getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), body: getCopy("Customer reviews will help you monitor quality and trust.", "Ra'ayoyin kwastoma za su taimaka maka ka sa ido kan inganci da amana.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Manage", "Sarrafa"),
          title: getCopy("Product operations", "Ayyukan kaya"),
          className: "dash-panel-wide",
          body: `
            <div class="vendor-product-manager dash-embedded-manager" aria-labelledby="vendor-products-title">
              <div class="vendor-product-heading">
                <div>
                  <span>${getCopy("Seller catalog", "Jerin kayan mai siyarwa")}</span>
                  <h3 id="vendor-products-title">${getCopy("Add and manage products", "Ƙara da sarrafa kaya")}</h3>
                </div>
                <p>${getCopy("Products are submitted for admin moderation before appearing in the public catalog.", "Ana aika kaya don duba admin kafin su bayyana a cikin jerin kayan jama'a.")}</p>
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
          eyebrow: getCopy("Compatibility", "Daidaitawa"),
          title: getCopy("Order queue and notifications", "Layin oda da sanarwa"),
          className: "dash-panel-wide",
          body: `<div class="vendor-commerce-list" id="vendorCommerceList" aria-live="polite"></div>`,
        })}
      </div>
    </div>
  `;
}
