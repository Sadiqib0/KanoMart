import type { Product, SearchRecord } from "../backend/types";
import { storageKeys } from "../backend/data";
import { getStoredList, setStoredList, createId } from "../backend/storage";
import { state } from "./state";
import { normalize } from "./utils";
import { getCatalogProducts } from "../backend/products";

export function getProductText(product: Product): string {
  return normalize(
    [
      product.name.en,
      product.name.ha,
      product.category.en,
      product.category.ha,
      product.subcategory.en,
      product.subcategory.ha,
      product.vendor,
      product.area,
      ...product.tags,
    ].join(" ")
  );
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyMatchesTerm(text: string, term: string): boolean {
  if (text.includes(term)) return true;
  const len = term.length;
  if (len < 4) return false;
  const maxDistance = len <= 6 ? 1 : 2;
  const words = text.split(" ");
  return words.some((word) => {
    if (Math.abs(word.length - len) > maxDistance) return false;
    return levenshtein(word, term) <= maxDistance;
  });
}

export function getSearchResults(query: string): Product[] {
  const cleanQuery = normalize(query);
  const terms = cleanQuery.split(" ").filter(Boolean);

  return getCatalogProducts().filter((product) => {
    const text = getProductText(product);
    if (text.includes(cleanQuery)) return true;
    return terms.every((term) => fuzzyMatchesTerm(text, term));
  });
}

const demandDictionary: Array<{ category: string; terms: string[] }> = [
  { category: "food", terms: ["food", "abinci", "rice", "shinkafa", "tuwo", "snack", "groceries"] },
  { category: "fashion", terms: ["fashion", "kaya", "yaduka", "shoe", "takalma", "turare", "perfume"] },
  { category: "children", terms: ["children", "yara", "school", "makaranta", "book", "littafi", "bag"] },
];

export function inferDemandCategory(query: string, results: Product[]): string {
  if (results.length > 0) return results[0].category.en.toLowerCase();
  const value = normalize(query);
  const match = demandDictionary.find((entry) => entry.terms.some((term) => value.includes(term)));
  return match ? match.category : "unmatched demand";
}

export function saveSearch(query: string, results: Product[]): void {
  const history = getStoredList<SearchRecord>(storageKeys.searches);
  history.unshift({
    id: createId(),
    query,
    language: state.language,
    resultCount: results.length,
    category: inferDemandCategory(query, results),
    status: results.length > 0 ? "matched" : "saved demand",
    createdAt: new Date().toISOString(),
  });
  setStoredList(storageKeys.searches, history.slice(0, 100));
}
