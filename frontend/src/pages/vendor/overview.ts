import type { UserSession } from "../../../backend/types";
import { getVendorDashboardData, productToMiniMeta } from "../../services/dashboard-data";
import {
  renderDashboardHeader,
  renderEmptyState,
  renderMiniRows,
  renderMoney,
  renderPanel,
  renderStatGrid,
  type ActionInput,
} from "../../components/dashboard/primitives";
import { renderRoleDashboardNav } from "../../components/dashboard/role-nav";
import { escapeHtml, formatDate, getCopy, getLocalizedValue } from "../../utils";

function renderApprovalBanner(status: string, note?: string): string {
  if (status === "approved") {
    return `<div class="dash-alert dash-alert-success">
      <strong>${getCopy("Store approved", "An amince da shago")}</strong>
      <span>${getCopy("Your products can be submitted for catalog moderation and orders can flow to this workspace.", "Ana iya aika kayanka don duba jerin kaya kuma ododi za su iya zuwa wannan wurin aiki.")}</span>
    </div>`;
  }
  const rejected = status === "rejected";
  return `<div class="dash-alert ${rejected ? "dash-alert-danger" : "dash-alert-warning"}">
    <strong>${rejected ? getCopy("Store needs attention", "Shago yana buƙatar kulawa") : getCopy("Store approval pending", "Amincewa da shago na jira")}</strong>
    <span>${escapeHtml(note || (rejected
      ? getCopy("Review your business details and contact support before resubmitting.", "Duba bayanan kasuwancinka ka tuntubi tallafi kafin sake aika.")
      : getCopy("You can prepare products, but publishing is limited until admin approval.", "Kana iya shirya kaya, amma buga yana iyakantacce har admin ya amince.")))}</span>
  </div>`;
}

function shell(currentPath: string, eyebrow: string, title: string, description: string, actions: ActionInput[], body: string): string {
  return `
    <div class="dash-shell dash-shell-vendor">
      ${renderDashboardHeader({ eyebrow, title, description, actions })}
      ${renderRoleDashboardNav("vendor", currentPath)}
      ${body}
    </div>
  `;
}

