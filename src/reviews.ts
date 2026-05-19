import type { Review } from "./types";
import { storageKeys, seedReviews } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { escapeHtml, getCopy, formatDate, renderStars } from "./utils";

function getAllReviews(): Review[] {
  const stored = getStoredList<Review>(storageKeys.reviews);
  // Merge seed reviews that aren't already overridden
  const storedIds = new Set(stored.map((r) => r.id));
  const seeds = seedReviews.filter((r) => !storedIds.has(r.id));
  return [...stored, ...seeds];
}

export function getProductReviews(productId: string): Review[] {
  return getAllReviews()
    .filter((r) => r.productId === productId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getAverageRating(productId: string): number {
  const reviews = getProductReviews(productId);
  if (reviews.length === 0) return 0;
  return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
}

export function addReview(productId: string, reviewerName: string, rating: number, comment: string): void {
  const stored = getStoredList<Review>(storageKeys.reviews);
  stored.unshift({
    id: createId(),
    productId,
    reviewerName,
    rating,
    comment,
    createdAt: new Date().toISOString(),
  });
  setStoredList(storageKeys.reviews, stored);
}

export function renderReviewSummary(productId: string): string {
  const reviews = getProductReviews(productId);
  const avg = getAverageRating(productId);
  if (reviews.length === 0) {
    return `<p class="muted review-empty">${getCopy("No reviews yet.", "Babu sakamako tukuna.")}</p>`;
  }
  return `
    <div class="review-summary">
      <span class="review-avg">${avg.toFixed(1)}</span>
      <span class="review-stars">${renderStars(avg)}</span>
      <span class="review-count">(${reviews.length})</span>
    </div>
  `;
}

export function renderReviewList(productId: string): string {
  const reviews = getProductReviews(productId).slice(0, 5);
  if (reviews.length === 0) return "";
  return reviews
    .map(
      (r) => `
      <div class="review-item">
        <div class="review-header">
          <span class="review-stars">${renderStars(r.rating)}</span>
          <strong>${escapeHtml(r.reviewerName)}</strong>
          <span class="review-date">${escapeHtml(formatDate(r.createdAt))}</span>
        </div>
        <p>${escapeHtml(r.comment)}</p>
      </div>
    `
    )
    .join("");
}

export function renderReviewForm(productId: string): string {
  return `
    <form class="review-form" id="reviewForm" data-product-id="${escapeHtml(productId)}">
      <h4>${getCopy("Write a review", "Rubuta sakamako")}</h4>
      <label>
        <span>${getCopy("Your name", "Sunanka")}</span>
        <input type="text" name="reviewerName" required minlength="2" />
      </label>
      <fieldset class="star-fieldset">
        <legend>${getCopy("Rating", "Darajа")}</legend>
        ${[5, 4, 3, 2, 1]
          .map(
            (n) => `
          <label class="star-label">
            <input type="radio" name="rating" value="${n}" required />
            <span aria-hidden="true">★</span>
          </label>
        `
          )
          .join("")}
      </fieldset>
      <label>
        <span>${getCopy("Comment", "Ra'ayi")}</span>
        <textarea name="comment" required minlength="10" rows="3"></textarea>
      </label>
      <button type="submit">${getCopy("Submit review", "Aika sakamako")}</button>
      <p class="form-message" id="reviewMessage" role="status"></p>
    </form>
  `;
}
