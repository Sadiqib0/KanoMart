import type { Order, PaymentRecord, PaymentStatus } from "./types";
import { storageKeys } from "./data";
import { createId, getStoredList, setStoredList } from "./storage";
import { createLedgerEntriesForPaidOrder } from "./wallet";
import { createNotification, notifyMany } from "./notifications";

export function getPayments(): PaymentRecord[] {
  return getStoredList<PaymentRecord>(storageKeys.payments);
}

export function getPaymentStatusForMethod(method: string): PaymentStatus {
  return method === "card" || method === "ussd" || method === "wallet" ? "paid" : "pending";
}

export function getPaymentGatewayForMethod(method: string): PaymentRecord["gateway"] {
  if (method === "card" || method === "ussd" || method === "wallet") return "prototype";
  return "manual";
}

export function createPaymentForOrder(order: Order): PaymentRecord {
  const existing = getPayments().find((payment) => payment.orderId === order.id);
  if (existing) return existing;

  const status = getPaymentStatusForMethod(order.paymentMethod);
  const payment: PaymentRecord = {
    id: createId(),
    orderId: order.id,
    reference: order.paymentReference,
    method: order.paymentMethod,
    amount: order.subtotal,
    currency: "NGN",
    status,
    gateway: getPaymentGatewayForMethod(order.paymentMethod),
    createdAt: new Date().toISOString(),
    verifiedAt: status === "paid" ? new Date().toISOString() : undefined,
  };

  setStoredList(storageKeys.payments, [payment, ...getPayments()]);

  if (payment.status === "paid") {
    createLedgerEntriesForPaidOrder(order);
  }

  return payment;
}

function syncOrderPaymentStatus(orderId: string, status: PaymentStatus): Order | null {
  const orders = getStoredList<Order>(storageKeys.orders);
  const order = orders.find((item) => item.id === orderId);
  if (!order) return null;
  order.paymentStatus = status;
  order.updatedAt = new Date().toISOString();
  setStoredList(storageKeys.orders, orders);
  return order;
}

export function updatePaymentStatus(paymentId: string, status: PaymentStatus, adminNote?: string): PaymentRecord | null {
  const payments = getPayments();
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment) return null;

  payment.status = status;
  payment.adminNote = adminNote;
  if (status === "paid") payment.verifiedAt = new Date().toISOString();
  if (status === "failed") payment.failedAt = new Date().toISOString();
  if (status === "refunded") payment.refundedAt = new Date().toISOString();
  setStoredList(storageKeys.payments, payments);

  const order = syncOrderPaymentStatus(payment.orderId, status);
  if (order && status === "paid") {
    createLedgerEntriesForPaidOrder(order);
    notifyMany([
      {
        audience: "customer",
        recipient: order.customerPhone,
        title: "Payment successful",
        message: `Payment confirmed for ${order.id}.`,
        type: "payment",
        orderId: order.id,
      },
      ...Array.from(new Set(order.items.map((item) => item.vendor))).map((vendor) => ({
        audience: "vendor" as const,
        recipient: vendor,
        title: "Payment confirmed",
        message: `Payment confirmed for order ${order.id}.`,
        type: "payment" as const,
        orderId: order.id,
      })),
    ]);
  }
  if (order && status === "failed") {
    notifyMany([
      {
        audience: "customer",
        recipient: order.customerPhone,
        title: "Payment failed",
        message: `Payment failed for ${order.id}.`,
        type: "payment",
        orderId: order.id,
      },
      {
        audience: "admin",
        title: "Failed payment",
        message: `Payment ${payment.reference} failed.`,
        type: "payment",
        orderId: order.id,
      },
    ]);
  }
  if (order && status === "refunded") {
    createNotification({
      audience: "customer",
      recipient: order.customerPhone,
      title: "Payment refunded",
      message: `Refund processed for ${order.id}.`,
      type: "payment",
      orderId: order.id,
    });
  }

  return payment;
}

export function confirmPayment(paymentId: string, adminNote = "Confirmed manually by admin"): PaymentRecord | null {
  return updatePaymentStatus(paymentId, "paid", adminNote);
}

export function failPayment(paymentId: string, adminNote = "Marked failed by admin"): PaymentRecord | null {
  return updatePaymentStatus(paymentId, "failed", adminNote);
}

export function refundPayment(paymentId: string, adminNote = "Refunded by admin"): PaymentRecord | null {
  return updatePaymentStatus(paymentId, "refunded", adminNote);
}

export function getPaymentSummary(): {
  paidAmount: number;
  pendingAmount: number;
  failedAmount: number;
  refundedAmount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
} {
  return getPayments().reduce(
    (summary, payment) => {
      if (payment.status === "paid") {
        summary.paidAmount += payment.amount;
        summary.paidCount += 1;
      } else if (payment.status === "pending") {
        summary.pendingAmount += payment.amount;
        summary.pendingCount += 1;
      } else if (payment.status === "failed") {
        summary.failedAmount += payment.amount;
        summary.failedCount += 1;
      } else {
        summary.refundedAmount += payment.amount;
        summary.refundedCount += 1;
      }
      return summary;
    },
    {
      paidAmount: 0,
      pendingAmount: 0,
      failedAmount: 0,
      refundedAmount: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0,
    }
  );
}
