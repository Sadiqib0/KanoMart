import type { CartItem, Product } from "../backend/types";
import { storageKeys } from "../backend/data";
import { getStoredList, setStoredList } from "../backend/storage";
import { state, elements } from "./state";
import { escapeHtml, getCopy, parsePrice, formatPrice } from "./utils";
import { showToast } from "./toast";
import { getProductById } from "../backend/products";

export function getCartItems(): CartItem[] {
  return getStoredList<CartItem>(storageKeys.cart);
}

export function getCartProduct(productId: string): Product | undefined {
  return getProductById(productId);
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
  if (existing) {
    existing.quantity += 1;
  } else {
    items.push({ productId, quantity: 1, addedAt: new Date().toISOString() });
  }
  setStoredList(storageKeys.cart, items);
  syncCart();

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
}

export function removeFromCart(productId: string): void {
  const items = getCartItems().filter((i) => i.productId !== productId);
  setStoredList(storageKeys.cart, items);
  syncCart();
}

export function clearCart(): void {
  setStoredList(storageKeys.cart, []);
  syncCart();
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
