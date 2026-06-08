import type { Product } from "../backend/types";
import { getSearchResults } from "./search";

export const PRODUCT_PAGE_SIZE = 8;

const searchCache = new Map<string, Product[]>();

export function getCachedSearchResults(query: string): Product[] {
  const key = query.trim().toLowerCase();
  const cached = searchCache.get(key);
  if (cached) return cached;

  const results = getSearchResults(query);
  searchCache.set(key, results);
  return results;
}

export function paginateProducts(products: Product[], visibleCount: number): {
  visibleProducts: Product[];
  hasMore: boolean;
} {
  const nextCount = Math.max(PRODUCT_PAGE_SIZE, visibleCount);
  return {
    visibleProducts: products.slice(0, nextCount),
    hasMore: products.length > nextCount,
  };
}

export function renderProductSkeletons(count = PRODUCT_PAGE_SIZE): string {
  return Array.from(
    { length: count },
    () => `
      <article class="product-card product-skeleton" aria-hidden="true">
        <div class="product-thumb"></div>
        <h3></h3>
        <p class="product-meta"><span></span><span></span></p>
        <footer><span class="price"></span><button type="button" tabindex="-1"></button></footer>
      </article>
    `
  ).join("");
}
