import type { UserSession } from "../../../backend/types";
import { getCustomerDashboardData } from "../../services/dashboard-data";
import {
  renderDashboardHeader,
  renderEmptyState,
  renderMiniRows,
  renderMoney,
  renderPanel,
  renderStatGrid,
  renderStatusBadge,
} from "../../components/dashboard/primitives";
import { renderRoleDashboardNav } from "../../components/dashboard/role-nav";
import { escapeHtml, formatDate, getCopy, getLocalizedValue } from "../../utils";

export function renderCustomerOverview(user: UserSession, currentPath = "customer/overview"): string {
  const data = getCustomerDashboardData(user);
  const firstName = user.firstName || user.name.split(" ")[0] || "there";

  return `
    <div class="dash-shell dash-shell-customer">
      ${renderDashboardHeader({
        eyebrow: getCopy("Customer workspace", "Wurin aiki na kwastoma"),
        title: `${getCopy("Welcome back", "Barka da dawowar")}, ${firstName}`,
        description: getCopy("Track active orders, continue shopping, review saved products, and handle support from one clean dashboard.", "Bi diddigin ododi masu aiki, ci gaba da siyayya, duba kayanda aka ajiye, da sarrafa tallafi daga allon sarrafa guda ɗaya mai tsabta."),
        actions: [
          { label: getCopy("Shop catalog", "Saya daga jerin kaya"), route: "catalog" },
          { label: getCopy("Open cart", "Buɗe kwandon saya"), id: "customerCartBtn", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("customer", currentPath)}

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
    </div>
  `;
}
