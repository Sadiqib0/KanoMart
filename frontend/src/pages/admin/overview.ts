import { getAdminDashboardData } from "../../services/dashboard-data";
import {
  renderDashboardHeader,
  renderEmptyState,
  renderMiniRows,
  renderMoney,
  renderPanel,
  renderStatGrid,
} from "../../components/dashboard/primitives";
import { renderRoleDashboardNav } from "../../components/dashboard/role-nav";
import { formatDate, getCopy } from "../../utils";

export function renderAdminOverview(currentPath = "admin/overview"): string {
  const data = getAdminDashboardData();
  const pendingPayments = data.payments.filter((payment) => payment.status === "pending");
  const failedPayments = data.payments.filter((payment) => payment.status === "failed");
  const recentOrders = data.orders.slice(0, 6);

  return `
    <div class="dash-shell dash-shell-admin">
      ${renderDashboardHeader({
        eyebrow: getCopy("Marketplace control room", "Cibiyar kula da kasuwa"),
        title: getCopy("Admin dashboard", "Allon admin"),
        description: getCopy("Control users, vendors, products, approvals, orders, payments, disputes, categories, reports, audit logs, and system health.", "Kula da masu amfani, dillalai, kaya, amincewa, ododi, biyan kuɗi, rikice-rikice, rukunai, rahotanni, tarihin aiki, da lafiyar tsarin."),
        actions: [
          { label: getCopy("Vendor approvals", "Amincewa da dillalai"), route: "admin/vendors" },
          { label: getCopy("System health", "Lafiyar tsarin"), route: "admin/system-health", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("admin", currentPath)}

      ${renderStatGrid([
        { label: getCopy("Total users", "Jimillar masu amfani"), value: data.counts.totalUsers, detail: getCopy("Registered accounts", "Asusun da aka yi rajista"), tone: "info" },
        { label: getCopy("Active vendors", "Dillalan da ke aiki"), value: data.counts.activeVendors, detail: `${data.counts.pendingVendorApprovals} ${getCopy("pending vendor approvals", "amincewa da dillalai ke jira")}`, tone: "success" },
        { label: getCopy("Pending approvals", "Amincewa da ke jira"), value: data.counts.pendingVendorApprovals + data.counts.pendingProductApprovals, detail: getCopy("Vendor and product queues", "Layukan dillalai da kaya"), tone: "warning" },
        { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: `${renderMoney(data.revenue.total)} GMV`, tone: "neutral" },
        { label: getCopy("Revenue", "Kuɗin shiga"), value: renderMoney(data.revenue.paid), detail: `${renderMoney(data.revenue.commission)} ${getCopy("commission", "kwamiti")}`, tone: "success" },
        { label: getCopy("Payment issues", "Matsalolin biya"), value: data.counts.failedPayments, detail: `${pendingPayments.length} ${getCopy("pending payments", "biyan kuɗi da ke jira")}`, tone: data.counts.failedPayments ? "danger" : "neutral" },
        { label: getCopy("Disputes", "Rikice-rikice"), value: data.counts.disputes, detail: getCopy("Requires dispute endpoint", "Ana buƙatar hanyar rikice-rikice"), tone: "neutral" },
        { label: getCopy("System alerts", "Gargaɗin tsarin"), value: data.counts.systemAlerts, detail: getCopy("Health checks pending", "Duba lafiyar tsarin na jira"), tone: "neutral" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: getCopy("Approvals", "Amincewa"),
          title: getCopy("Priority queues", "Layukan da suka fi muhimmanci"),
          action: { label: getCopy("Review vendors", "Duba dillalai"), route: "admin/vendors" },
          body: `
            <div class="dash-queue-grid">
              <article>
                <span>${getCopy("Vendor approvals", "Amincewa da dillalai")}</span>
                <strong>${data.counts.pendingVendorApprovals}</strong>
                <small>${getCopy("New sellers waiting for review", "Sabbin masu siyarwa na jiran duba")}</small>
              </article>
              <article>
                <span>${getCopy("Product moderation", "Duba kayan")}</span>
                <strong>${data.counts.pendingProductApprovals}</strong>
                <small>${getCopy("Listings waiting for catalog approval", "Kayan da ke jiran amincewa a cikin jerin")}</small>
              </article>
              <article>
                <span>${getCopy("Payout requests", "Buƙatun biya")}</span>
                <strong>${data.payouts.filter((payout) => payout.status === "pending").length}</strong>
                <small>${getCopy("Vendor settlement decisions", "Yanke shawara kan biyan dillalai")}</small>
              </article>
            </div>
            <div class="dash-legacy-queues">
              <div class="vendor-approval-list" id="vendorApprovals"></div>
              <div class="product-moderation-list" id="productModeration"></div>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Finance", "Kuɗi"),
          title: getCopy("Revenue and payment control", "Kula da kuɗin shiga da biyan kuɗi"),
          action: { label: getCopy("Payments", "Biyan kuɗi"), route: "admin/payments" },
          body: `
            <div class="dash-money-stack">
              <article><span>${getCopy("Paid volume", "Adadin da aka biya")}</span><strong>${renderMoney(data.revenue.paid)}</strong></article>
              <article><span>${getCopy("Pending", "Jira")}</span><strong>${renderMoney(data.revenue.pending)}</strong></article>
              <article><span>${getCopy("Refunded", "An mayar da kuɗi")}</span><strong>${renderMoney(data.revenue.refunded)}</strong></article>
              <article><span>${getCopy("Commission", "Kwamiti")}</span><strong>${renderMoney(data.revenue.commission)}</strong></article>
            </div>
            ${renderMiniRows(
              [...failedPayments, ...pendingPayments].slice(0, 5).map((payment) => ({
                title: payment.reference ?? payment.id,
                meta: `${payment.orderId} - ${payment.method ?? getCopy("payment", "biya")} - ${formatDate(payment.createdAt)}`,
                value: renderMoney(payment.amount),
                status: payment.status,
              })),
              { title: getCopy("No payment exceptions", "Babu matsalolin biya"), body: getCopy("Pending, failed, and refunded payment actions will appear here.", "Ayyukan biya da ke jira, waɗanda suka gaza, da waɗanda aka mayar da su za su bayyana a nan.") }
            )}
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Orders", "Ododi"),
          title: getCopy("Recent platform activity", "Ayyukan dandali na kwanan nan"),
          action: { label: getCopy("Orders", "Ododi"), route: "admin/orders" },
          body: renderMiniRows(
            recentOrders.map((order) => ({
              title: order.id,
              meta: `${"customerName" in order ? order.customerName : order.customerPhone ?? getCopy("Customer", "Kwastoma")} - ${formatDate(order.createdAt)}`,
              value: renderMoney(order.subtotal),
              status: order.status,
            })),
            { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here once checkout starts.", "Ododi na kwastoma za su bayyana a nan da zarar biyan kuɗi ya fara.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Catalog", "Jerin kaya"),
          title: getCopy("Products, categories, and reports", "Kaya, rukunai, da rahotanni"),
          action: { label: getCopy("Reports", "Rahotanni"), route: "admin/reports" },
          body: `
            <div class="dash-action-stack">
              <a class="dash-command-card" href="#admin/products" data-route="admin/products">
                <strong>${getCopy("Product control", "Kula da kaya")}</strong>
                <span>${data.counts.products} ${getCopy("products across approved, pending, hidden, and rejected states.", "kaya a cikin yanayin da aka amince, na jira, ɓoye, da waɗanda aka ƙi.")}</span>
              </a>
              <a class="dash-command-card" href="#admin/categories" data-route="admin/categories">
                <strong>${getCopy("Categories", "Rukunai")}</strong>
                <span>${getCopy("Manage bilingual taxonomy, search terms, and category merchandising.", "Kula da rarrabuwar harsuna biyu, kalmomi na bincike, da siyar da rukunai.")}</span>
              </a>
              <a class="dash-command-card" href="#admin/reports" data-route="admin/reports">
                <strong>${getCopy("Growth reports", "Rahotannin girma")}</strong>
                <span>${getCopy("Track customer growth, vendor growth, popular searches, and best sellers.", "Bi diddigin girmar kwastoma, girmar dillalai, bincike na yau da kullum, da mafi siyarwa.")}</span>
              </a>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Risk", "Haɗari"),
          title: getCopy("Reviews, disputes, and audit trail", "Ra'ayoyi, rikice-rikice, da tarihin aiki"),
          action: { label: getCopy("Audit logs", "Tarihin aiki"), route: "admin/audit-logs" },
          body: `
            ${renderMiniRows(
              data.reviews
                .filter((review) => !review.hidden)
                .slice(0, 5)
                .map((review) => ({
                  title: `${review.rating}/5 - ${review.reviewerName ?? getCopy("Customer", "Kwastoma")}`,
                  meta: review.comment,
                  status: "visible",
                })),
              { title: getCopy("No visible review risks", "Babu haɗarin ra'ayoyi da ake gani"), body: getCopy("Review moderation and dispute queues will appear here.", "Duba ra'ayoyi da layukan rikice-rikice za su bayyana a nan.") }
            )}
            <div class="dash-system-list">
              <article><strong>${getCopy("Disputes", "Rikice-rikice")}</strong><span>${getCopy("Endpoint required: /admin/disputes", "Ana buƙatar hanyar: /admin/disputes")}</span></article>
              <article><strong>${getCopy("Audit logs", "Tarihin aiki")}</strong><span>${getCopy("Endpoint required: /admin/audit-logs", "Ana buƙatar hanyar: /admin/audit-logs")}</span></article>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Infrastructure", "Ababen more rayuwa"),
          title: getCopy("System health", "Lafiyar tsarin"),
          action: { label: getCopy("Health", "Lafiya"), route: "admin/system-health" },
          body: `
            <div class="dash-health-grid">
              <article data-state="ok"><strong>API</strong><span>${getCopy("Health endpoint available", "Hanyar lafiya tana akwai")}</span></article>
              <article data-state="ok"><strong>${getCopy("Database", "Bayanan")}</strong><span>${getCopy("Reported by /api/health", "An ruwaito ta /api/health")}</span></article>
              <article data-state="pending"><strong>${getCopy("Blob storage", "Ajiyar fayiloli")}</strong><span>${getCopy("Add admin health probe", "Ƙara binciken lafiyar admin")}</span></article>
              <article data-state="pending"><strong>${getCopy("Email", "Imel")}</strong><span>${getCopy("Add delivery provider status", "Ƙara matsayin mai isar da imel")}</span></article>
            </div>
            ${renderEmptyState(getCopy("No critical alerts", "Babu gargaɗi mai mahimmanci"), getCopy("System alerts will show here once health probes and logging are connected.", "Gargaɗin tsarin za su bayyana a nan da zarar an haɗa binciken lafiya da yin log."))}
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Legacy operations", "Ayyukan da suka gabata"),
          title: getCopy("Existing admin controls", "Madafun admin da ake da su"),
          className: "dash-panel-wide",
          body: `
            <div class="dash-legacy-admin-grid">
              <div hidden>
                <span id="totalSearches"></span>
                <span id="failedSearches"></span>
                <span id="savedVendors"></span>
                <span id="topDemand"></span>
              </div>
              <div class="record-list" id="paymentStatus"></div>
              <div class="withdrawal-list" id="withdrawalQueue"></div>
              <div class="record-list" id="orderRecords"></div>
              <div class="review-moderation-list" id="reviewModeration"></div>
              <div id="vendorSubscriptionSummary"></div>
              <div id="advancedAnalytics"></div>
              <div id="phaseThreeControls"></div>
              <div id="popularSearches" hidden></div>
              <div id="failedSearchList" hidden></div>
              <div id="demandTrends" hidden></div>
              <table hidden><tbody id="searchHistoryTable"></tbody></table>
            </div>
          `,
        })}
      </div>
    </div>
  `;
}
