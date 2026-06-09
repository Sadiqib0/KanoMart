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

export function localizeStatus(status: string): string {
  const key = String(status || "unknown").toLowerCase().replace(/[\s-]+/g, "_");
  const labels: Record<string, { en: string; ha: string }> = {
    active: { en: "Active", ha: "Yana aiki" },
    approved: { en: "Approved", ha: "An amince" },
    available: { en: "Available", ha: "Akwai" },
    cancelled: { en: "Cancelled", ha: "An soke" },
    completed: { en: "Completed", ha: "An kammala" },
    confirmed: { en: "Confirmed", ha: "An tabbatar" },
    delivered: { en: "Delivered", ha: "An kai" },
    failed: { en: "Failed", ha: "Ya gaza" },
    hidden: { en: "Hidden", ha: "An boye" },
    inactive: { en: "Inactive", ha: "Ba ya aiki" },
    low_stock: { en: "Low stock", ha: "Kaya kadan" },
    out_of_stock: { en: "Out of stock", ha: "Ya kare" },
    paid: { en: "Paid", ha: "An biya" },
    pending: { en: "Pending", ha: "Ana jira" },
    pending_payment: { en: "Pending payment", ha: "Jiran biya" },
    pending_review: { en: "Pending review", ha: "Ana duba" },
    processing: { en: "Processing", ha: "Ana aiki" },
    read: { en: "Read", ha: "An karanta" },
    ready: { en: "Ready", ha: "A shirye" },
    ready_for_pickup: { en: "Ready for pickup", ha: "A shirye don dauka" },
    refunded: { en: "Refunded", ha: "An mayar" },
    rejected: { en: "Rejected", ha: "An ki" },
    shipped: { en: "Shipped", ha: "An tura" },
    taken_down: { en: "Taken down", ha: "An sauke" },
    unread: { en: "Unread", ha: "Ba a karanta ba" },
    unknown: { en: "Unknown", ha: "Ba a sani ba" },
  };
  const label = labels[key];
  return label ? getCopy(label.en, label.ha) : status.replace(/_/g, " ");
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

export function isValidPhone(phone: string): boolean {
  return /^[0-9+\s\-()]{7,20}$/.test(phone.trim());
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
