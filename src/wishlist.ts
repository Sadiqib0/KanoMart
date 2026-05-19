import { storageKeys } from "./data";
import { getStoredList, setStoredList } from "./storage";
import { state, elements } from "./state";
import { getCopy } from "./utils";
import { showToast } from "./toast";

export function getWishlist(): string[] {
  return getStoredList<string>(storageKeys.wishlist);
}

export function isWishlisted(productId: string): boolean {
  return getWishlist().includes(productId);
}

export function toggleWishlist(productId: string, productName: string): void {
  const list = getWishlist();
  const idx = list.indexOf(productId);
  if (idx === -1) {
    list.push(productId);
    showToast({ message: getCopy(`Saved: ${productName}`, `An ajiye: ${productName}`) });
  } else {
    list.splice(idx, 1);
    showToast({
      message: getCopy("Removed from wishlist", "An cire daga jerin da aka ajiye"),
      type: "info",
    });
  }
  setStoredList(storageKeys.wishlist, list);
  syncWishlistCount();
  syncWishlistButtons(productId);
}

export function syncWishlistCount(): void {
  const count = getWishlist().length;
  elements.wishlistCountEl.textContent = String(count);
  elements.wishlistCountEl.hidden = count === 0;
}

export function syncWishlistButtons(productId?: string): void {
  const list = getWishlist();
  const selector = productId ? `[data-wishlist="${productId}"]` : "[data-wishlist]";
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((btn) => {
    const id = btn.dataset.wishlist!;
    const saved = list.includes(id);
    btn.classList.toggle("is-wishlisted", saved);
    btn.setAttribute(
      "aria-label",
      saved
        ? getCopy("Remove from wishlist", "Cire daga jerin da aka ajiye")
        : getCopy("Save to wishlist", "Ajiye zuwa jerin kaya")
    );
    btn.setAttribute("aria-pressed", String(saved));
  });
}

export function syncAllWishlistButtons(): void {
  syncWishlistButtons();
}