function renderProductsPage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  const productRows = data.products.map((p) => `
    <div class="dash-mini-row vendor-product-row">
      <div class="dash-mini-row-main">
        <strong>${escapeHtml(getLocalizedValue(p.name))}</strong>
        <span>${escapeHtml(productToMiniMeta(p))}</span>
      </div>
      <div class="dash-mini-row-aside">
        <span class="dash-badge dash-badge--${escapeHtml(p.moderationStatus ?? "pending")}">${escapeHtml(p.moderationStatus ?? "pending")}</span>
        <select class="dash-input dash-input--sm vendor-status-select" data-product-id="${escapeHtml(p.id)}">
          <option value="active" ${p.listingStatus === "active" ? "selected" : ""}>${getCopy("Active", "Aiki")}</option>
          <option value="out_of_stock" ${p.listingStatus === "out_of_stock" ? "selected" : ""}>${getCopy("Out of stock", "Kare ajiya")}</option>
          <option value="taken_down" ${p.listingStatus === "taken_down" ? "selected" : ""}>${getCopy("Take down", "Sauke")}</option>
        </select>
      </div>
    </div>
  `).join("");

  return shell("vendor/products",
    getCopy("Catalog", "Jerin kaya"),
    getCopy("Your products", "Kayanka"),
    getCopy("Manage your listings — update prices, status, and stock. New products go through admin moderation.", "Kula da jerin kayanka — sabunta farashi, yanayi, da ajiya. Sabbin kaya suna tafiya ta duba admin."),
    [{ label: getCopy("Add new product", "Ƙara kaya sabbi"), href: "#vendorProductForm" }],
    `
      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: getCopy("Listings", "Jeri"),
          title: `${data.products.length} ${getCopy("products", "kaya")}`,
          body: data.products.length
            ? `<div class="dash-mini-rows">${productRows}</div>`
            : renderEmptyState(getCopy("No products yet", "Babu kaya tukuna"), getCopy("Add your first product to start selling on KanoMart.", "Ƙara kayan farko don fara siyarwa a KanoMart."), { label: getCopy("Add product", "Ƙara kaya"), href: "#vendorProductForm" }),
        })}
        ${renderPanel({
          eyebrow: getCopy("Add listing", "Ƙara jeri"),
          title: getCopy("New product", "Sabuwar kaya"),
          body: `
            <form class="vendor-product-form dash-form" id="vendorProductForm" novalidate>
              <div class="dash-form-row">
                <label class="dash-label" for="vpName">${getCopy("Name (English)", "Suna (Turanci)")}</label>
                <input class="dash-input" id="vpName" name="productName" type="text" minlength="2" maxlength="90" required placeholder="${getCopy("e.g. Plain black jallabiya", "misali Jallabiya baki")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpNameHa">${getCopy("Name (Hausa)", "Suna (Hausa)")}</label>
                <input class="dash-input" id="vpNameHa" name="productNameHa" type="text" maxlength="90" placeholder="${getCopy("e.g. Jallabiya baki", "misali Jallabiya baki")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpDesc">${getCopy("Description (English)", "Bayani (Turanci)")}</label>
                <input class="dash-input" id="vpDesc" name="descriptionEn" type="text" maxlength="240" placeholder="${getCopy("Short product description", "Takaitaccen bayanin kaya")}" />
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpDescHa">${getCopy("Description (Hausa)", "Bayani (Hausa)")}</label>
                <input class="dash-input" id="vpDescHa" name="descriptionHa" type="text" maxlength="240" placeholder="${getCopy("Takaitaccen bayanin kaya", "Takaitaccen bayanin kaya")}" />
              </div>
              <div class="dash-form-row dash-form-row--half">
                <div>
                  <label class="dash-label" for="vpPrice">${getCopy("Price (NGN)", "Farashi (NGN)")}</label>
                  <input class="dash-input" id="vpPrice" name="productValue" type="text" inputmode="numeric" required placeholder="15000" />
                </div>
                <div>
                  <label class="dash-label" for="vpQty">${getCopy("Stock quantity", "Yawan ajiya")}</label>
                  <input class="dash-input" id="vpQty" name="quantityAvailable" type="number" min="0" step="1" required placeholder="10" />
                </div>
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpCat">${getCopy("Category", "Rukunin kaya")}</label>
                <select class="dash-input" id="vpCat" name="productCategory" required>
                  <option value="food">${getCopy("Food", "Abinci")}</option>
                  <option value="fashion">${getCopy("Fashion", "Kaya")}</option>
                  <option value="children">${getCopy("Children", "Yara")}</option>
                  <option value="essentials">${getCopy("Essentials", "Abubuwan da ake bukata")}</option>
                  <option value="electronics">${getCopy("Electronics", "Lantarki")}</option>
                </select>
              </div>
              <div class="dash-form-row">
                <label class="dash-label" for="vpImg">${getCopy("Product image", "Hoton kaya")}</label>
                <input class="dash-input" id="vpImg" name="productImage" type="file" accept="image/png,image/jpeg,image/webp" required />
                <small>${getCopy("JPEG, PNG, or WebP. Optimized before upload.", "JPEG, PNG, ko WebP. Ana inganta kafin aika.")}</small>
              </div>
              <div class="dash-form-actions">
                <button type="submit" class="btn btn-primary">${getCopy("Submit product", "Aika kaya")}</button>
              </div>
              <div id="vendorProductMessage" class="dash-form-status" role="status" aria-live="polite"></div>
            </form>
          `,
        })}
      </div>
    `
  );
}

