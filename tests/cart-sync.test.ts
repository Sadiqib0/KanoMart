import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockState = vi.hoisted(() => ({
  currentUser: null as Record<string, unknown> | null,
  language: "en" as "en" | "ha",
  cartCount: 0,
}));

vi.mock("../frontend/src/state", () => ({
  state: mockState,
  elements: {
    cartCountEl: { textContent: "" },
    cartSubtotal: { textContent: "" },
    checkoutButton: { disabled: false },
    cartEmptyState: { hidden: false },
    cartItemsEl: { innerHTML: "" },
    cartPanel: { hidden: true, setAttribute: () => undefined, querySelector: () => null },
    cartOverlay: { hidden: true },
  },
}));

vi.mock("../frontend/src/toast", () => ({ showToast: vi.fn() }));

const { apiCart, apiAddCartItem, apiUpdateCartItem, apiRemoveCartItem } = vi.hoisted(() => ({
  apiCart: vi.fn(),
  apiAddCartItem: vi.fn(),
  apiUpdateCartItem: vi.fn(),
  apiRemoveCartItem: vi.fn(),
}));
vi.mock("../frontend/src/api-client", () => ({
  api: {
    cart: (...args: unknown[]) => apiCart(...args),
    addCartItem: (...args: unknown[]) => apiAddCartItem(...args),
    updateCartItem: (...args: unknown[]) => apiUpdateCartItem(...args),
    removeCartItem: (...args: unknown[]) => apiRemoveCartItem(...args),
  },
}));

const liveProducts = vi.hoisted(() => [] as { id: string; name: { en: string; ha: string }; price: string }[]);
vi.mock("../frontend/src/live-api", () => ({
  getLiveProducts: () => liveProducts,
  mergeLiveProducts: vi.fn(),
  mapApiProduct: (p: { id: string }) => ({ id: p.id, name: { en: p.id, ha: p.id }, price: "NGN 1,000" }),
}));

vi.mock("../backend/src/products", () => ({
  getProductById: (id: string) => liveProducts.find((p) => p.id === id),
}));

import { storageKeys } from "../backend/src/data";
import {
  addToCart,
  getCartItems,
  hydrateCartFromServer,
  reconcileCartWithServer,
} from "../frontend/src/cart";

function setLocalCart(items: { productId: string; quantity: number; addedAt: string }[]): void {
  localStorage.setItem(storageKeys.cart, JSON.stringify(items));
}

beforeEach(() => {
  localStorage.clear();
  liveProducts.length = 0;
  mockState.currentUser = null;
  apiCart.mockReset();
  apiAddCartItem.mockReset();
  apiUpdateCartItem.mockReset();
  apiRemoveCartItem.mockReset();
});

// ── addToCart server push ─────────────────────────────────────────────────────

describe("addToCart", () => {
  it("stores locally and pushes the absolute quantity to the API when signed in", () => {
    liveProducts.push({ id: "prod-1", name: { en: "Rice", ha: "Shinkafa" }, price: "NGN 1,000" });
    mockState.currentUser = { phone: "+234", role: "customer", token: "t" };
    apiAddCartItem.mockResolvedValue({});

    addToCart("prod-1");
    addToCart("prod-1");

    expect(getCartItems()).toEqual([expect.objectContaining({ productId: "prod-1", quantity: 2 })]);
    // Backend upsert SETS quantity, so the second call must send 2, not 1.
    expect(apiAddCartItem).toHaveBeenLastCalledWith("prod-1", 2);
  });

  it("does not call the API for guests", () => {
    liveProducts.push({ id: "prod-1", name: { en: "Rice", ha: "Shinkafa" }, price: "NGN 1,000" });
    addToCart("prod-1");
    expect(getCartItems()).toHaveLength(1);
    expect(apiAddCartItem).not.toHaveBeenCalled();
  });
});

// ── hydrateCartFromServer ─────────────────────────────────────────────────────

describe("hydrateCartFromServer", () => {
  it("is a no-op without a customer token", async () => {
    await hydrateCartFromServer();
    expect(apiCart).not.toHaveBeenCalled();
  });

  it("merges server and local carts using the max quantity per product", async () => {
    mockState.currentUser = { phone: "+234", role: "customer", token: "t" };
    setLocalCart([
      { productId: "local-only", quantity: 1, addedAt: "2026-01-01T00:00:00Z" },
      { productId: "both", quantity: 5, addedAt: "2026-01-01T00:00:00Z" },
    ]);
    apiCart.mockResolvedValue({
      cart: {
        items: [
          { productId: "both", quantity: 2, product: { id: "both" } },
          { productId: "server-only", quantity: 3, product: { id: "server-only" } },
        ],
        subtotal: 0,
      },
    });
    apiAddCartItem.mockResolvedValue({});

    await hydrateCartFromServer();

    const items = getCartItems();
    expect(items).toHaveLength(3);
    expect(items.find((i) => i.productId === "both")?.quantity).toBe(5);
    expect(items.find((i) => i.productId === "local-only")?.quantity).toBe(1);
    expect(items.find((i) => i.productId === "server-only")?.quantity).toBe(3);
    // Items the server lacks (or has at a lower quantity) are pushed up.
    expect(apiAddCartItem).toHaveBeenCalledWith("local-only", 1);
    expect(apiAddCartItem).toHaveBeenCalledWith("both", 5);
    expect(apiAddCartItem).not.toHaveBeenCalledWith("server-only", 3);
  });

  it("keeps the local cart untouched when the server is unreachable", async () => {
    mockState.currentUser = { phone: "+234", role: "customer", token: "t" };
    setLocalCart([{ productId: "p", quantity: 2, addedAt: "2026-01-01T00:00:00Z" }]);
    apiCart.mockRejectedValue(new Error("network"));

    await hydrateCartFromServer();

    expect(getCartItems()).toEqual([expect.objectContaining({ productId: "p", quantity: 2 })]);
  });
});

// ── reconcileCartWithServer ───────────────────────────────────────────────────

describe("reconcileCartWithServer", () => {
  it("upserts drifted items and deletes server items missing locally", async () => {
    setLocalCart([
      { productId: "keep", quantity: 2, addedAt: "2026-01-01T00:00:00Z" },
      { productId: "new", quantity: 1, addedAt: "2026-01-01T00:00:00Z" },
    ]);
    apiCart.mockResolvedValue({
      cart: {
        items: [
          { productId: "keep", quantity: 2 },
          { productId: "stale", quantity: 4 },
        ],
        subtotal: 0,
      },
    });
    apiAddCartItem.mockResolvedValue({});
    apiRemoveCartItem.mockResolvedValue({});

    await reconcileCartWithServer();

    expect(apiAddCartItem).toHaveBeenCalledTimes(1);
    expect(apiAddCartItem).toHaveBeenCalledWith("new", 1);
    expect(apiRemoveCartItem).toHaveBeenCalledWith("stale");
  });

  it("throws with the product name when an item cannot be synced", async () => {
    liveProducts.push({ id: "ghost", name: { en: "Ghost Product", ha: "Ghost" }, price: "NGN 1,000" });
    setLocalCart([{ productId: "ghost", quantity: 1, addedAt: "2026-01-01T00:00:00Z" }]);
    apiCart.mockResolvedValue({ cart: { items: [], subtotal: 0 } });
    apiAddCartItem.mockRejectedValue(new Error("product_not_found"));

    await expect(reconcileCartWithServer()).rejects.toThrow(/Ghost Product/);
  });
});
