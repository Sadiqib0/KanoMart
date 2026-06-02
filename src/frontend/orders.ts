import type { Order, OrderStatus } from "../backend/types";
import { storageKeys, orderStatusLabels } from "../backend/data";
import { getStoredList, setStoredList, createId } from "../backend/storage";
import { getCartItems, getCartProduct, getCartSubtotal, clearCart } from "./cart";
import { state } from "./state";
import { escapeHtml, parsePrice, formatPrice, getCopy, getLocalizedValue, formatDate, sanitizePlainText } from "./utils";
import { showToast } from "./toast";
import { createPaymentForOrder, getPaymentStatusForMethod } from "../backend/payments";
import { calculateCommission, settleDeliveredOrder } from "../backend/wallet";
import { getCommissionRateForVendor } from "../backend/marketplace-settings";
import { getDiscountedPrice, getPromotionForProduct } from "../backend/promotions";
import { notifyMany } from "../backend/notifications";
import { api, type ApiOrder } from "./api-client";

// Cache of live orders fetched from the API
let liveOrders: ApiOrder[] | null = null;

export function getLiveOrders(): ApiOrder[] | null {
  return liveOrders;
}

export async function fetchLiveOrders(): Promise<ApiOrder[]> {
  const res = await api.orders();
  liveOrders = res.orders;
  return liveOrders;
}

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
  paymentMethod: string,
  deliveryOption: "delivery" | "pickup" = "delivery",
  deliveryAddress = "",
  deliveryFee = 0
): Order | null {
  const cartItems = getCartItems();
  if (cartItems.length === 0) return null;

  const orderItems = cartItems.map((item) => {
    const product = getCartProduct(item.productId);
    const basePrice = product ? parsePrice(product.price) : 0;
    const promotion = product ? getPromotionForProduct(product) : undefined;
    const priceValue = getDiscountedPrice(basePrice, promotion);
    const lineTotal = priceValue * item.quantity;
    const vendor = product?.vendor ?? "Unknown vendor";
    const commissionRate = getCommissionRateForVendor(vendor);
    const commissionAmount = calculateCommission(lineTotal, commissionRate);
    return {
      productId: item.productId,
      quantity: item.quantity,
      name: product?.name.en ?? item.productId,
      price: product?.price ?? "NGN 0",
      priceValue,
      vendor,
      lineTotal,
      commissionRate,
      commissionAmount,
      vendorPayout: lineTotal - commissionAmount,
    };
  });
  const itemsSubtotal = getCartSubtotal();
  const subtotal = itemsSubtotal + deliveryFee;
  const paymentReference = `KM-PAY-${Date.now().toString().slice(-8)}`;
  const commissionTotal = orderItems.reduce((total, item) => total + item.commissionAmount, 0);
  const vendorPayoutTotal = orderItems.reduce((total, item) => total + item.vendorPayout, 0);

  const order: Order = {
    id: `KM-${Date.now().toString().slice(-6)}`,
    items: orderItems,
    customerName: sanitizePlainText(customerName, 80),
    customerPhone: sanitizePlainText(customerPhone, 24),
    deliveryOption,
    deliveryAddress: sanitizePlainText(deliveryAddress, 160),
    deliveryArea: sanitizePlainText(deliveryArea, 100),
    deliveryFee,
    paymentMethod,
    paymentReference,
    paymentStatus: getPaymentStatusForMethod(paymentMethod),
    subtotal,
    commissionTotal,
    vendorPayoutTotal,
    status: "awaiting_confirmation",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const payment = createPaymentForOrder(order);
  order.paymentStatus = payment.status;

  const orders = getOrders();
  orders.unshift(order);
  setStoredList(storageKeys.orders, orders);
  clearCart();

  notifyMany([
    {
      audience: "customer",
      recipient: order.customerPhone,
      title: "Order placed",
      message: `Order ${order.id} has been placed.`,
      type: "order",
      orderId: order.id,
    },
    {
      audience: "admin",
      title: "New order",
      message: `${order.id} is awaiting confirmation.`,
      type: "order",
      orderId: order.id,
    },
    ...Array.from(new Set(order.items.map((item) => item.vendor))).map((vendor) => ({
      audience: "vendor" as const,
      recipient: vendor,
      title: "New order",
      message: `${order.id} is awaiting vendor confirmation.`,
      type: "order" as const,
      orderId: order.id,
    })),
  ]);

  showToast({
    message: getCopy(`Order ${order.id} placed!`, `An sanya oda ${order.id}!`),
    duration: 4000,
  });

  return order;
}

export function advanceOrderStatus(orderId: string): Order | null {
  const orders = getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order || order.status === "delivered" || order.status === "cancelled") return order ?? null;

  const progression: OrderStatus[] =
    order.deliveryOption === "pickup"
      ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"]
      : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
  const next = progression[progression.indexOf(order.status) + 1];
  if (!next) return order;

  order.status = next;
  if (next === "assigned_to_rider" && !order.deliveryPerson) {
    order.deliveryPerson = "Kano Mart rider";
  }
  order.updatedAt = new Date().toISOString();
  setStoredList(storageKeys.orders, orders);
  notifyMany([
    {
      audience: "customer",
      recipient: order.customerPhone,
      title: next === "delivered" ? "Order delivered" : "Order updated",
      message: `Order ${order.id}: ${getLocalizedValue(orderStatusLabels[next] ?? { en: next, ha: next })}.`,
      type: next === "delivered" ? "delivery" : "order",
      orderId: order.id,
    },
    {
      audience: "admin",
      title: "Delivery status updated",
      message: `${order.id}: ${next}.`,
      type: "delivery",
      orderId: order.id,
    },
  ]);
  if (next === "delivered" && order.paymentStatus === "paid") {
    settleDeliveredOrder(order.id);
  }
  return order;
}