function renderOrdersPage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  return shell("vendor/orders",
    getCopy("Fulfillment", "Cika oda"),
    getCopy("Vendor orders", "Ododinka"),
    getCopy("Manage incoming and in-progress orders for your products.", "Kula da ododi masu shigowa da waɗanda ke tafiya don kayanka."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Pending", "Jira"),
        title: getCopy("Awaiting confirmation", "Jiran tabbatarwa"),
        body: renderMiniRows(
          data.pendingOrders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: o.status })),
          { title: getCopy("No pending orders", "Babu ododi da ke jira"), body: getCopy("New orders will appear here for confirmation.", "Sabbin ododi za su bayyana a nan don tabbatarwa.") }
        ),
      })}
      ${renderPanel({
        eyebrow: getCopy("All orders", "Dukkan ododi"),
        title: getCopy("Order history", "Tarihin oda"),
        body: renderMiniRows(
          data.orders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: `${formatDate(o.createdAt)} · ${o.paymentStatus}`, value: renderMoney(o.total), status: o.status })),
          { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Orders from customers who buy your products appear here.", "Ododi daga kwastoma da suka sayi kayanka za su bayyana a nan.") }
        ),
      })}
      <div id="vendorCommerceList" class="vendor-commerce-list" aria-live="polite"></div>
    </div>`
  );
}

function renderInventoryPage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  return shell("vendor/inventory",
    getCopy("Inventory", "Ajiya"),
    getCopy("Stock management", "Sarrafa ajiya"),
    getCopy("Monitor stock levels and restock products before they run out.", "Sa ido kan matakin ajiya ka sake cika kayan kafin su kare."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Critical", "Muhimmanci"),
        title: getCopy("Low stock alerts", "Gargaɗi na ƙarancin ajiya"),
        body: renderMiniRows(
          data.lowStock.map((p) => ({ title: getLocalizedValue(p.name), meta: productToMiniMeta(p), status: (p.quantityAvailable ?? 0) === 0 ? "out_of_stock" : "low_stock" })),
          { title: getCopy("No stock issues", "Babu matsalar ajiya"), body: getCopy("Products with 3 or fewer units will be flagged here.", "Kaya da ke da naúra 3 ko ƙasa da haka za a nuna su a nan.") }
        ),
      })}
      ${renderPanel({
        eyebrow: getCopy("All products", "Dukkan kaya"),
        title: getCopy("Full inventory", "Cikakkiyar ajiya"),
        body: renderMiniRows(
          data.products.map((p) => ({ title: getLocalizedValue(p.name), meta: `${getCopy("Stock", "Ajiya")}: ${p.quantityAvailable ?? 0} · ${escapeHtml(p.listingStatus ?? "active")}`, status: p.listingStatus ?? "active" })),
          { title: getCopy("No products", "Babu kaya"), body: getCopy("Add products to start tracking inventory.", "Ƙara kaya don fara bin diddigin ajiya.") }
        ),
      })}
    </div>`
  );
}

