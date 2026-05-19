import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock state and data imports so utils/search can load in jsdom without full DOM
vi.mock("../src/state", () => ({
  state: { language: "en", lastQuery: "", lastResults: [], cartCount: 0, adminAuthenticated: false, currentUser: null },
  elements: {},
}));

vi.mock("../src/data", () => ({
  storageKeys: {
    language: "language", cart: "cart", orders: "orders", reviews: "reviews",
    wishlist: "wishlist", searches: "searches", vendors: "vendors",
    session: "session", adminSession: "adminSession",
  },
  categoryLabels: {
    food:     { en: "Food & Groceries", ha: "Abinci da Kayan Masarufi" },
    fashion:  { en: "Fashion & Clothing", ha: "Kaya da Tufafi" },
    children: { en: "Children & School", ha: "Yara da Makaranta" },
  },
  products: [],
  ADMIN_PIN: "0000",
  demoOrders: [],
  demoPayments: [],
  seedReviews: [],
  orderStatusLabels: {},
  vendorProfiles: {},
}));

import { escapeHtml, normalize, parsePrice, formatPrice, renderStars } from "../src/utils";

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's fine")).toBe("it&#x27;s fine");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("Hello Kano Mart")).toBe("Hello Kano Mart");
  });
});

describe("normalize", () => {
  it("lowercases input", () => {
    expect(normalize("RICE")).toBe("rice");
  });

  it("strips special characters", () => {
    expect(normalize("yaduka!")).toBe("yaduka");
  });

  it("collapses multiple spaces", () => {
    expect(normalize("rice  and  beans")).toBe("rice and beans");
  });

  it("trims leading and trailing whitespace", () => {
    expect(normalize("  rice ")).toBe("rice");
  });
});

describe("parsePrice", () => {
  it("parses NGN price string", () => {
    expect(parsePrice("NGN 1,200")).toBe(1200);
  });

  it("parses price without currency prefix", () => {
    expect(parsePrice("5,500")).toBe(5500);
  });

  it("returns 0 for non-numeric input", () => {
    expect(parsePrice("free")).toBe(0);
  });

  it("handles large prices", () => {
    expect(parsePrice("NGN 120,000")).toBe(120000);
  });
});

describe("formatPrice", () => {
  it("formats a number as NGN string", () => {
    expect(formatPrice(1200)).toMatch(/NGN/);
    expect(formatPrice(1200)).toMatch(/1[,.]?200/);
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toMatch(/NGN/);
  });
});

describe("renderStars", () => {
  it("renders 5 star spans", () => {
    const html = renderStars(4);
    const count = (html.match(/<span/g) || []).length;
    expect(count).toBe(5);
  });

  it("marks correct number of filled stars", () => {
    const html = renderStars(3);
    const filled = (html.match(/star-filled/g) || []).length;
    expect(filled).toBe(3);
  });

  it("rounds fractional ratings", () => {
    const html = renderStars(3.6);
    const filled = (html.match(/star-filled/g) || []).length;
    expect(filled).toBe(4);
  });

  it("renders zero filled stars for rating 0", () => {
    const html = renderStars(0);
    const filled = (html.match(/star-filled/g) || []).length;
    expect(filled).toBe(0);
  });
});
