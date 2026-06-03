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
import { formatDate } from "../../utils";

export function renderAdminOverview(currentPath = "admin/overview"): string {
  const data = getAdminDashboardData();
  const pendingPayments = data.payments.filter((payment) => payment.status === "pending");
  const failedPayments = data.payments.filter((payment) => payment.status === "failed");
  const recentOrders = data.orders.slice(0, 6);

  return `
    <div class="dash-shell dash-shell-admin">
      ${renderDashboardHeader({
        eyebrow: "Marketplace control room",
        title: "Admin dashboard",
        description: "Control users, vendors, products, approvals, orders, payments, disputes, categories, reports, audit logs, and system health.",
        actions: [
          { label: "Vendor approvals", route: "admin/vendors" },
          { label: "System health", route: "admin/system-health", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("admin", currentPath)}

      ${renderStatGrid([
        { label: "Total users", value: data.counts.totalUsers, detail: "Registered accounts", tone: "info" },
        { label: "Active vendors", value: data.counts.activeVendors, detail: `${data.counts.pendingVendorApprovals} pending vendor approvals`, tone: "success" },
        { label: "Pending approvals", value: data.counts.pendingVendorApprovals + data.counts.pendingProductApprovals, detail: "Vendor and product queues", tone: "warning" },
        { label: "Total orders", value: data.counts.totalOrders, detail: `${renderMoney(data.revenue.total)} GMV`, tone: "neutral" },
        { label: "Revenue", value: renderMoney(data.revenue.paid), detail: `${renderMoney(data.revenue.commission)} commission`, tone: "success" },
        { label: "Payment issues", value: data.counts.failedPayments, detail: `${pendingPayments.length} pending payments`, tone: data.counts.failedPayments ? "danger" : "neutral" },
        { label: "Disputes", value: data.counts.disputes, detail: "Requires dispute endpoint", tone: "neutral" },
        { label: "System alerts", value: data.counts.systemAlerts, detail: "Health checks pending", tone: "neutral" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: "Approvals",
          title: "Priority queues",
          action: { label: "Review vendors", route: "admin/vendors" },
          body: `
            <div class="dash-queue-grid">
              <article>
                <span>Vendor approvals</span>
                <strong>${data.counts.pendingVendorApprovals}</strong>
                <small>New sellers waiting for review</small>
              </article>
              <article>
                <span>Product moderation</span>
                <strong>${data.counts.pendingProductApprovals}</strong>
                <small>Listings waiting for catalog approval</small>
              </article>
              <article>
                <span>Payout requests</span>
                <strong>${data.payouts.filter((payout) => payout.status === "pending").length}</strong>
                <small>Vendor settlement decisions</small>
              </article>
            </div>
            <div class="dash-legacy-queues">
              <div class="vendor-approval-list" id="vendorApprovals"></div>
              <div class="product-moderation-list" id="productModeration"></div>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: "Finance",
          title: "Revenue and payment control",
          action: { label: "Payments", route: "admin/payments" },
          body: `
            <div class="dash-money-stack">
              <article><span>Paid volume</span><strong>${renderMoney(data.revenue.paid)}</strong></article>
              <article><span>Pending</span><strong>${renderMoney(data.revenue.pending)}</strong></article>
              <article><span>Refunded</span><strong>${renderMoney(data.revenue.refunded)}</strong></article>
              <article><span>Commission</span><strong>${renderMoney(data.revenue.commission)}</strong></article>
            </div>
            ${renderMiniRows(
              [...failedPayments, ...pendingPayments].slice(0, 5).map((payment) => ({
                title: payment.reference ?? payment.id,
                meta: `${payment.orderId} - ${payment.method ?? "payment"} - ${formatDate(payment.createdAt)}`,
                value: renderMoney(payment.amount),
                status: payment.status,
              })),
              { title: "No payment exceptions", body: "Pending, failed, and refunded payment actions will appear here." }
            )}
          `,
        })}

        ${renderPanel({
          eyebrow: "Orders",
          title: "Recent platform activity",
          action: { label: "Orders", route: "admin/orders" },
          body: renderMiniRows(
            recentOrders.map((order) => ({
              title: order.id,
              meta: `${"customerName" in order ? order.customerName : order.customerPhone ?? "Customer"} - ${formatDate(order.createdAt)}`,
              value: renderMoney(order.subtotal),
              status: order.status,
            })),
            { title: "No orders yet", body: "Customer orders will appear here once checkout starts." }
          ),
        })}

        ${renderPanel({
          eyebrow: "Catalog",
          title: "Products, categories, and reports",
          action: { label: "Reports", route: "admin/reports" },
          body: `
            <div class="dash-action-stack">
              <a class="dash-command-card" href="#admin/products" data-route="admin/products">
                <strong>Product control</strong>
                <span>${data.counts.products} products across approved, pending, hidden, and rejected states.</span>
              </a>
              <a class="dash-command-card" href="#admin/categories" data-route="admin/categories">
                <strong>Categories</strong>
                <span>Manage bilingual taxonomy, search terms, and category merchandising.</span>
              </a>
              <a class="dash-command-card" href="#admin/reports" data-route="admin/reports">
                <strong>Growth reports</strong>
                <span>Track customer growth, vendor growth, popular searches, and best sellers.</span>
              </a>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: "Risk",
          title: "Reviews, disputes, and audit trail",
          action: { label: "Audit logs", route: "admin/audit-logs" },
          body: `
            ${renderMiniRows(
              data.reviews
                .filter((review) => !review.hidden)
                .slice(0, 5)
                .map((review) => ({
                  title: `${review.rating}/5 - ${review.reviewerName ?? "Customer"}`,
                  meta: review.comment,
                  status: "visible",
                })),
              { title: "No visible review risks", body: "Review moderation and dispute queues will appear here." }
            )}
            <div class="dash-system-list">
              <article><strong>Disputes</strong><span>Endpoint required: /admin/disputes</span></article>
              <article><strong>Audit logs</strong><span>Endpoint required: /admin/audit-logs</span></article>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: "Infrastructure",
          title: "System health",
          action: { label: "Health", route: "admin/system-health" },
          body: `
            <div class="dash-health-grid">
              <article data-state="ok"><strong>API</strong><span>Health endpoint available</span></article>
              <article data-state="ok"><strong>Database</strong><span>Reported by /api/health</span></article>
              <article data-state="pending"><strong>Blob storage</strong><span>Add admin health probe</span></article>
              <article data-state="pending"><strong>Email</strong><span>Add delivery provider status</span></article>
            </div>
            ${renderEmptyState("No critical alerts", "System alerts will show here once health probes and logging are connected.")}
          `,
        })}

        ${renderPanel({
          eyebrow: "Legacy operations",
          title: "Existing admin controls",
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
