import type { Product, SearchRecord } from "./types";
import { products, storageKeys } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { state } from "./state";
import { normalize } from "./utils";

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

export function getSearchResults(query: string): Product[] {
  const cleanQuery = normalize(query);
  const terms = cleanQuery.split(" ").filter(Boolean);

  return products.filter((product) => {
    const text = getProductText(product);
    return text.includes(cleanQuery) || terms.some((term) => text.includes(term));
  });
}

const demandDictionary: Array<{ category: string; terms: string[] }> = [
  { category: "food", terms: ["food", "abinci", "rice", "shinkafa", "tuwo", "snack", "groceries"] },
  { category: "fashion", terms: ["fashion", "kaya", "yaduka", "shoe", "takalma", "turare", "perfume"] },
  { category: "children", terms: ["children", "yara", "school", "makaranta", "book", "littafi", "bag"] },
];

export function inferDemandCategory(query: string, results: Product[]): string {
  if (results.length > 0) {
    return results[0].category.en.toLowerCase();
  }

  const value = normalize(query);
  const match = demandDictionary.find((entry) => entry.terms.some((term) => value.includes(term)));
  return match ? match.category : "unmatched demand";
}

export function saveSearch(query: string, results: Product[]): void {
  const history = getStoredList<SearchRecord>(storageKeys.searches);
  const record: SearchRecord = {
    id: createId(),
    query,
    language: state.language,
    resultCount: results.length,
    category: inferDemandCategory(query, results),
    status: results.length > 0 ? "matched" : "saved demand",
    createdAt: new Date().toISOString(),
  };

  history.unshift(record);
  setStoredList(storageKeys.searches, history.slice(0, 100));
}
