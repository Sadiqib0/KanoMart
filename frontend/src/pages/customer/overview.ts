import type { UserSession } from "../../../backend/types";
import { getCustomerDashboardData } from "../../services/dashboard-data";
import { getCartItems, getCartSubtotal } from "../../cart";
import { getWishlist } from "../../wishlist";
import {
  renderDashboardHeader,
  renderDashboardNote,
  renderEmptyState,
  renderMiniRows,
  renderMoney,
  renderPanel,
  renderStatGrid,
  renderStatusBadge,
  type ActionInput,
} from "../../components/dashboard/primitives";
import { renderDashShell } from "../../components/dashboard/shell";
import type { DashboardRole } from "../../router/dashboard-routes";
import { escapeHtml, formatDate, getCopy, getLocalizedValue, parsePrice } from "../../utils";
import { getCatalogProducts } from "../../../backend/products";

function shell(role: DashboardRole, currentPath: string, eyebrow: string, title: string, description: string, actions: ActionInput[], body: string): string {
  return renderDashShell(role, currentPath, `
    ${renderDashboardHeader({ eyebrow, title, description, actions })}
    <div class="dash-overview-grid">${body}</div>
  `);
}

function renderOrdersPage(user: UserSession, data: ReturnType<typeof getCustomerDashboardData>): string {
  const visibleOrders = data.orders.slice(0, 30);
  const rows = visibleOrders.map((order) => ({
    title: `Order ${order.id.slice(-6).toUpperCase()}`,
    meta: `${formatDate(order.createdAt)} · ${order.items.slice(0, 2).join(", ") || "items"}`,
    value: renderMoney(order.total),
    status: order.status,
  }));
  const limitNote = data.orders.length > visibleOrders.length
    ? renderDashboardNote(getCopy(`Showing latest ${visibleOrders.length} of ${data.orders.length} orders for faster rendering.`, `Ana nuna sabbin oda ${visibleOrders.length} daga ${data.orders.length} don saurin aiki.`))
    : "";

  return shell("customer", "customer/orders",
    getCopy("Fulfillment", "Cika oda"),
    getCopy("Your orders", "Ododinka"),
    getCopy("Track active deliveries, view completed purchases, and request support on any order.", "Bi diddigin isar da kaya masu aiki, duba siyayya da aka kammala, da neman tallafi akan kowane oda."),
    [{ label: getCopy("Continue shopping", "Ci gaba da siyayya"), route: "catalog" }],
    `
      ${renderPanel({
        eyebrow: getCopy("Active", "Masu aiki"),
        title: getCopy("Orders in progress", "Ododi da ake aiki da su"),
        body: renderMiniRows(
          data.activeOrders.map((o) => ({ title: `#${o.id.slice(-6).toUpperCase()}`, meta: formatDate(o.createdAt), value: renderMoney(o.total), status: o.status })),
          { title: getCopy("No active orders", "Babu ododi masu aiki"), body: getCopy("Your in-progress orders will appear here.", "Ododinka da ke tafiya za su bayyana a nan."), action: { label: getCopy("Shop now", "Saya yanzu"), route: "catalog" } }
        ),
      })}
      ${renderPanel({
        eyebrow: getCopy("History", "Tarihi"),
        title: getCopy("All orders", "Dukkan ododi"),
        body: `${renderMiniRows(rows, { title: getCopy("No orders yet", "Babu ododi tukuna"), body: getCopy("Place your first order to see it here.", "Yi odona farko don ganin sa a nan.") })}${limitNote}`,
      })}
    `
  );
}

function renderCartPage(user: UserSession, data: ReturnType<typeof getCustomerDashboardData>): string {
  const cartItems = getCartItems();
  const products = getCatalogProducts();

  const cartRows = cartItems.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    const name = product ? getLocalizedValue(product.name) : item.productId;
    return `
      <div class="dash-mini-row">
        <div class="dash-mini-row-main">
          <strong>${escapeHtml(name)}</strong>
          <span>${getCopy("Qty", "Yawa")}: ${item.quantity}</span>
        </div>
        <div class="dash-mini-row-aside">
          <b>${renderMoney(product ? parsePrice(product.price) * item.quantity : 0)}</b>
          <div class="dash-mini-row-actions">
            <button type="button" class="btn btn-sm btn-ghost cart-qty-dec" data-product-id="${escapeHtml(item.productId)}">−</button>
            <button type="button" class="btn btn-sm btn-ghost cart-qty-inc" data-product-id="${escapeHtml(item.productId)}">+</button>
            <button type="button" class="btn btn-sm btn-danger-ghost cart-remove" data-product-id="${escapeHtml(item.productId)}">${getCopy("Remove", "Cire")}</button>
          </div>
        </div>
      </div>
    `;
  });

  const summary = cartItems.length
    ? `
      <div class="dash-money-stack">
        <div class="dash-money-line"><span>${getCopy("Items", "Kaya")}</span><b>${data.cartCount}</b></div>
        <div class="dash-money-line dash-money-total"><span>${getCopy("Subtotal", "Jimilar farko")}</span><b>${renderMoney(data.cartSubtotal)}</b></div>
        <div class="dash-money-actions">
          <button type="button" class="btn btn-primary" id="checkoutFromCartBtn">${getCopy("Proceed to checkout", "Tafi biyan kuɗi")}</button>
          <a href="#catalog" class="btn btn-ghost">${getCopy("Continue shopping", "Ci gaba da siyayya")}</a>
        </div>
      </div>
    `
    : renderEmptyState(getCopy("Cart is empty", "Kwandon saya yana wofi"), getCopy("Browse products and add items to your cart.", "Duba kaya ka saka su a kwandon saya."), { label: getCopy("Browse catalog", "Duba jerin kaya"), route: "catalog" });

  return shell("customer", "customer/cart",
    getCopy("Shopping", "Siyayya"),
    getCopy("Your cart", "Kwandon sayanka"),
    getCopy("Review items, update quantities, and proceed to checkout.", "Duba kaya, sabunta yawa, ka tafi biyan kuɗi."),
    [],
    `
      ${renderPanel({ eyebrow: getCopy("Items", "Kaya"), title: getCopy("Cart contents", "Abubuwan da ke cikin kwandon saya"), body: cartItems.length ? `<div class="dash-mini-rows">${cartRows.join("")}</div>` : renderEmptyState(getCopy("No items in cart", "Babu kaya a kwandon saya"), "") })}
      ${renderPanel({ eyebrow: getCopy("Summary", "Taƙaitaccen bayani"), title: getCopy("Order summary", "Taƙaitaccen oda"), body: summary })}
    `
  );
}

function renderWishlistPage(user: UserSession, data: ReturnType<typeof getCustomerDashboardData>): string {
  const wishlistIds = getWishlist();
  const products = getCatalogProducts().filter((p) => wishlistIds.includes(p.id));

  const rows = products.map((p) => ({
    title: getLocalizedValue(p.name),
    meta: `${p.vendor} · ${getCopy("In stock", "Yana cikin ajiya")}: ${p.quantityAvailable ?? 0}`,
    value: renderMoney(parsePrice(p.price)),
    status: (p.quantityAvailable ?? 0) > 0 ? "available" : "out_of_stock",
  }));

  return shell("customer", "customer/wishlist",
    getCopy("Discovery", "Bincike"),
    getCopy("Wishlist", "Jerin abubuwan da ake so"),
    getCopy("Products you've saved for later. Add to cart when ready.", "Kayan da ka ajiye don daga baya. Saka a kwandon saya idan ka shirya."),
    [{ label: getCopy("Browse more", "Duba ƙari"), route: "catalog" }],
    renderPanel({ eyebrow: getCopy("Saved", "Da aka ajiye"), title: `${wishlistIds.length} ${getCopy("products", "kaya")}`, body: renderMiniRows(rows, { title: getCopy("Wishlist is empty", "Jerin abubuwan da ake so yana wofi"), body: getCopy("Save products from the catalog to see them here.", "Ajiye kaya daga jerin don ganin su a nan."), action: { label: getCopy("Explore catalog", "Bincika jerin kaya"), route: "catalog" } }) })
  );
}

function renderNotificationsPage(user: UserSession, data: ReturnType<typeof getCustomerDashboardData>): string {
  const notifHtml = data.notifications.length
    ? data.notifications.map((item) => `
        <article class="dash-notification-item" data-notif-id="${escapeHtml(item.id ?? "")}">
          <div class="dash-notif-body">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(item.message)}</span>
            <time>${formatDate(item.createdAt)}</time>
          </div>
          <div class="dash-notif-meta">
            ${item.readAt ? renderStatusBadge("read", getCopy("Read", "An karanta")) : renderStatusBadge("unread", getCopy("Unread", "Ba a karanta ba"))}
          </div>
        </article>
      `).join("")
    : renderEmptyState(getCopy("No notifications", "Babu sanarwa"), getCopy("Order and payment updates will appear here.", "Sabuntawa na oda da biya za su bayyana a nan."));

  return shell("customer", "customer/notifications",
    getCopy("Updates", "Sabuntawa"),
    getCopy("Notifications", "Sanarwa"),
    getCopy("Stay updated on orders, deliveries, and account activity.", "Kasance cikin haɓakawa kan ododi, isar da kaya, da ayyukan asusunka."),
    [],
    renderPanel({ eyebrow: getCopy("Recent", "Kwanan nan"), title: getCopy("All notifications", "Dukkan sanarwa"), body: `<div class="dash-notification-stack">${notifHtml}</div>` })
  );
}

function renderProfilePage(user: UserSession): string {
  return shell("customer", "customer/profile",
    getCopy("Account", "Asusun"),
    getCopy("Profile settings", "Saitunan bayani na sirri"),
    getCopy("Keep your contact, delivery address, and language preferences up to date.", "Kiyaye hulɗa, adireshin isar da kaya, da zaɓukan yare na zamani."),
    [],
    renderPanel({
      eyebrow: getCopy("Details", "Bayani"),
      title: getCopy("Personal information", "Bayanan sirri"),
      body: `
        <form id="profileUpdateForm" class="dash-form">
          <div class="dash-form-row">
            <label class="dash-label" for="profileName">${getCopy("Full name", "Cikakken suna")}</label>
            <input class="dash-input" id="profileName" name="name" type="text" value="${escapeHtml(user.name)}" required />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileEmail">${getCopy("Email", "Imel")} <span class="dash-optional">(${getCopy("optional", "zaɓi")})</span></label>
            <input class="dash-input" id="profileEmail" name="email" type="email" value="${escapeHtml(user.email ?? "")}" />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profilePhone">${getCopy("Phone", "Waya")}</label>
            <input class="dash-input" id="profilePhone" type="tel" value="${escapeHtml(user.phone)}" disabled />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileAddress">${getCopy("Delivery address", "Adireshin isar da kaya")}</label>
            <input class="dash-input" id="profileAddress" name="deliveryAddress" type="text" value="${escapeHtml(user.deliveryAddress ?? "")}" placeholder="${getCopy("e.g. Kofar Mata, Kano", "misali: Kofar Mata, Kano")}" />
          </div>
          <div class="dash-form-row">
            <label class="dash-label" for="profileLang">${getCopy("Preferred language", "Yaren da ake so")}</label>
            <select class="dash-input" id="profileLang" name="preferredLanguage">
              <option value="en" ${user.preferredLanguage !== "ha" ? "selected" : ""}>English</option>
              <option value="ha" ${user.preferredLanguage === "ha" ? "selected" : ""}>Hausa</option>
            </select>
          </div>
          <div class="dash-form-actions">
            <button type="submit" class="btn btn-primary">${getCopy("Save changes", "Ajiye canje-canje")}</button>
          </div>
          <div id="profileUpdateStatus" aria-live="polite"></div>
        </form>
      `,
    })
  );
}

export function renderCustomerOverview(user: UserSession, currentPath = "customer/overview"): string {
  const data = getCustomerDashboardData(user);

  if (currentPath === "customer/orders") return renderOrdersPage(user, data);
  if (currentPath === "customer/cart") return renderCartPage(user, data);
  if (currentPath === "customer/wishlist") return renderWishlistPage(user, data);
  if (currentPath === "customer/notifications") return renderNotificationsPage(user, data);
  if (currentPath === "customer/profile") return renderProfilePage(user);

  const firstName = user.firstName || user.name.split(" ")[0] || "there";

  return renderDashShell("customer", currentPath, `
      ${renderDashboardHeader({
        eyebrow: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
        title: `${getCopy("Welcome back", "Barka da dawowar")}, ${firstName}`,
        description: getCopy("Track active orders, continue shopping, review saved products, and handle support from one clean dashboard.", "Bi diddigin ododi masu aiki, ci gaba da siyayya, duba kayanda aka ajiye, da sarrafa tallafi daga allon sarrafa guda ɗaya mai tsabta."),
        actions: [
          { label: getCopy("Shop catalog", "Saya daga jerin kaya"), route: "catalog" },
          { label: getCopy("Open cart", "Buɗe kwandon saya"), id: "customerCartBtn", tone: "secondary" },
        ],
      })}

      ${renderStatGrid([
        { label: getCopy("Active orders", "Ododi masu aiki"), value: data.activeOrders.length, detail: `${data.orders.length} ${getCopy("total orders", "jimillar ododi")}`, tone: "info" },
        { label: getCopy("Cart subtotal", "Jimlar kwandon saya"), value: renderMoney(data.cartSubtotal), detail: `${data.cartCount} ${getCopy("items ready", "kaya a shirye")}`, tone: "success" },
        { label: getCopy("Wishlist", "Jerin abubuwan da ake so"), value: data.wishlistCount, detail: getCopy("Saved products", "Kayan da aka ajiye"), tone: "warning" },
        { label: getCopy("Unread updates", "Sanarwa da ba a karanta ba"), value: data.notifications.filter((item) => !item.readAt).length, detail: getCopy("Notifications", "Sanarwa"), tone: "neutral" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: getCopy("Fulfillment", "Cika oda"),
          title: getCopy("Active orders", "Ododi masu aiki"),
          action: { label: getCopy("View all", "Duba duka"), route: "customer/orders" },
          body: renderMiniRows(
            data.activeOrders.map((order) => ({
              title: order.id,
              meta: `${order.items.slice(0, 2).join(", ") || getCopy("Order items", "Kayan oda")} - ${formatDate(order.createdAt)}`,
              value: renderMoney(order.total),
              status: order.status,
            })),
            {
              title: getCopy("No active orders", "Babu ododi masu aiki"),
              body: getCopy("Start shopping and your live delivery timeline will appear here.", "Fara siyayya kuma jadawalin isar da kaya naka mai rai zai bayyana a nan."),
              action: { label: getCopy("Browse products", "Duba kaya"), route: "catalog" },
            }
          ),
        })}

        ${renderPanel({
          eyebrow: getCopy("Discovery", "Bincike"),
          title: getCopy("Recommended products", "Kayan da aka ba da shawara"),
          action: { label: getCopy("Shop more", "Saya ƙari"), route: "catalog" },
          body: data.recommended.length
            ? `<div class="dash-product-rail">${data.recommended
                .map(
                  (product) => `
                    <article class="dash-product-card">
                      <div class="dash-product-thumb" style="--accent: ${escapeHtml(product.accent)}">
                        ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(getLocalizedValue(product.name))}" loading="lazy" />` : ""}
                      </div>
                      <strong>${escapeHtml(getLocalizedValue(product.name))}</strong>
                      <span>${escapeHtml(product.vendor)}</span>
                      <b>${escapeHtml(product.price)}</b>
                    </article>
                  `
                )
                .join("")}</div>`
            : renderEmptyState(getCopy("No recommendations yet", "Babu shawara tukuna"), getCopy("Search or save products to improve recommendations.", "Nemi ko ajiye kaya don inganta shawarwari."), { label: getCopy("Search catalog", "Nemi kaya"), route: "catalog" }),
        })}

        ${renderPanel({
          eyebrow: getCopy("Saved shopping", "Siyayya da aka ajiye"),
          title: getCopy("Wishlist and cart", "Jerin abubuwan da ake so da kwandon saya"),
          body: `
            <div class="dash-action-stack">
              <button class="dash-command-card" type="button" id="customerWishlistBtn">
                <strong>${getCopy("Wishlist summary", "Taƙaitaccen jerin abubuwan da ake so")}</strong>
                <span>${data.wishlistCount} ${getCopy("saved products waiting for review.", "kayan da aka ajiye suna jiran duba.")}</span>
              </button>
              <button class="dash-command-card" type="button" id="customerCartBtnSecondary">
                <strong>${getCopy("Cart checkout", "Biyan kuɗin kwandon saya")}</strong>
                <span>${data.cartCount} ${getCopy("items", "kaya")} - ${renderMoney(data.cartSubtotal)}</span>
              </button>
              <a class="dash-command-card" href="#customer/profile" data-route="customer/profile">
                <strong>${getCopy("Profile and delivery", "Bayani na sirri da isarwa")}</strong>
                <span>${getCopy("Keep your address, language, and contact details current.", "Kiyaye adireshin ka, yare, da bayanin hulɗa.")}</span>
              </a>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: getCopy("Recent activity", "Ayyukan kwanan nan"),
          title: getCopy("Purchases and notifications", "Siyayya da sanarwa"),
          body: `
            ${renderMiniRows(
              data.recentPurchases.slice(0, 3).map((order) => ({
                title: order.id,
                meta: `${formatDate(order.createdAt)} - ${getCopy("payment", "biya")} ${order.paymentStatus}`,
                value: renderMoney(order.total),
                status: order.status,
              })),
              { title: getCopy("No purchases yet", "Babu siyayya tukuna"), body: getCopy("Completed orders will appear here for easy reordering.", "Ododi da aka kammala za su bayyana a nan don sake oda cikin sauƙi.") }
            )}
            <div class="dash-notification-stack">
              ${
                data.notifications.length
                  ? data.notifications
                      .map(
                        (item) => `
                          <article>
                            <strong>${escapeHtml(item.title)}</strong>
                            <span>${escapeHtml(item.message)}</span>
                            ${item.readAt ? renderStatusBadge("read", getCopy("Read", "An karanta")) : renderStatusBadge("unread", getCopy("Unread", "Ba a karanta ba"))}
                          </article>
                        `
                      )
                      .join("")
                  : renderEmptyState(getCopy("No notifications", "Babu sanarwa"), getCopy("Order, payment, and support updates will appear here.", "Sabuntawa na oda, biya, da tallafi za su bayyana a nan."))
              }
            </div>
          `,
        })}
      </div>
  `);
}
