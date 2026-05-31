import { storageKeys } from "../backend/data";
import { getStoredList, setStoredList } from "../backend/storage";
import { state, elements } from "./state";
import { escapeHtml, getCopy } from "./utils";
import { showToast } from "./toast";
import { getProductById } from "../backend/products";

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
  document.querySelector<HTMLElement>("#sidebarWishlistCount")?.replaceChildren(String(count));
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

export function openWishlistPanel(): void {
  document.querySelector("#wishlistModal")?.remove();
  const modal = document.createElement("div");
  modal.id = "wishlistModal";
  modal.className = "modal-backdrop modal-visible";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "wishlistTitle");
  const wishlist = getWishlist();
  const rows = wishlist
    .map((id) => getProductById(id, { includeModerated: true }))
    .filter(Boolean)
    .map((product) => {
      const item = product!;
      return `
        <div class="wishlist-row">
          <div>
            <strong>${escapeHtml(item.name[state.language])}</strong>
            <span>${escapeHtml(item.vendor)} - ${escapeHtml(item.price)}</span>
          </div>
          <button type="button" data-wishlist-remove="${escapeHtml(item.id)}">${getCopy("Remove", "Cire")}</button>
        </div>
      `;
    })
    .join("");
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="wishlistTitle">${getCopy("Saved products", "Kayayyakin da aka ajiye")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">×</button>
      </div>
      <div class="wishlist-panel-body">
        ${rows || `<p class="muted">${getCopy("No saved products yet.", "Babu kaya da aka ajiye tukuna.")}</p>`}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector(".modal-close")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>("[data-wishlist-remove]");
    if (!button?.dataset.wishlistRemove) return;
    const product = getProductById(button.dataset.wishlistRemove, { includeModerated: true });
    toggleWishlist(button.dataset.wishlistRemove, product?.name[state.language] ?? button.dataset.wishlistRemove);
    openWishlistPanel();
  });
}
