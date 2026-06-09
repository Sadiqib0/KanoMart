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
import { escapeHtml, formatDate, getCopy, getLocalizedValue } from "../../utils";

type AnyAction = { label: string; route?: string; tone?: "primary" | "secondary" };

function shell(currentPath: string, eyebrow: string, title: string, description: string, actions: AnyAction[], body: string): string {
  return `
    <div class="dash-shell dash-shell-admin">
      ${renderDashboardHeader({ eyebrow, title, description, actions })}
      ${renderRoleDashboardNav("admin", currentPath)}
      ${body}
    </div>
  `;
}

type UserLike = { phone: string; name?: string; email?: string; role: string; createdAt?: string; id?: string; vendorStatus?: string };

function asUsers(list: ReturnType<typeof getAdminDashboardData>["users"]): UserLike[] {
  return list as unknown as UserLike[];
}

function renderUsersPage(data: ReturnType<typeof getAdminDashboardData>): string {
  const rows = asUsers(data.users).map((u) => `
    <div class="dash-table-row">
      <div class="dash-table-cell"><strong>${escapeHtml(u.name ?? u.phone)}</strong><small>${escapeHtml(u.email ?? "")}</small></div>
      <div class="dash-table-cell"><span class="dash-badge dash-badge--${escapeHtml(u.role)}">${escapeHtml(u.role)}</span></div>
      <div class="dash-table-cell">${escapeHtml(u.phone)}</div>
      <div class="dash-table-cell"><time>${u.createdAt ? formatDate(u.createdAt) : "—"}</time></div>
    </div>
  `).join("");

  return shell("admin/users",
    getCopy("Users", "Masu amfani"),
    getCopy("All platform users", "Dukkan masu amfani a dandalin"),
    getCopy("View and manage every registered account — customers, vendors, and admins.", "Duba da sarrafa kowane asusun da aka yi rajista — kwastoma, dillalai, da admin."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Registry", "Rajista"),
        title: `${data.users.length} ${getCopy("users", "masu amfani")}`,
        body: data.users.length
          ? `<div class="dash-table"><div class="dash-table-head"><span>${getCopy("Name", "Suna")}</span><span>${getCopy("Role", "Matsayi")}</span><span>${getCopy("Phone", "Waya")}</span><span>${getCopy("Joined", "Ranar shiga")}</span></div>${rows}</div>`
          : renderEmptyState(getCopy("No users yet", "Babu masu amfani tukuna"), getCopy("User accounts will appear here once people sign up.", "Asusun masu amfani za su bayyana a nan da zarar mutane suka yi rajista.")),
      })}
    </div>`
  );
}

function renderVendorsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  const allUsers = asUsers(data.users);
  const pendingVendors = allUsers.filter((u) => u.role === "vendor" && u.vendorStatus === "pending");
  const approvedVendors = allUsers.filter((u) => u.role === "vendor" && u.vendorStatus === "approved");

  function vendorRows(list: UserLike[], showActions: boolean): string {
    return list.map((u) => `
      <div class="dash-mini-row" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">
        <div class="dash-mini-row-main">
          <strong>${escapeHtml(u.name ?? u.phone)}</strong>
          <span>${escapeHtml(u.phone)} · ${u.createdAt ? formatDate(u.createdAt) : "—"}</span>
        </div>
        <div class="dash-mini-row-aside">
          <span class="dash-badge dash-badge--${escapeHtml(u.vendorStatus ?? "pending")}">${escapeHtml(u.vendorStatus ?? "pending")}</span>
          ${showActions ? `
            <button type="button" class="btn btn-sm btn-success admin-approve-vendor" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">${getCopy("Approve", "Amince")}</button>
            <button type="button" class="btn btn-sm btn-danger admin-reject-vendor" data-vendor-id="${escapeHtml(u.id ?? u.phone)}">${getCopy("Reject", "Ƙi")}</button>
          ` : ""}
        </div>
      </div>
    `).join("");
  }

  return shell("admin/vendors",
    getCopy("Vendors", "Dillalai"),
    getCopy("Vendor management", "Sarrafa dillalai"),
    getCopy("Review applications, approve new vendors, and manage existing vendor accounts.", "Duba aikace-aikace, amince da sabbin dillalai, da sarrafa asusun dillalai masu akwai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Queue", "Layi"),
        title: `${pendingVendors.length} ${getCopy("pending applications", "aikace-aikacen da ke jira")}`,
        body: pendingVendors.length
          ? `<div class="dash-mini-rows">${vendorRows(pendingVendors, true)}</div>`
          : renderEmptyState(getCopy("No pending applications", "Babu aikace-aikacen da ke jira"), getCopy("New vendor applications will appear here for review.", "Sabbin aikace-aikacen dillalai za su bayyana a nan don duba.")),
      })}
      ${renderPanel({
        eyebrow: getCopy("Active", "Masu aiki"),
        title: `${approvedVendors.length} ${getCopy("approved vendors", "dillalai da aka amince")}`,
        body: approvedVendors.length
          ? `<div class="dash-mini-rows">${vendorRows(approvedVendors, false)}</div>`
          : renderEmptyState(getCopy("No approved vendors", "Babu dillalai da aka amince"), ""),
      })}
      <div id="vendorApprovals" class="dash-legacy-queues" hidden></div>
    </div>`
  );
}

function renderProductsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  return shell("admin/products",
    getCopy("Catalog", "Jerin kaya"),
    getCopy("Product moderation", "Duba kayan"),
    getCopy("Approve, hide, or reject vendor product listings before they appear in the public catalog.", "Amince, ɓoye, ko ƙi jerin kayan dillalai kafin su bayyana a cikin jerin kayan jama'a."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("All products", "Dukkan kaya"),
        title: `${data.counts.products} ${getCopy("listed products", "kayan da ke cikin jeri")}`,
        body: `<div class="product-moderation-list" id="productModeration"></div>${renderEmptyState(getCopy("Product list loading…", "Ana loda jerin kaya…"), getCopy("Admin product actions will populate here from live data.", "Ayyukan kayan admin za su cika a nan daga bayanan masu rai."))}`,
      })}
    </div>`
  );
}

function renderOrdersPage(data: ReturnType<typeof getAdminDashboardData>): string {
  return shell("admin/orders",
    getCopy("Operations", "Ayyuka"),
    getCopy("All orders", "Dukkan ododi"),
    getCopy("View and manage every customer order on the platform.", "Duba da sarrafa kowane oda na kwastoma a dandalin."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Orders", "Ododi"),
        title: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`,
        body: renderMiniRows(
          data.orders.slice(0, 20).map((o) => ({
            title: `#${o.id.slice(-6).toUpperCase()} · ${"customerName" in o ? (o as { customerName?: string }).customerName ?? "" : ""}`,
            meta: `${formatDate(o.createdAt)} · ${"paymentStatus" in o ? (o as { paymentStatus?: string }).paymentStatus ?? "" : ""}`,
            value: renderMoney("subtotal" in o ? (o as { subtotal?: number }).subtotal : undefined),
            status: o.status,
          })),
          { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here.", "Ododi na kwastoma za su bayyana a nan.") }
        ),
      })}
      <div class="record-list" id="orderRecords" hidden></div>
    </div>`
  );
}

function renderPaymentsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  const pending = data.payments.filter((p) => p.status === "pending");
  const failed = data.payments.filter((p) => p.status === "failed");

  return shell("admin/payments",
    getCopy("Finance", "Kuɗi"),
    getCopy("Payment control", "Kula da biyan kuɗi"),
    getCopy("Verify, approve, and audit all platform payment transactions.", "Tabbatar, amince, da duba dukkan ma'amalolin biya a dandalin."),
    [],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
        { label: getCopy("Paid volume", "Adadin da aka biya"), value: renderMoney(data.revenue.paid), detail: getCopy("Total confirmed payments", "Jimillar biyan kuɗi da aka tabbatar"), tone: "success" },
        { label: getCopy("Pending", "Jira"), value: pending.length, detail: renderMoney(data.revenue.pending), tone: "warning" },
        { label: getCopy("Failed", "Ya gaza"), value: failed.length, detail: getCopy("Requires action", "Yana buƙatar aiki"), tone: failed.length ? "danger" : "neutral" },
        { label: getCopy("Commission", "Kwamiti"), value: renderMoney(data.revenue.commission), detail: getCopy("Platform earnings", "Kuɗin dandalin"), tone: "info" },
      ])}
      ${renderPanel({
        eyebrow: getCopy("Exceptions", "Matsaloli"),
        title: getCopy("Pending and failed payments", "Biyan kuɗi da ke jira da waɗanda suka gaza"),
        body: renderMiniRows(
          [...failed, ...pending].slice(0, 10).map((p) => ({
            title: p.reference ?? p.id,
            meta: `${p.method ?? "—"} · ${formatDate(p.createdAt)}`,
            value: renderMoney(p.amount),
            status: p.status,
          })),
          { title: getCopy("No payment exceptions", "Babu matsalolin biya"), body: getCopy("Failed and pending payment alerts appear here.", "Gargaɗin biya da ya gaza da na jira suna bayyana a nan.") }
        ),
      })}
      <div class="record-list" id="paymentStatus" hidden></div>
    </div>`
  );
}

function renderPayoutsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  const pending = data.payouts.filter((p) => p.status === "pending");

  return shell("admin/payouts",
    getCopy("Finance", "Kuɗi"),
    getCopy("Vendor payouts", "Biyan dillalai"),
    getCopy("Review and process vendor settlement requests.", "Duba da aiwatar da buƙatun tantancewa na dillalai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Queue", "Layi"),
        title: `${pending.length} ${getCopy("pending payout requests", "buƙatun biya da ke jira")}`,
        body: pending.length
          ? `<div class="dash-mini-rows">${pending.map((p) => `
              <div class="dash-mini-row" data-payout-id="${escapeHtml(p.id)}">
                <div class="dash-mini-row-main">
                  <strong>${escapeHtml(p.accountName ?? "—")} · ${escapeHtml(p.bankName ?? "—")}</strong>
                  <span>${escapeHtml(p.accountNumber ?? "—")} · ${p.requestedAt ? formatDate(p.requestedAt) : "—"}</span>
                </div>
                <div class="dash-mini-row-aside">
                  <b>${renderMoney(p.amount)}</b>
                  <button type="button" class="btn btn-sm btn-success admin-approve-payout" data-payout-id="${escapeHtml(p.id)}">${getCopy("Approve", "Amince")}</button>
                  <button type="button" class="btn btn-sm btn-danger admin-reject-payout" data-payout-id="${escapeHtml(p.id)}">${getCopy("Reject", "Ƙi")}</button>
                </div>
              </div>
            `).join("")}</div>`
          : renderEmptyState(getCopy("No pending payouts", "Babu biyan kuɗi da ke jira"), getCopy("Vendor payout requests will appear here for action.", "Buƙatun biyan dillalai za su bayyana a nan don aiki.")),
      })}
      ${renderPanel({
        eyebrow: getCopy("History", "Tarihi"),
        title: getCopy("All payout requests", "Dukkan buƙatun biya"),
        body: renderMiniRows(
          data.payouts.map((p) => ({ title: p.accountName ?? p.id, meta: `${p.bankName ?? "—"} · ${p.requestedAt ? formatDate(p.requestedAt) : "—"}`, value: renderMoney(p.amount), status: p.status })),
          { title: getCopy("No payouts", "Babu biyan kuɗi"), body: "" }
        ),
      })}
      <div class="withdrawal-list" id="withdrawalQueue" hidden></div>
    </div>`
  );
}

function renderReviewsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  return shell("admin/reviews",
    getCopy("Trust", "Amana"),
    getCopy("Review moderation", "Duba ra'ayoyi"),
    getCopy("Hide or restore product reviews to maintain catalog quality.", "Ɓoye ko maido da ra'ayoyin kayan don kula da ingancin jerin kaya."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Reviews", "Ra'ayoyi"),
        title: `${data.reviews.length} ${getCopy("platform reviews", "ra'ayoyin dandalin")}`,
        body: data.reviews.length
          ? `<div class="dash-notification-stack">${data.reviews.slice(0, 20).map((r) => `
              <article class="dash-review-item" data-review-id="${escapeHtml(r.id)}">
                <div class="dash-review-rating">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
                <div class="dash-review-body">
                  <strong>${escapeHtml(r.reviewerName ?? getCopy("Customer", "Kwastoma"))}</strong>
                  <span>${escapeHtml(r.comment)}</span>
                  <time>${formatDate(r.createdAt)}</time>
                </div>
                <button type="button" class="btn btn-sm ${r.hidden ? "btn-ghost" : "btn-danger-ghost"} admin-toggle-review" data-review-id="${escapeHtml(r.id)}" data-hidden="${r.hidden ? "true" : "false"}">
                  ${r.hidden ? getCopy("Restore", "Maido") : getCopy("Hide", "Ɓoye")}
                </button>
              </article>
            `).join("")}</div>`
          : renderEmptyState(getCopy("No reviews yet", "Babu ra'ayoyi tukuna"), getCopy("Customer product reviews will appear here for moderation.", "Ra'ayoyin kayan kwastoma za su bayyana a nan don duba.")),
      })}
      <div class="review-moderation-list" id="reviewModeration" hidden></div>
    </div>`
  );
}

function renderPromotionsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  return shell("admin/promotions",
    getCopy("Marketing", "Talla"),
    getCopy("Promotions", "Yanayin farashi na musamman"),
    getCopy("Create and manage discount codes, flash sales, and category promotions.", "Ƙirƙira da sarrafa lambobin rangwame, siyarwa ta gaggawa, da yanayin farashi na rukunai."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Active", "Masu aiki"),
        title: `${data.promotions.filter((p) => p.active).length} ${getCopy("active promotions", "yanayin farashi na musamman masu aiki")}`,
        body: data.promotions.length
          ? renderMiniRows(
              data.promotions.map((p) => ({
                title: getLocalizedValue({ en: p.title.en ?? "", ha: p.title.ha ?? "" }),
                meta: `${p.type} · ${p.discountPercent ? `${p.discountPercent}% off` : p.code ?? "—"}`,
                status: p.active ? "active" : "inactive",
              })),
              { title: getCopy("No promotions", "Babu yanayin farashi na musamman"), body: "" }
            )
          : renderEmptyState(getCopy("No promotions yet", "Babu yanayin farashi na musamman tukuna"), getCopy("Create promotions to boost catalog visibility and sales.", "Ƙirƙira yanayin farashi na musamman don ƙara bayyanuwar jerin kaya da siyarwa.")),
      })}
    </div>`
  );
}

function renderReportsPage(data: ReturnType<typeof getAdminDashboardData>): string {
  return shell("admin/reports",
    getCopy("Analytics", "Nazari"),
    getCopy("Growth reports", "Rahotannin girma"),
    getCopy("Track platform performance, user growth, product views, and revenue trends.", "Bin diddigin aiwatarwar dandalin, girmar masu amfani, ra'ayoyin kaya, da yanayin kuɗin shiga."),
    [],
    `<div class="dash-overview-grid">
      ${renderStatGrid([
        { label: getCopy("Total GMV", "Jimillar GMV"), value: renderMoney(data.revenue.total), detail: getCopy("Gross merchandise value", "Jimillar darajar kaya"), tone: "success" },
        { label: getCopy("Commission earned", "Kwamiti da aka samu"), value: renderMoney(data.revenue.commission), detail: getCopy("Platform revenue", "Kuɗin dandalin"), tone: "info" },
        { label: getCopy("Total users", "Jimillar masu amfani"), value: data.counts.totalUsers, detail: getCopy("Registered accounts", "Asusun da aka yi rajista"), tone: "neutral" },
        { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: getCopy("All time", "A kowane lokaci"), tone: "neutral" },
      ])}
      ${renderPanel({
        eyebrow: getCopy("Analytics", "Nazari"),
        title: getCopy("Best sellers and search trends", "Mafi siyarwa da yanayin bincike"),
        body: data.analytics?.bestSellingProducts?.length
          ? renderMiniRows(
              data.analytics.bestSellingProducts.slice(0, 8).map((item) => ({
                title: item.productId,
                meta: `${item.quantity} ${getCopy("sold", "an saya")} · ${renderMoney(item.sales)}`,
                status: "active",
              })),
              { title: getCopy("No analytics data", "Babu bayanan nazari"), body: "" }
            )
          : renderEmptyState(getCopy("Analytics loading", "Ana loda nazari"), getCopy("Connect /admin/analytics endpoint to see live platform data.", "Haɗa hanyar /admin/analytics don ganin bayanan dandalin masu rai.")),
      })}
      <div id="advancedAnalytics" hidden></div>
    </div>`
  );
}

function renderSystemHealthPage(): string {
  return shell("admin/system-health",
    getCopy("Infrastructure", "Ababen more rayuwa"),
    getCopy("System health", "Lafiyar tsarin"),
    getCopy("Monitor API uptime, database connectivity, storage, and email delivery.", "Sa ido kan lokacin aiki na API, haɗin bayanan, ajiya, da isar da imel."),
    [],
    `<div class="dash-overview-grid">
      ${renderPanel({
        eyebrow: getCopy("Health checks", "Duba lafiya"),
        title: getCopy("Service status", "Yanayin sabis"),
        body: `
          <div class="dash-health-grid">
            <article data-state="ok"><strong>API</strong><span>${getCopy("Health endpoint available at /api/health", "Hanyar lafiya tana akwai a /api/health")}</span></article>
            <article data-state="ok"><strong>${getCopy("Database", "Bayanan")}</strong><span>${getCopy("Reported by /api/health", "An ruwaito ta /api/health")}</span></article>
            <article data-state="pending"><strong>${getCopy("Blob storage", "Ajiyar fayiloli")}</strong><span>${getCopy("Add health probe to backend", "Ƙara binciken lafiya zuwa ɓangaren baya")}</span></article>
            <article data-state="pending"><strong>${getCopy("Email / notifications", "Imel / sanarwa")}</strong><span>${getCopy("Add delivery provider status check", "Ƙara duba matsayin mai isar da imel")}</span></article>
            <article data-state="pending"><strong>${getCopy("Error tracking", "Bin diddigin kuskure")}</strong><span>${getCopy("Connect Sentry or equivalent", "Haɗa Sentry ko mai kama da shi")}</span></article>
          </div>
        `,
      })}
    </div>`
  );
}

export function renderAdminOverview(currentPath = "admin/overview"): string {
  const data = getAdminDashboardData();

  if (currentPath === "admin/users") return renderUsersPage(data);
  if (currentPath === "admin/vendors") return renderVendorsPage(data);
  if (currentPath === "admin/products") return renderProductsPage(data);
  if (currentPath === "admin/orders") return renderOrdersPage(data);
  if (currentPath === "admin/payments") return renderPaymentsPage(data);
  if (currentPath === "admin/payouts") return renderPayoutsPage(data);
  if (currentPath === "admin/reviews") return renderReviewsPage(data);
  if (currentPath === "admin/promotions") return renderPromotionsPage(data);
  if (currentPath === "admin/reports") return renderReportsPage(data);
  if (currentPath === "admin/system-health") return renderSystemHealthPage();

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
        { label: getCopy("Active vendors", "Dillalan da ke aiki"), value: data.counts.activeVendors, detail: `${data.counts.pendingVendorApprovals} ${getCopy("pending", "jira")}`, tone: "success" },
        { label: getCopy("Pending approvals", "Amincewa da ke jira"), value: data.counts.pendingVendorApprovals + data.counts.pendingProductApprovals, detail: getCopy("Vendor and product queues", "Layukan dillalai da kaya"), tone: "warning" },
        { label: getCopy("Total orders", "Jimillar ododi"), value: data.counts.totalOrders, detail: `${renderMoney(data.revenue.total)} GMV`, tone: "neutral" },
        { label: getCopy("Revenue", "Kuɗin shiga"), value: renderMoney(data.revenue.paid), detail: `${renderMoney(data.revenue.commission)} ${getCopy("commission", "kwamiti")}`, tone: "success" },
        { label: getCopy("Payment issues", "Matsalolin biya"), value: data.counts.failedPayments, detail: `${pendingPayments.length} ${getCopy("pending", "jira")}`, tone: data.counts.failedPayments ? "danger" : "neutral" },
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
                <small>${getCopy("Listings waiting for catalog approval", "Kayan da ke jiran amincewa a cikin jeri")}</small>
              </article>
              <article>
                <span>${getCopy("Payout requests", "Buƙatun biya")}</span>
                <strong>${data.payouts.filter((p) => p.status === "pending").length}</strong>
                <small>${getCopy("Vendor settlement decisions", "Yanke shawara kan biyan dillalai")}</small>
              </article>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Finance", "Kuɗi"),
          title: getCopy("Revenue and payment control", "Kula da kuɗin shiga da biyan kuɗi"),
          action: { label: getCopy("Payments", "Biyan kuɗi"), route: "admin/payments" },
          body: `
            <div class="dash-money-stack">
              <div class="dash-money-line"><span>${getCopy("Paid volume", "Adadin da aka biya")}</span><b>${renderMoney(data.revenue.paid)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Pending", "Jira")}</span><b>${renderMoney(data.revenue.pending)}</b></div>
              <div class="dash-money-line"><span>${getCopy("Refunded", "An mayar da kuɗi")}</span><b>${renderMoney(data.revenue.refunded)}</b></div>
              <div class="dash-money-line dash-money-total"><span>${getCopy("Commission", "Kwamiti")}</span><b>${renderMoney(data.revenue.commission)}</b></div>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Orders", "Ododi"),
          title: getCopy("Recent platform activity", "Ayyukan dandali na kwanan nan"),
          action: { label: getCopy("Orders", "Ododi"), route: "admin/orders" },
          body: renderMiniRows(
            recentOrders.map((order) => ({
              title: `#${order.id.slice(-6).toUpperCase()}`,
              meta: `${"customerName" in order ? (order as { customerName?: string }).customerName ?? "" : ""} · ${formatDate(order.createdAt)}`,
              value: renderMoney("subtotal" in order ? (order as { subtotal?: number }).subtotal : undefined),
              status: order.status,
            })),
            { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Customer orders will appear here once checkout starts.", "Ododi na kwastoma za su bayyana a nan da zarar biyan kuɗi ya fara.") }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Catalog", "Jerin kaya"),
          title: getCopy("Quick links", "Hanyoyin sauri"),
          body: `
            <div class="dash-action-stack">
              <a class="dash-command-card" href="#admin/products" data-route="admin/products">
                <strong>${getCopy("Product control", "Kula da kaya")}</strong>
                <span>${data.counts.products} ${getCopy("products across all moderation states", "kaya a cikin yanayin duba duka")}</span>
              </a>
              <a class="dash-command-card" href="#admin/users" data-route="admin/users">
                <strong>${getCopy("User management", "Sarrafa masu amfani")}</strong>
                <span>${data.counts.totalUsers} ${getCopy("registered accounts", "asusun da aka yi rajista")}</span>
              </a>
              <a class="dash-command-card" href="#admin/reports" data-route="admin/reports">
                <strong>${getCopy("Growth reports", "Rahotannin girma")}</strong>
                <span>${getCopy("Track customer and vendor growth, popular searches, best sellers.", "Bin diddigin girmar kwastoma da dillalai, bincike na yau da kullum, mafi siyarwa.")}</span>
              </a>
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
          `,
        })}
      </div>

      <div hidden>
        <div class="record-list" id="paymentStatus"></div>
        <div class="withdrawal-list" id="withdrawalQueue"></div>
        <div class="record-list" id="orderRecords"></div>
        <div class="review-moderation-list" id="reviewModeration"></div>
        <div class="vendor-approval-list" id="vendorApprovals"></div>
        <div class="product-moderation-list" id="productModeration"></div>
        <div id="vendorSubscriptionSummary"></div>
        <div id="advancedAnalytics"></div>
        <div id="phaseThreeControls"></div>
        <div id="popularSearches"></div>
        <div id="failedSearchList"></div>
        <div id="demandTrends"></div>
        <table><tbody id="searchHistoryTable"></tbody></table>
      </div>
    </div>
  `;
}
