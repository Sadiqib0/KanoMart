import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Order } from "../src/backend/types";

vi.mock("../src/frontend/state", () => ({
  state: {
    language: "en",
    lastQuery: "",
    lastResults: [],
    visibleProductCount: 8,
    cartCount: 0,
    adminAuthenticated: false,
    currentUser: null,
  },
  elements: {
    cartCountEl: { textContent: "" },
    cartItemsEl: { innerHTML: "" },
    cartSubtotal: { textContent: "" },
    checkoutButton: { disabled: false },
    cartEmptyState: { hidden: false },
  },
}));

vi.mock("../src/frontend/toast", () => ({
  showToast: () => {},
}));

import { storageKeys } from "../src/backend/data";
import { advanceOrderStatus } from "../src/frontend/orders";
import { createPaymentForOrder } from "../src/backend/payments";
import { getVendorWalletSummaries } from "../src/backend/wallet";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "KM-200001",
    customerName: "Aisha Bello",
    customerPhone: "08012345678",
    deliveryArea: "Tarauni",
    paymentMethod: "card",
    paymentReference: "KM-PAY-200001",
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

describe("order fulfillment settlement", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("advances paid orders through lifecycle and settles on delivery", () => {
    const order = buildOrder();
    localStorage.setItem(storageKeys.orders, JSON.stringify([order]));
    createPaymentForOrder(order);

    expect(advanceOrderStatus(order.id)?.status).toBe("preparing_order");
    expect(advanceOrderStatus(order.id)?.status).toBe("ready_for_pickup");
    expect(advanceOrderStatus(order.id)?.status).toBe("assigned_to_rider");
    expect(advanceOrderStatus(order.id)?.status).toBe("out_for_delivery");
    expect(advanceOrderStatus(order.id)?.status).toBe("delivered");

    expect(getVendorWalletSummaries()[0]).toMatchObject({
      pendingBalance: 0,
      availableBalance: 9000,
      totalCommission: 1000,
    });
  });

  it("does not settle unpaid pay-on-delivery orders when delivered", () => {
    const order = buildOrder({
      paymentMethod: "delivery",
      paymentReference: "KM-PAY-200002",
      paymentStatus: "pending",
    });
    localStorage.setItem(storageKeys.orders, JSON.stringify([order]));
    createPaymentForOrder(order);

    advanceOrderStatus(order.id);
    advanceOrderStatus(order.id);
    advanceOrderStatus(order.id);
    advanceOrderStatus(order.id);
    advanceOrderStatus(order.id);

    expect(getVendorWalletSummaries()).toEqual([]);
  });
});
