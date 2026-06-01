import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/backend/data", () => ({
  storageKeys: {
    productModeration: "productModeration",
    vendorProducts: "vendorProducts",
  },
  products: [
    {
      id: "p1",
      name: { en: "Kano Rice", ha: "Shinkafar Kano" },
      category: { en: "Food", ha: "Abinci" },
      subcategory: { en: "Groceries", ha: "Kayan masarufi" },
      availability: { en: "In stock", ha: "Akwai" },
      vendor: "Dan Marke Stores",
      area: "Sabon Gari",
      tags: ["rice"],
      price: "NGN 18,500",
      accent: "#176b4d",
    },
    {
      id: "p2",
      name: { en: "Ankara Fabric", ha: "Yadukan Ankara" },
      category: { en: "Fashion", ha: "Kaya" },
      subcategory: { en: "Fabrics", ha: "Yaduka" },
      availability: { en: "In stock", ha: "Akwai" },
      vendor: "Kantin Kwari Textiles",
      area: "Kantin Kwari",
      tags: ["fabric"],
      price: "NGN 14,000",
      accent: "#5c4f83",
    },
  ],
}));

import {
  getCatalogProducts,
  getProductById,
  getProductStatus,
  getProductStatusCounts,
  moderateProduct,
  saveVendorProduct,
  setVendorProductListingStatus,
} from "../src/backend/products";

describe("product moderation", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("treats products as approved by default", () => {
    expect(getProductStatus("p1")).toBe("approved");
    expect(getCatalogProducts().map((product) => product.id)).toEqual(["p1", "p2"]);
  });

  it("hides moderated products from the customer catalog", () => {
    moderateProduct("p1", "hidden", "Needs image review");

    expect(getProductById("p1")).toBeUndefined();
    expect(getProductById("p1", { includeModerated: true })?.id).toBe("p1");
    expect(getCatalogProducts().map((product) => product.id)).toEqual(["p2"]);
  });

  it("can approve a hidden product again", () => {
    moderateProduct("p1", "hidden");
    moderateProduct("p1", "approved");

    expect(getProductById("p1")?.id).toBe("p1");
  });

  it("counts product moderation statuses for admin metrics", () => {
    moderateProduct("p1", "rejected");

    expect(getProductStatusCounts()).toEqual({ pending: 0, approved: 1, hidden: 0, rejected: 1 });
  });

  it("adds vendor products to the active catalog", () => {
    const product = saveVendorProduct({
      vendor: "Musa Wears",
      vendorPhone: "08012345678",
      area: "Fagge",
      name: "Black Jallabiya",
      priceValue: 15000,
      category: "fashion",
      imageDataUrl: "data:image/png;base64,test",
    });

    expect(getCatalogProducts().map((item) => item.id)).toContain(product.id);
    expect(getProductById(product.id)?.imageDataUrl).toBe("data:image/png;base64,test");
  });

  it("lets vendors take products down when out of stock", () => {
    const product = saveVendorProduct({
      vendor: "Musa Wears",
      vendorPhone: "08012345678",
      area: "Fagge",
      name: "Brown Sandals",
      priceValue: 8000,
      category: "fashion",
    });

    setVendorProductListingStatus(product.id, "out_of_stock");

    expect(getProductById(product.id)).toBeUndefined();
    expect(getProductById(product.id, { includeModerated: true })?.listingStatus).toBe("out_of_stock");

    setVendorProductListingStatus(product.id, "active");

    expect(getProductById(product.id)?.listingStatus).toBe("active");
  });
});