function renderRevenuePage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  return shell("vendor/revenue",
    getCopy("Finance", "Kudi"),
    getCopy("Revenue overview", "Takaitaccen kuɗin shiga"),
    getCopy("Track your paid sales, pending settlements, and platform commission.", "Bin diddigin siyarwa da aka biya, tantancewa da ke jira, da kwamiti na dandalin."),
    [{ label: getCopy("Request payout", "Neman biya"), route: "vendor/payouts", tone: "secondary" }],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
        { label: getCopy("Paid sales", "Siyarwa da aka biya"), value: renderMoney(data.paidSales), detail: `${data.orders.filter((o) => o.paymentStatus === "paid").length} ${getCopy("paid orders", "ododi da aka biya")}`, tone: "success" },
        { label: getCopy("Available balance", "Kuɗin da ake da shi"), value: renderMoney(data.wallet?.availableBalance), detail: getCopy("Ready for payout", "A shirye don biya"), tone: "info" },
        { label: getCopy("Pending balance", "Kuɗin da ke jira"), value: renderMoney(data.wallet?.pendingBalance), detail: getCopy("Awaiting settlement", "Jiran tantancewa"), tone: "warning" },
        { label: getCopy("Commission paid", "Kwamiti da aka biya"), value: renderMoney(data.wallet?.totalCommission), detail: getCopy("Platform fee", "Kuɗin dandalin"), tone: "neutral" },
      ])}
      ${renderPanel({
        eyebrow: getCopy("Transactions", "Ma'amaloli"),
        title: getCopy("Recent paid orders", "Ododi da aka biya na kwanan nan"),
        body: renderMiniRows(
          data.orders.filter((o) => o.paymentStatus === "paid").slice(0, 8).map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: "paid" })),
          { title: getCopy("No paid orders", "Babu ododi da aka biya"), body: getCopy("Revenue from paid customer orders will show here.", "Kuɗin shiga daga ododi da kwastoma suka biya za su bayyana a nan.") }
        ),
      })}
    </div>`
  );
}

function renderPayoutsPage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  return shell("vendor/payouts",
    getCopy("Finance", "Kudi"),
    getCopy("Payouts", "Biyan kuɗi"),
    getCopy("Request settlements to your bank account once your balance is available.", "Nemi tantancewa zuwa asusun bankinka da zarar kuɗin da ake da shi ya shirya."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Wallet", "Walat"),
        title: getCopy("Available balance", "Kuɗin da ake da shi"),
        body: `
          <div class="dash-money-stack">
            <div class="dash-money-line"><span>${getCopy("Available", "Da ake da shi")}</span><b>${renderMoney(data.wallet?.availableBalance)}</b></div>
            <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.wallet?.pendingBalance)}</b></div>
            <div class="dash-money-line dash-money-total"><span>${getCopy("Commission paid", "Kwamiti da aka biya")}</span><b>${renderMoney(data.wallet?.totalCommission)}</b></div>
          </div>
        `,
      })}
      ${renderPanel({
        eyebrow: getCopy("Request", "Nema"),
        title: getCopy("New payout request", "Sabuwar buƙatar biya"),
        body: `
          <form class="dash-form" id="payoutRequestForm" novalidate>
            <div class="dash-form-row dash-form-row--half">
              <div>
                <label class="dash-label" for="payoutAmount">${getCopy("Amount (NGN)", "Adadin kuɗi (NGN)")}</label>
                <input class="dash-input" id="payoutAmount" name="amount" type="number" min="1" step="1" required placeholder="5000" />
              </div>
              <div>
                <label class="dash-label" for="payoutBank">${getCopy("Bank name", "Sunan banki")}</label>
                <input class="dash-input" id="payoutBank" name="bankName" type="text" required placeholder="${getCopy("e.g. First Bank", "misali First Bank")}" />
              </div>
            </div>
            <div class="dash-form-row dash-form-row--half">
              <div>
                <label class="dash-label" for="payoutAccNum">${getCopy("Account number", "Lambar asusun")}</label>
                <input class="dash-input" id="payoutAccNum" name="accountNumber" type="text" inputmode="numeric" pattern="[0-9]{10}" required placeholder="0123456789" />
              </div>
              <div>
                <label class="dash-label" for="payoutAccName">${getCopy("Account name", "Sunan asusun")}</label>
                <input class="dash-input" id="payoutAccName" name="accountName" type="text" required placeholder="${getCopy("As on bank records", "Kamar yadda yake a banki")}" />
              </div>
            </div>
            <div class="dash-form-actions">
              <button type="submit" class="btn btn-primary">${getCopy("Submit request", "Aika buƙata")}</button>
            </div>
            <div id="payoutRequestStatus" class="dash-form-status" role="status" aria-live="polite"></div>
          </form>
        `,
      })}
      ${renderPanel({
        eyebrow: getCopy("History", "Tarihi"),
        title: getCopy("Payout requests", "Buƙatun biya"),
        body: renderMiniRows(
          data.payouts.map((p) => ({ title: `#${p.id.slice(-6).toUpperCase()} · ${p.bankName ?? getCopy("Bank", "Banki")}`, meta: p.requestedAt ? formatDate(p.requestedAt) : getCopy("Requested", "An nema"), value: renderMoney(p.amount), status: p.status })),
          { title: getCopy("No payout requests", "Babu buƙatun biya"), body: getCopy("Submit a request when your balance is ready.", "Aika buƙata sa'ad da kuɗinka ya shirya.") }
        ),
      })}
    </div>`
  );
}

function renderReviewsPage(user: UserSession, data: ReturnType<typeof getVendorDashboardData>): string {
  return shell("vendor/reviews",
    getCopy("Feedback", "Ra'ayi"),
    getCopy("Customer reviews", "Ra'ayoyin kwastoma"),
    getCopy("Monitor product ratings and customer feedback to improve your store quality.", "Sa ido kan ƙimar kaya da ra'ayoyin kwastoma don inganta ingancin shagonka."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("All reviews", "Dukkan ra'ayoyi"),
        title: `${data.reviews.length} ${getCopy("reviews", "ra'ayoyi")}`,
        body: data.reviews.length
          ? `<div class="dash-notification-stack">${data.reviews.map((r) => `
              <article class="dash-review-item">
                <div class="dash-review-rating">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
                <div class="dash-review-body">
                  <strong>${escapeHtml(r.reviewerName ?? getCopy("Customer", "Kwastoma"))}</strong>
                  <span>${escapeHtml(r.comment)}</span>
                  <time>${formatDate(r.createdAt)}</time>
                </div>
                ${r.hidden ? `<span class="dash-badge dash-badge--hidden">${getCopy("Hidden", "A ɓoye")}</span>` : ""}
              </article>
            `).join("")}</div>`
          : renderEmptyState(getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), getCopy("Customer reviews on your products will appear here.", "Ra'ayoyin kwastoma akan kayanka za su bayyana a nan.")),
      })}
    </div>`
  );
}

