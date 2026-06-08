import type { Product } from "../backend/types";
import { vendorProfiles } from "../backend/data";
import { state } from "./state";
import { escapeHtml, getCopy, getLocalizedValue, renderStars, formatDate } from "./utils";
import { addToCart } from "./cart";
import { toggleWishlist, isWishlisted, syncWishlistCount } from "./wishlist";
import { getAverageRating, getProductReviews, addReview, renderReviewList, renderReviewForm } from "./reviews";
import { showToast } from "./toast";
import { getProductById } from "../backend/products";
import { openAuthModal } from "./auth";
import { api } from "./api-client";

let activeProductId: string | null = null;

function buildVendorProfile(vendorName: string): string {
  const profile = vendorProfiles[vendorName];
  if (!profile) return "";
  const stars = renderStars(profile.rating);
  return `
    <div class="vendor-profile-card">
      <div class="vendor-profile-header">
        <strong>${escapeHtml(profile.name)}</strong>
        <span class="vendor-since">${getCopy(`Since ${profile.since}`, `Tun ${profile.since}`)}</span>
      </div>
      <div class="vendor-stats">
        <span class="vendor-rating-stars">${stars} <strong>${profile.rating.toFixed(1)}</strong></span>
        <span>${escapeHtml(String(profile.totalOrders))} ${getCopy("orders", "oda")}</span>
        <span>${escapeHtml(String(profile.fulfillmentRate))}% ${getCopy("fulfilled", "an cika")}</span>
      </div>
      <p class="vendor-response">${getCopy("Response: ", "Amsa: ")}${escapeHtml(getLocalizedValue(profile.responseTime))}</p>
    </div>
  `;
}

