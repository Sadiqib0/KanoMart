import { beforeEach, describe, expect, it } from "vitest";
import type { Order } from "../backend/src/types";
import { createPromotion, getDiscountedPrice, getPromotionForProduct } from "../backend/src/promotions";
import {
  getCommissionRateForVendor,
  setVendorSubscription,
  saveCommissionSettings,
} from "../backend/src/marketplace-settings";
import { getMarketplaceAnalytics, recordProductView } from "../backend/src/analytics";
import { products, storageKeys } from "../backend/src/data";

function buildOrder(): Order {
  return {
    id: "KM-300001",
    customerName: "Aisha Bello",
    customerPhone: "08012345678",
    deliveryOption: "delivery",
    deliveryAddress: "Tarauni",
    deliveryArea: "Tarauni",
    deliveryFee: 1200,
    paymentMethod: "delivery",
    paymentReference: "KM-PAY-300001",
    paymentStatus: "pending",
    subtotal: 11200,
    commissionTotal: 1000,
    vendorPayoutTotal: 9000,
    status: "awaiting_confirmation",
    createdAt: "2026-05-29T10:00:00.000Z",
    updatedAt: "2026-05-29T10:00:00.000Z",
    items: [
      {
        productId: "food-rice",
        quantity: 2,
        name: "Kano local rice 10kg",
        price: "NGN 5,000",
        priceValue: 5000,
        vendor: "Dan Marke Stores",
        lineTotal: 10000,
        commissionRate: 0.1,
        commissionAmount: 1000,
        vendorPayout: 9000,
      },
    ],
  };
}

describe("phase 3 marketplace features", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("uses vendor plans and custom commission settings", () => {
    expect(getCommissionRateForVendor("Dan Marke Stores")).toBe(0.12);

    setVendorSubscription("Dan Marke Stores", "premium");
    expect(getCommissionRateForVendor("Dan Marke Stores")).toBe(0.08);

    saveCommissionSettings({ perVendorRates: { "Dan Marke Stores": 0.05 } });
    expect(getCommissionRateForVendor("Dan Marke Stores")).toBe(0.05);
  });

  it("creates active promotions and calculates discount prices", () => {
    const product = products.find((item) => item.id === "food-rice")!;
    createPromotion({
      title: "Ramadan food deals",
      titleHa: "Rangwamen Ramadan",
      type: "seasonal_campaign",
      category: "food",
      discountPercent: 10,
    });

    const promotion = getPromotionForProduct(product);
    expect(promotion?.title.en).toBe("Ramadan food deals");
    expect(getDiscountedPrice(10000, promotion)).toBe(9000);
  });

  it("reports views, searches, orders, customers, and vendors", () => {
    recordProductView("food-rice");
    recordProductView("food-rice");
    localStorage.setItem(storageKeys.orders, JSON.stringify([buildOrder()]));
    localStorage.setItem(
      storageKeys.searches,
      JSON.stringify([{ id: "s1", query: "rice", language: "en", resultCount: 1, category: "food", status: "matched", createdAt: new Date().toISOString() }])
    );
    localStorage.setItem(
      storageKeys.users,
      JSON.stringify([{ phone: "08012345678", firstName: "Aisha", lastName: "Bello", name: "Aisha Bello", role: "customer", createdAt: "", updatedAt: "" }])
    );
    localStorage.setItem(
      storageKeys.vendors,
      JSON.stringify([{ id: "v1", businessName: "Dan Marke Stores", phone: "08000000001", area: "Kano", category: "food", createdAt: "" }])
    );

    const analytics = getMarketplaceAnalytics();
    expect(analytics.totalOrders).toBe(1);
    expect(analytics.customerGrowth).toBe(1);
    expect(analytics.vendorGrowth).toBe(1);
    expect(analytics.mostViewedProducts[0]).toMatchObject({ label: "Kano local rice 10kg", value: 2 });
    expect(analytics.mostSearchedItems[0]).toMatchObject({ label: "rice", value: 1 });
    expect(analytics.bestSellingProducts[0]).toMatchObject({ label: "Kano local rice 10kg", value: 2 });
  });
});
