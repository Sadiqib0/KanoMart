import type { CartItem, Product } from "../backend/types";
import { storageKeys } from "../backend/data";
import { getStoredList, setStoredList } from "../backend/storage";
import { state, elements } from "./state";
import { escapeHtml, getCopy, parsePrice, formatPrice } from "./utils";
import { showToast } from "./toast";
import { getProductById } from "../backend/products";
import { getLiveProducts, mergeLiveProducts, mapApiProduct } from "./live-api";
import { api } from "./api-client";

export function getCartItems(): CartItem[] {
  return getStoredList<CartItem>(storageKeys.cart);
}

export function getCartProduct(productId: string): Product | undefined {
  // Live API products (UUID-keyed) must be checked first; the legacy in-memory
  // store only knows about seed/prototype products with different IDs.
  return getLiveProducts().find((p) => p.id === productId) ?? getProductById(productId);
}

export function getCartCount(): number {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(): number {
  return getCartItems().reduce((sum, item) => {
    const product = getCartProduct(item.productId);
    return sum + (product ? parsePrice(product.price) * item.quantity : 0);
  }, 0);
}

export function addToCart(productId: string): void {
  const product = getCartProduct(productId);
  if (!product) {
    showToast({
      message: getCopy("This product is not available for purchase.", "Wannan kaya ba ya samuwa yanzu."),
      type: "error",
    });
    return;
  }

  const items = getCartItems();
  const existing = items.find((i) => i.productId === productId);
  const newQuantity = (existing?.quantity ?? 0) + 1;
  if (existing) {
    existing.quantity = newQuantity;
  } else {
    items.push({ productId, quantity: 1, addedAt: new Date().toISOString() });
  }
  setStoredList(storageKeys.cart, items);
  syncCart();

  if (state.currentUser?.token) {
    api.addCartItem(productId, newQuantity).catch(() => undefined);
  }

  showToast({ message: getCopy(`Added: ${product.name.en}`, `An saka: ${product.name.ha}`) });
}

export function updateQuantity(productId: string, delta: number): void {
  const items = getCartItems();
  const item = items.find((i) => i.productId === productId);
  if (!item) return;
  item.quantity = Math.max(0, item.quantity + delta);
  const updated = items.filter((i) => i.quantity > 0);
  setStoredList(storageKeys.cart, updated);
  syncCart();

  if (state.currentUser?.token) {
    if (item.quantity > 0) {
      api.updateCartItem(productId, item.quantity).catch(() => undefined);
    } else {
      api.removeCartItem(productId).catch(() => undefined);
    }
  }
}

export function removeFromCart(productId: string): void {
  const items = getCartItems().filter((i) => i.productId !== productId);
  setStoredList(storageKeys.cart, items);
  syncCart();

  if (state.currentUser?.token) {
    api.removeCartItem(productId).catch(() => undefined);
  }
}

export function clearCart(): void {
  setStoredList(storageKeys.cart, []);
  syncCart();
}

/**
 * Pull the server cart and merge it with the local one (quantity = max of the
 * two, so neither device's adds are lost), then push local-only items up so
 * both sides agree. Called on boot and right after sign-in — without this,
 * items added before signing in exist only in localStorage and checkout
 * (which reads the SERVER cart) fails with "cart_empty".
 */
export async function hydrateCartFromServer(): Promise<void> {
  if (!state.currentUser?.token || state.currentUser.role !== "customer") return;
  let serverItems: { productId: string; quantity: number; addedAt?: string }[];
  try {
    const { cart } = await api.cart();
    mergeLiveProducts(cart.items.flatMap((i) => (i.product ? [mapApiProduct(i.product)] : [])));
    serverItems = cart.items;
  } catch {
    return; // offline / transient failure — local cart stays authoritative for display
  }

  const merged = new Map<string, CartItem>();
  for (const item of serverItems) {
    merged.set(item.productId, {
      productId: item.productId,
      quantity: item.quantity,
      addedAt: item.addedAt ?? new Date().toISOString(),
    });
  }
  for (const item of getCartItems()) {
    const existing = merged.get(item.productId);
    if (existing) existing.quantity = Math.max(existing.quantity, item.quantity);
    else merged.set(item.productId, item);
  }

  const items = [...merged.values()];
  setStoredList(storageKeys.cart, items);
  syncCart();

  // Push anything the server doesn't know about (best-effort; checkout
  // reconciliation is the hard gate).
  await Promise.all(
    items.map((item) => {
      const server = serverItems.find((s) => s.productId === item.productId);
      if (server && server.quantity === item.quantity) return Promise.resolve();
      return api.addCartItem(item.productId, item.quantity).then(() => undefined, () => undefined);
    })
  );
}

/**
 * Make the server cart exactly match the local one. Called right before
 * checkout, because the server builds the order from ITS cart — if the two
 * have drifted (a fire-and-forget sync failed earlier), the customer would be
 * charged for different items than the ones displayed. Throws with the
 * offending product names so checkout can refuse instead of mischarging.
 */
export async function reconcileCartWithServer(): Promise<void> {
  const local = getCartItems();
  const { cart } = await api.cart();

  const failures: string[] = [];
  for (const item of local) {
    const server = cart.items.find((s) => s.productId === item.productId);
    if (server && server.quantity === item.quantity) continue;
    try {
      await api.addCartItem(item.productId, item.quantity);
    } catch {
      const product = getCartProduct(item.productId);
      failures.push(product ? product.name[state.language] : item.productId);
    }
  }
  for (const item of cart.items) {
    if (!local.some((l) => l.productId === item.productId)) {
      await api.removeCartItem(item.productId).catch(() => undefined);
    }
  }

  if (failures.length) {
    throw new Error(
      getCopy(
        `These items are not available for online checkout right now: ${failures.join(", ")}. Remove them from your cart and try again.`,
        `Wadannan kayan ba sa samuwa don biya a yanzu: ${failures.join(", ")}. Cire su daga kwandon ka sake gwadawa.`
      )
    );
  }
}

export function syncCart(): void {
  const count = getCartCount();
  state.cartCount = count;
  elements.cartCountEl.textContent = String(count);
  document.querySelector<HTMLElement>("#sidebarCartCount")?.replaceChildren(String(count));
  renderCartPanel();
}

export function openCart(): void {
  elements.cartPanel.hidden = false;
  elements.cartOverlay.hidden = false;
  elements.cartPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
  elements.cartPanel.querySelector<HTMLElement>(".cart-close")?.focus();
}

export function closeCart(): void {
  elements.cartPanel.hidden = true;
  elements.cartOverlay.hidden = true;
  elements.cartPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

export function renderCartPanel(): void {
  const items = getCartItems();
  const subtotal = getCartSubtotal();

  elements.cartSubtotal.textContent = formatPrice(subtotal);
  elements.checkoutButton.disabled = items.length === 0;

  if (items.length === 0) {
    elements.cartEmptyState.hidden = false;
    elements.cartItemsEl.innerHTML = "";
    return;
  }

  elements.cartEmptyState.hidden = true;
  elements.cartItemsEl.innerHTML = items
    .map((item) => {
      const product = getCartProduct(item.productId);
      if (!product) return "";
      const name = product.name[state.language];
      const lineTotal = formatPrice(parsePrice(product.price) * item.quantity);
      return `
        <div class="cart-item" data-product-id="${escapeHtml(item.productId)}">
          <div class="cart-item-thumb" style="--accent: ${product.accent}" aria-hidden="true"></div>
          <div class="cart-item-info">
            <strong>${escapeHtml(name)}</strong>
            <span class="cart-item-price">${escapeHtml(lineTotal)}</span>
          </div>
          <div class="cart-item-controls">
            <button type="button" class="qty-btn" data-qty-dec="${escapeHtml(item.productId)}" aria-label="${getCopy("Decrease quantity", "Rage adadi")}">−</button>
            <span class="qty-value" aria-label="${getCopy("Quantity", "Adadi")}">${item.quantity}</span>
            <button type="button" class="qty-btn" data-qty-inc="${escapeHtml(item.productId)}" aria-label="${getCopy("Increase quantity", "Kara adadi")}">+</button>
          </div>
          <button type="button" class="cart-remove" data-remove="${escapeHtml(item.productId)}" aria-label="${getCopy("Remove", "Cire")}">×</button>
        </div>
      `;
    })
    .join("");
}
