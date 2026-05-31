import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "../src/backend/types";
import { getPaymentSummary, createPaymentForOrder, getPaymentStatusForMethod } from "../src/backend/payments";
import {
  calculateCommission,
  createLedgerEntriesForPaidOrder,
  getPlatformCommissionTotal,
  getVendorWalletSummaries,
  settleDeliveredOrder,
} from "../src/backend/wallet";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "KM-100001",
    customerName: "Aisha Bello",
    customerPhone: "08012345678",
    deliveryArea: "Tarauni",
    paymentMethod: "card",
    paymentReference: "KM-PAY-100001",
    paymentStatus: "paid",
    subtotal: 10000,
    commissionTotal: 1000,
    vendorPayoutTotal: 9000,
    status: "awaiting_confirmation",
    createdAt: "2026-05-29T10:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z",
    items: [
      {
        productId: "food-rice",
        quantity: 1,
        name: "Kano local rice 10kg",
        price: "NGN 10,000",
        priceValue: 10000,
        vendor: "Dan Marke Stores",
        lineTotal: 10000,
        commissionRate: 0.1,
        commissionAmount: 1000,
        vendorPayout: 9000,
      },
    ],
    ...overrides,
  };
}

describe("payment and wallet domain", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("calculates platform commission with the default 10 percent rate", () => {
    expect(calculateCommission(10000)).toBe(1000);
  });

  it("marks manual methods as pending and online prototype methods as paid", () => {
    expect(getPaymentStatusForMethod("delivery")).toBe("pending");
    expect(getPaymentStatusForMethod("transfer")).toBe("pending");
    expect(getPaymentStatusForMethod("card")).toBe("paid");
  });

  it("creates a paid payment and credits wallet ledger entries once", () => {
    const order = buildOrder();

    const payment = createPaymentForOrder(order);
    const duplicateEntries = createLedgerEntriesForPaidOrder(order);

    expect(payment.status).toBe("paid");
    expect(duplicateEntries).toHaveLength(2);
    expect(getVendorWalletSummaries()).toEqual([
      {
        vendor: "Dan Marke Stores",
        pendingBalance: 9000,
        availableBalance: 0,
        totalCommission: 1000,
      },
    ]);
    expect(getPlatformCommissionTotal()).toBe(1000);
  });

  it("does not credit vendor wallet before pay-on-delivery is confirmed", () => {
    const order = buildOrder({
      id: "KM-100002",
      paymentMethod: "delivery",
      paymentReference: "KM-PAY-100002",
      paymentStatus: "pending",
    });

    const payment = createPaymentForOrder(order);

    expect(payment.status).toBe("pending");
    expect(getVendorWalletSummaries()).toEqual([]);
  });

  it("summarizes paid and pending payment volume", () => {
    createPaymentForOrder(buildOrder());
    createPaymentForOrder(
      buildOrder({
        id: "KM-100002",
        paymentMethod: "delivery",
        paymentReference: "KM-PAY-100002",
        paymentStatus: "pending",
      })
    );

    expect(getPaymentSummary()).toMatchObject({
      paidAmount: 10000,
      pendingAmount: 10000,
      paidCount: 1,
      pendingCount: 1,
      failedCount: 0,
    });
  });

  it("settles pending vendor credits into available balance once", () => {
    const order = buildOrder();
    createPaymentForOrder(order);

    settleDeliveredOrder(order.id);
    settleDeliveredOrder(order.id);

    expect(getVendorWalletSummaries()).toEqual([
      {
        vendor: "Dan Marke Stores",
        pendingBalance: 0,
        availableBalance: 9000,
        totalCommission: 1000,
      },
    ]);
  });
});