function buildModalHtml(product: Product): string {
  const name = product.name[state.language];
  const subcategory = product.subcategory[state.language];
  const availability = product.availability[state.language];
  const avg = getAverageRating(product.id);
  const reviewCount = getProductReviews(product.id).length;
  const wished = isWishlisted(product.id);

  return `
    <div class="modal-backdrop" id="productModal" role="dialog" aria-modal="true" aria-labelledby="productModalName">
      <div class="modal-box modal-box-wide">
        <div class="modal-header">
          <h2 id="productModalName">${escapeHtml(name)}</h2>
          <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">×</button>
        </div>

        <div class="product-modal-body">
          <div class="product-modal-thumb" style="--accent: ${product.accent}">
            ${product.imageDataUrl ? `<img src="${escapeHtml(product.imageDataUrl)}" alt="${escapeHtml(name)}" loading="lazy" />` : `<span>${escapeHtml(subcategory)}</span>`}
          </div>

          <div class="product-modal-meta">
            <p class="product-meta">
              <span>${escapeHtml(product.category[state.language])}</span>
              <span>${escapeHtml(product.vendor)}</span>
              <span>${escapeHtml(product.area)}</span>
            </p>
            <p class="availability">${escapeHtml(availability)}</p>
            ${product.description?.[state.language] ? `<p>${escapeHtml(product.description[state.language])}</p>` : ""}
            <p>${getCopy("Stock", "Adadi")}: ${escapeHtml(String(product.quantityAvailable ?? "Available"))}</p>
            ${reviewCount > 0 ? `
              <div class="modal-review-summary">
                ${renderStars(avg)} <span class="review-count-label">${avg.toFixed(1)} (${reviewCount} ${getCopy("reviews", "ra'ayoyi")})</span>
              </div>
            ` : ""}
          </div>

          <div class="product-modal-price">
            <span class="price">${escapeHtml(product.price)}</span>
          </div>

          <div class="product-modal-actions">
            <button type="button" class="btn-primary" id="modalAddToCart">
              ${getCopy("Add to cart", "Saka a kwando")}
            </button>
            <button type="button" class="btn-wishlist${wished ? " is-wishlisted" : ""}" id="modalWishlist"
              aria-pressed="${wished}" aria-label="${wished ? getCopy("Remove from wishlist", "Cire daga jerin da aka ajiye") : getCopy("Save to wishlist", "Ajiye zuwa jerin kaya")}">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>
              </svg>
              ${wished ? getCopy("Saved", "An ajiye") : getCopy("Save", "Ajiye")}
            </button>
          </div>

          ${buildVendorProfile(product.vendor)}

          <section class="reviews-section">
            <h3>${getCopy("Customer reviews", "Ra'ayoyin kwastomomi")}</h3>
            <div id="modalReviewList">
              ${reviewCount > 0 ? renderReviewList(product.id) : `<p class="muted">${getCopy("No reviews yet. Be the first!", "Babu ra'ayoyi tukuna. Ka fara!")}</p>`}
            </div>
            <div id="modalReviewForm">
              ${renderReviewForm(product.id)}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

export function openProductModal(productId: string): void {
  const product = getProductById(productId);
  if (!product) return;

  closeProductModal();
  activeProductId = productId;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = buildModalHtml(product);
  const modal = wrapper.firstElementChild as HTMLElement;
  document.body.appendChild(modal);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => modal.classList.add("modal-visible"));
  });

  modal.querySelector(".modal-close")?.addEventListener("click", closeProductModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeProductModal(); });

  modal.querySelector<HTMLImageElement>(".product-modal-thumb img")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const src = (e.currentTarget as HTMLImageElement).src;
    const lb = document.createElement("div");
    lb.className = "img-lightbox";
    lb.innerHTML = `<button class="img-lightbox-close" aria-label="Close">×</button><img src="${escapeHtml(src)}" alt="${escapeHtml(product.name[state.language])}" />`;
    document.body.appendChild(lb);
    const close = () => lb.remove();
    lb.addEventListener("click", close);
    lb.querySelector(".img-lightbox-close")?.addEventListener("click", close);
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { close(); document.removeEventListener("keydown", onKey); } };
    document.addEventListener("keydown", onKey);
  });

  modal.querySelector("#modalAddToCart")?.addEventListener("click", () => {
    if (!state.currentUser) { closeProductModal(); openAuthModal(); return; }
    addToCart(productId);
    const btn = modal.querySelector<HTMLButtonElement>("#modalAddToCart")!;
    btn.textContent = getCopy("Added!", "An saka!");
    window.setTimeout(() => {
      btn.textContent = getCopy("Add to cart", "Saka a kwando");
    }, 1400);
  });

  modal.querySelector("#modalWishlist")?.addEventListener("click", () => {
    if (!state.currentUser) { closeProductModal(); openAuthModal(); return; }
    toggleWishlist(productId, product.name[state.language]);
    syncWishlistCount();
    const btn = modal.querySelector<HTMLButtonElement>("#modalWishlist")!;
    const now = isWishlisted(productId);
    btn.classList.toggle("is-wishlisted", now);
    btn.setAttribute("aria-pressed", String(now));
    btn.querySelector("svg")?.nextSibling?.replaceWith(
      document.createTextNode(` ${now ? getCopy("Saved", "An ajiye") : getCopy("Save", "Ajiye")}`)
    );
  });

  const reviewForm = modal.querySelector<HTMLFormElement>("#reviewForm");
  reviewForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(reviewForm);
    const name = String(data.get("reviewerName") || "").trim();
    const rating = Number(data.get("rating") || 0);
    const comment = String(data.get("comment") || "").trim();
    const msgEl = modal.querySelector<HTMLElement>("#reviewMessage")!;

    if (!name) {
      msgEl.textContent = getCopy("Enter your name before submitting a review.", "Shigar da sunanka kafin ka aika ra'ayi.");
      reviewForm.querySelector<HTMLInputElement>("input[name='reviewerName']")?.focus();
      return;
    }
    if (!rating) {
      msgEl.textContent = getCopy("Choose a rating for your review.", "Zaɓi daraja don ra'ayinka.");
      reviewForm.querySelector<HTMLInputElement>("input[name='rating']")?.focus();
      return;
    }
    if (!comment || comment.length < 10) {
      msgEl.textContent = getCopy("Write a longer review comment (at least 10 characters).", "Rubuta tsawon sharhi na ra'ayi (akalla haruffa 10)."
      );
      reviewForm.querySelector<HTMLTextAreaElement>("textarea[name='comment']")?.focus();
      return;
    }

    addReview(productId, name, rating, comment);
    msgEl.textContent = getCopy("Review submitted. Thank you!", "An aika ra'ayin. Na gode!");
    reviewForm.reset();

    const listEl = modal.querySelector<HTMLElement>("#modalReviewList")!;
    listEl.innerHTML = renderReviewList(productId);
    showToast({ message: getCopy("Review added!", "An saka ra'ayi!") });
  });

  document.addEventListener("keydown", handleModalKeydown);
  modal.querySelector<HTMLElement>("#modalAddToCart")?.focus();

  // Fetch live reviews from API and overlay them in the modal
  api.productReviews(productId)
    .then((res) => {
      const listEl = modal.querySelector<HTMLElement>("#modalReviewList");
      if (!listEl || !res.reviews.length) return;
      listEl.innerHTML = res.reviews
        .slice(0, 5)
        .map(
          (r) => `
          <div class="review-item">
            <div class="review-header">
              <span class="review-stars">${renderStars(r.rating)}</span>
              <strong>${escapeHtml(r.reviewerName ?? "")}</strong>
              <span class="review-date">${escapeHtml(formatDate(r.createdAt))}</span>
            </div>
            <p>${escapeHtml(r.comment)}</p>
          </div>`
        )
        .join("");
    })
    .catch(() => undefined);
}

export function closeProductModal(): void {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
  document.removeEventListener("keydown", handleModalKeydown);
  activeProductId = null;
}

function handleModalKeydown(e: KeyboardEvent): void {
  if (e.key === "Escape") closeProductModal();
}
