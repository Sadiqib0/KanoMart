import type { Language, LocalizedString } from "../backend/types";
import { categoryLabels } from "../backend/data";
import { state } from "./state";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export function sanitizePlainText(value: string, maxLength = 160): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePrice(price: string): number {
  return parseInt(price.replace(/[^0-9]/g, ""), 10) || 0;
}

export function formatPrice(amount: number): string {
  return `NGN ${amount.toLocaleString("en-NG")}`;
}

export function getCopy(en: string, ha: string): string {
  return state.language === "ha" ? ha : en;
}

export function getLocalizedValue(value: LocalizedString | string): string {
  if (value !== null && typeof value === "object") {
    return value[state.language] || value.en || "";
  }
  return value || "";
}

export function localizeCategory(category: string): string {
  const key = String(category || "").toLowerCase().trim();
  return categoryLabels[key]?.[state.language] ?? category;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(state.language === "ha" ? "ha-NG" : "en-NG", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function groupByValue<T>(items: T[], accessor: (item: T) => string): Record<string, number> {
  return items.reduce(
    (acc, item) => {
      const key = accessor(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

export function sortEntries(grouped: Record<string, number>): Array<[string, number]> {
  return Object.entries(grouped).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function setActiveLanguageButtons(language: Language): void {
  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    const isActive = button.dataset.language === language;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

export function renderStars(rating: number): string {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) =>
    `<span class="star${i < full ? " star-filled" : ""}" aria-hidden="true">★</span>`
  ).join("");
}