export function renderOrderStatusBadge(status: OrderStatus): string {
  const label = escapeHtml(getLocalizedValue(orderStatusLabels[status] ?? { en: status, ha: status }));
  return `<span class="order-status order-status-${status}">${label}</span>`;
}

export function renderOrderTimeline(order: Order): string {
  const steps: OrderStatus[] =
    order.deliveryOption === "pickup"
      ? ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "delivered"]
      : ["awaiting_confirmation", "preparing_order", "ready_for_pickup", "assigned_to_rider", "out_for_delivery", "delivered"];
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
  // Prefer live API orders when available; fall back to local store
  if (liveOrders !== null && liveOrders.length > 0) {
    return liveOrders
      .slice(0, 10)
      .map((order) => {
        const itemSummary = (order.items ?? [])
          .map((i) => {
            const name = typeof i.name === "object" ? (i.name.en ?? "") : String(i.name ?? i.productId ?? "");
            return `${escapeHtml(name)} ×${i.quantity}`;
          })
          .join(", ");
        const paymentStatus = order.paymentStatus ?? "pending";
        const deliveryOption = order.deliveryOption ?? "delivery";
        const subtotal = order.subtotal ?? 0;
        const deliveryFee = order.deliveryFee ?? 0;
        return `
          <div class="order-card">
            <div class="order-card-header">
              <strong>${escapeHtml(order.id)}</strong>
              <span class="order-status order-status-${escapeHtml(order.status)}">${escapeHtml(order.status)}</span>
            </div>
            <p class="order-items">${itemSummary}</p>
            <div class="order-meta">
              <span>${escapeHtml(formatPrice(subtotal))}</span>
              <span>${escapeHtml(getCopy(`Payment: ${paymentStatus}`, `Biya: ${paymentStatus}`))}</span>
              <span>${escapeHtml(deliveryOption === "pickup" ? getCopy("Pickup", "Dauka") : getCopy(`Delivery fee: ${formatPrice(deliveryFee)}`, `Kudin kai kaya: ${formatPrice(deliveryFee)}`))}</span>
              <span>${escapeHtml(formatDate(order.createdAt))}</span>
            </div>
          </div>
        `;
      })
      .join("");
  }

  const orders = getUserOrders();

  if (orders.length === 0) {
    return `<p class="muted">${getCopy("No orders yet.", "Babu oda tukuna.")}</p>`;
  }

  return orders
    .slice(0, 10)
    .map((order) => {
      const itemSummary = order.items.map((i) => `${escapeHtml(i.name)} ×${i.quantity}`).join(", ");
      const paymentStatus = order.paymentStatus ?? "pending";
      return `
        <div class="order-card">
          <div class="order-card-header">
            <strong>${escapeHtml(order.id)}</strong>
            ${renderOrderStatusBadge(order.status)}
          </div>
          <p class="order-items">${itemSummary}</p>
          <div class="order-meta">
            <span>${escapeHtml(formatPrice(order.subtotal))}</span>
            <span>${escapeHtml(getCopy(`Payment: ${paymentStatus}`, `Biya: ${paymentStatus}`))}</span>
            <span>${escapeHtml(order.deliveryOption === "pickup" ? getCopy("Pickup", "Dauka") : getCopy(`Delivery fee: ${formatPrice(order.deliveryFee || 0)}`, `Kudin kai kaya: ${formatPrice(order.deliveryFee || 0)}`))}</span>
            <span>${escapeHtml(formatDate(order.createdAt))}</span>
          </div>
          ${renderOrderTimeline(order)}
        </div>
      `;
    })
    .join("");
}
