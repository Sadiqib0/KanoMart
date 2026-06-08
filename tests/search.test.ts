import { describe, it, expect, vi } from "vitest";
import type { Product } from "../backend/src/types";

vi.mock("../frontend/src/state", () => ({
  state: { language: "en", lastQuery: "", lastResults: [], cartCount: 0, adminAuthenticated: false, currentUser: null },
  elements: {},
}));

vi.mock("../backend/src/data", () => ({
  storageKeys: {
    language: "language", cart: "cart", orders: "orders", reviews: "reviews",
    wishlist: "wishlist", searches: "searches", vendors: "vendors",
    productModeration: "productModeration", payments: "payments", walletLedger: "walletLedger",
    session: "session", adminSession: "adminSession",
  },
  categoryLabels: {},
  products: [
    {
      id: "p1",
      name: { en: "Basmati Rice", ha: "Shinkafar Basmati" },
      category: { en: "Food", ha: "Abinci" },
      subcategory: { en: "Grains", ha: "Hatsi" },
      availability: { en: "In stock", ha: "Akwai" },
      vendor: "Alhaji Musa Store",
      area: "Fagge",
      tags: ["rice", "grains", "food"],
      price: "NGN 3,200",
      accent: "#176b4d",
    },
    {
      id: "p2",
      name: { en: "Ankara Fabric", ha: "Yaduwar Ankara" },
      category: { en: "Fashion", ha: "Kaya" },
      subcategory: { en: "Fabric", ha: "Yadi" },
      availability: { en: "In stock", ha: "Akwai" },
      vendor: "Kantin Kwari Textiles",
      area: "Kantin Kwari",
      tags: ["fabric", "fashion", "ankara"],
      price: "NGN 5,500",
      accent: "#5c4f83",
    },
    {
      id: "p3",
      name: { en: "School Backpack", ha: "Jakar Makaranta" },
      category: { en: "Children", ha: "Yara" },
      subcategory: { en: "Bags", ha: "Jakunkuna" },
      availability: { en: "In stock", ha: "Akwai" },
      vendor: "Back To School Kano",
      area: "Sabon Gari",
      tags: ["school", "bag", "children"],
      price: "NGN 4,800",
      accent: "#1f7b84",
    },
  ],
  ADMIN_PIN: "0000",
  demoOrders: [],
  demoPayments: [],
  seedReviews: [],
  orderStatusLabels: {},
  vendorProfiles: {},
}));

vi.mock("../backend/src/storage", () => ({
  getStoredList: () => [],
  setStoredList: () => {},
  createId: () => "test-id",
}));

import { getSearchResults, inferDemandCategory, getProductText } from "../frontend/src/search";
import { products } from "../backend/src/data";

const p1 = products[0] as Product;

describe("getProductText", () => {
  it("includes product names, tags, vendor, area", () => {
    const text = getProductText(p1);
    expect(text).toContain("basmati rice");
    expect(text).toContain("alhaji musa store");
    expect(text).toContain("fagge");
    expect(text).toContain("rice");
  });
});

describe("getSearchResults", () => {
  it("finds exact match", () => {
    const results = getSearchResults("rice");
    expect(results.some((p) => p.id === "p1")).toBe(true);
  });

  it("finds Hausa name match", () => {
    const results = getSearchResults("ankara");
    expect(results.some((p) => p.id === "p2")).toBe(true);
  });

  it("returns empty array for no match", () => {
    const results = getSearchResults("helicopter");
    expect(results).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const results = getSearchResults("RICE");
    expect(results.some((p) => p.id === "p1")).toBe(true);
  });

  it("matches by vendor name", () => {
    const results = getSearchResults("kantin kwari");
    expect(results.some((p) => p.id === "p2")).toBe(true);
  });

  it("fuzzy matches a typo (one character off for 4+ char term)", () => {
    // "schol" is one edit away from "school"
    const results = getSearchResults("schol");
    expect(results.some((p) => p.id === "p3")).toBe(true);
  });

  it("does not fuzzy match short 3-char terms", () => {
    // "ric" is not in any product as an exact token, short enough to skip fuzzy
    const results = getSearchResults("zxq");
    expect(results).toHaveLength(0);
  });
});

describe("inferDemandCategory", () => {
  it("returns category from first result when results exist", () => {
    const cat = inferDemandCategory("rice", [p1]);
    expect(cat).toBe("food");
  });

  it("infers food from known terms when no results", () => {
    const cat = inferDemandCategory("abinci", []);
    expect(cat).toBe("food");
  });

  it("infers fashion from known terms", () => {
    const cat = inferDemandCategory("turare", []);
    expect(cat).toBe("fashion");
  });

  it("returns unmatched demand for unknown term", () => {
    const cat = inferDemandCategory("helicopter", []);
    expect(cat).toBe("unmatched demand");
  });
});