export function renderVendorOverview(user: UserSession, currentPath = "vendor/overview"): string {
  const data = getVendorDashboardData(user);

  if (currentPath === "vendor/products") return renderProductsPage(user, data);
  if (currentPath === "vendor/orders") return renderOrdersPage(user, data);
  if (currentPath === "vendor/inventory") return renderInventoryPage(user, data);
  if (currentPath === "vendor/revenue") return renderRevenuePage(user, data);
  if (currentPath === "vendor/payouts") return renderPayoutsPage(user, data);
  if (currentPath === "vendor/reviews") return renderReviewsPage(user, data);

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
          action: { label: getCopy("All orders", "Dukkan ododi"), route: "vendor/orders" },
          body: renderMiniRows(
            data.orders.slice(0, 6).map((order) => ({
              title: `#${order.id.slice(-6).toUpperCase()}`,
              meta: `${formatDate(order.createdAt)} · ${order.paymentStatus}`,
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
              <div class="dash-money-line"><span>${getCopy("Available", "Da ake da shi")}</span><b>${renderMoney(data.wallet?.availableBalance)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.wallet?.pendingBalance)}</b></div>
              <div class="dash-money-line dash-money-total"><span>${getCopy("Commission", "Kwamiti")}</span><b>${renderMoney(data.wallet?.totalCommission)}</b></div>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Feedback", "Ra'ayi"),
          title: getCopy("Latest reviews", "Ra'ayoyi na kwanan nan"),
          action: { label: getCopy("Reviews", "Ra'ayoyi"), route: "vendor/reviews" },
          body: renderMiniRows(
            data.reviews.map((review) => ({
              title: `${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)} — ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
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
                <label><span>${getCopy("Product name (English)", "Suna (Turanci)")}</span><input type="text" name="productName" minlength="2" maxlength="90" required placeholder="${getCopy("e.g. Plain black jallabiya", "misali Jallabiya baki")}" /></label>
                <label><span>${getCopy("Product name (Hausa)", "Suna (Hausa)")}</span><input type="text" name="productNameHa" minlength="2" maxlength="90" placeholder="${getCopy("e.g. Jallabiya baki", "misali Jallabiya baki")}" /></label>
                <label><span>${getCopy("Description (English)", "Bayani (Turanci)")}</span><input type="text" name="descriptionEn" maxlength="240" placeholder="${getCopy("Short product description", "Takaitaccen bayanin kaya")}" /></label>
                <label><span>${getCopy("Description (Hausa)", "Bayani (Hausa)")}</span><input type="text" name="descriptionHa" maxlength="240" placeholder="${getCopy("Takaitaccen bayanin kaya", "Takaitaccen bayanin kaya")}" /></label>
                <label><span>${getCopy("Value / price", "Farashi")}</span><input type="text" inputmode="numeric" name="productValue" required placeholder="15000" autocomplete="off" /></label>
                <label><span>${getCopy("Quantity available", "Yawan kaya a ajiya")}</span><input type="number" name="quantityAvailable" min="0" step="1" required placeholder="10" /></label>
                <label><span>${getCopy("Category", "Rukunin kaya")}</span><select name="productCategory" required><option value="food">${getCopy("Food", "Abinci")}</option><option value="fashion">${getCopy("Fashion", "Kaya")}</option><option value="children">${getCopy("Children", "Yara")}</option><option value="essentials">${getCopy("Essentials", "Abubuwan da ake bukata")}</option></select></label>
                <label><span>${getCopy("Product picture", "Hoton kaya")}</span><input type="file" name="productImage" accept="image/png,image/jpeg,image/webp" required /><small>${getCopy("JPEG, PNG, or WebP. Large phone photos are optimized before upload.", "JPEG, PNG, ko WebP. Ana inganta hotuna kafin aika.")}</small></label>
                <button type="submit">${getCopy("Add product", "Ƙara kaya")}</button>
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
