import type { Order, OrderStatus } from "./types";
import { storageKeys, orderStatusLabels } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { getCartItems, getCartProduct, getCartSubtotal, clearCart } from "./cart";
import { state } from "./state";
import { escapeHtml, parsePrice, formatPrice, getCopy, getLocalizedValue, formatDate } from "./utils";
import { showToast } from "./toast";

export function getOrders(): Order[] {
  return getStoredList<Order>(storageKeys.orders);
}

export function getUserOrders(): Order[] {
  const user = state.currentUser;
  if (!user) return [];
  return getOrders().filter((o) => o.customerPhone === user.phone);
}

export function placeOrder(
  customerName: string,
  customerPhone: string,
  deliveryArea: string,
  paymentMethod: string
): Order | null {
  const cartItems = getCartItems();
  if (cartItems.length === 0) return null;

  const orderItems = cartItems.map((item) => {
    const product = getCartProduct(item.productId);
    return {
      productId: item.productId,
      quantity: item.quantity,
      name: product?.name.en ?? item.productId,
      price: product?.price ?? "NGN 0",
      priceValue: product ? parsePrice(product.price) : 0,
    };
  });

  const order: Order = {
    id: `KM-${Date.now().toString().slice(-6)}`,
    items: orderItems,
    customerName,
    customerPhone,
    deliveryArea,
    paymentMethod,
    subtotal: getCartSubtotal(),
    status: "placed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const orders = getOrders();
  orders.unshift(order);
  setStoredList(storageKeys.orders, orders);
  clearCart();

  showToast({
    message: getCopy(`Order ${order.id} placed!`, `An sanya oda ${order.id}!`),
    duration: 4000,
  });

  return order;
}

export function advanceOrderStatus(orderId: string): void {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order || order.status === "delivered" || order.status === "cancelled") return;

  const progression: OrderStatus[] = ["placed", "confirmed", "packed", "dispatched", "delivered"];
  const next = progression[progression.indexOf(order.status) + 1];
  if (!next) return;

  order.status = next;
  order.updatedAt = new Date().toISOString();
  setStoredList(storageKeys.orders, orders);
}

export function renderOrderStatusBadge(status: OrderStatus): string {
  const label = escapeHtml(getLocalizedValue(orderStatusLabels[status] ?? { en: status, ha: status }));
  return `<span class="order-status order-status-${status}">${label}</span>`;
}

export function renderOrderTimeline(order: Order): string {
  const steps: OrderStatus[] = ["placed", "confirmed", "packed", "dispatched", "delivered"];
  const currentIndex = steps.indexOf(order.status);

  return `
    <ol class="order-timeline" aria-label="${getCopy("Order progress", "Ci gaban oda")}">
      ${steps
        .map((step, i) => {
          const done = i <= currentIndex;
          const label = escapeHtml(getLocalizedValue(orderStatusLabels[step] ?? { en: step, ha: step }));
          return `<li class="timeline-step${done ? " done" : ""}"><span>${label}</span></li>`;
        })
        .join("")}
    </ol>
  `;
}

export function renderOrdersPanel(): string {
  const orders = getUserOrders();

  if (orders.length === 0) {
    return `<p class="muted">${getCopy("No orders yet.", "Babu oda tukuna.")}</p>`;
  }

  return orders
    .slice(0, 10)
    .map((order) => {
      const itemSummary = order.items.map((i) => `${escapeHtml(i.name)} ×${i.quantity}`).join(", ");
      return `
        <div class="order-card">
          <div class="order-card-header">
            <strong>${escapeHtml(order.id)}</strong>
            ${renderOrderStatusBadge(order.status)}
          </div>
          <p class="order-items">${itemSummary}</p>
          <div class="order-meta">
            <span>${escapeHtml(formatPrice(order.subtotal))}</span>
            <span>${escapeHtml(formatDate(order.createdAt))}</span>
          </div>
          ${renderOrderTimeline(order)}
        </div>
      `;
    })
    .join("");
}
