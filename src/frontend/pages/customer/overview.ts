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
import { escapeHtml, formatDate, getLocalizedValue } from "../../utils";

export function renderCustomerOverview(user: UserSession, currentPath = "customer/overview"): string {
  const data = getCustomerDashboardData(user);
  const firstName = user.firstName || user.name.split(" ")[0] || "there";

  return `
    <div class="dash-shell dash-shell-customer">
      ${renderDashboardHeader({
        eyebrow: "Customer workspace",
        title: `Welcome back, ${firstName}`,
        description: "Track active orders, continue shopping, review saved products, and handle support from one clean dashboard.",
        actions: [
          { label: "Shop catalog", route: "catalog" },
          { label: "Open cart", id: "customerCartBtn", tone: "secondary" },
        ],
      })}

      ${renderRoleDashboardNav("customer", currentPath)}

      ${renderStatGrid([
        { label: "Active orders", value: data.activeOrders.length, detail: `${data.orders.length} total orders`, tone: "info" },
        { label: "Cart subtotal", value: renderMoney(data.cartSubtotal), detail: `${data.cartCount} items ready`, tone: "success" },
        { label: "Wishlist", value: data.wishlistCount, detail: "Saved products", tone: "warning" },
        { label: "Unread updates", value: data.notifications.filter((item) => !item.readAt).length, detail: "Notifications", tone: "neutral" },
      ])}

      <div class="dash-overview-grid">
        ${renderPanel({
          eyebrow: "Fulfillment",
          title: "Active orders",
          action: { label: "View all", route: "customer/orders" },
          body: renderMiniRows(
            data.activeOrders.map((order) => ({
              title: order.id,
              meta: `${order.items.slice(0, 2).join(", ") || "Order items"} - ${formatDate(order.createdAt)}`,
              value: renderMoney(order.total),
              status: order.status,
            })),
            {
              title: "No active orders",
              body: "Start shopping and your live delivery timeline will appear here.",
              action: { label: "Browse products", route: "catalog" },
            }
          ),
        })}

        ${renderPanel({
          eyebrow: "Discovery",
          title: "Recommended products",
          action: { label: "Shop more", route: "catalog" },
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
            : renderEmptyState("No recommendations yet", "Search or save products to improve recommendations.", { label: "Search catalog", route: "catalog" }),
        })}

        ${renderPanel({
          eyebrow: "Saved shopping",
          title: "Wishlist and cart",
          body: `
            <div class="dash-action-stack">
              <button class="dash-command-card" type="button" id="customerWishlistBtn">
                <strong>Wishlist summary</strong>
                <span>${data.wishlistCount} saved products waiting for review.</span>
              </button>
              <button class="dash-command-card" type="button" id="customerCartBtnSecondary">
                <strong>Cart checkout</strong>
                <span>${data.cartCount} items - ${renderMoney(data.cartSubtotal)}</span>
              </button>
              <a class="dash-command-card" href="#customer/profile" data-route="customer/profile">
                <strong>Profile and delivery</strong>
                <span>Keep your address, language, and contact details current.</span>
              </a>
            </div>
          `,
        })}

        ${renderPanel({
          eyebrow: "Recent activity",
          title: "Purchases and notifications",
          body: `
            ${renderMiniRows(
              data.recentPurchases.slice(0, 3).map((order) => ({
                title: order.id,
                meta: `${formatDate(order.createdAt)} - payment ${order.paymentStatus}`,
                value: renderMoney(order.total),
                status: order.status,
              })),
              { title: "No purchases yet", body: "Completed orders will appear here for easy reordering." }
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
                            ${item.readAt ? renderStatusBadge("read", "Read") : renderStatusBadge("unread", "Unread")}
                          </article>
                        `
                      )
                      .join("")
                  : renderEmptyState("No notifications", "Order, payment, and support updates will appear here.")
              }
            </div>
          `,
        })}
      </div>
    </div>
  `;
}
