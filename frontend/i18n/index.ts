/**
 * i18n dictionary module.
 * Replaces the data-en / data-ha attribute pairs with a proper dictionary.
 * Usage: t("home") → "Home" (en) or "Gida" (ha)
 *
 * The HTML still ships data-en / data-ha for backward compat with setLanguage().
 * This module is the single source of truth for all UI copy.
 */

import en from "./en.json";
import ha from "./ha.json";

export type Lang = "en" | "ha";

export type I18nKey = keyof typeof en;

const dictionaries: Record<Lang, Record<string, string>> = { en, ha };

let _lang: Lang = "en";

export function setI18nLang(lang: Lang): void {
  _lang = lang;
}

/** Look up a key in the current language. Falls back to English. */
export function t(key: I18nKey | string): string {
  return dictionaries[_lang]?.[key] ?? dictionaries.en?.[key] ?? key;
}

/** Look up a raw English string by value. Returns the key. */
export function keyForEnglish(value: string): string | undefined {
  return Object.keys(en).find((k) => (en as Record<string, string>)[k] === value);
}

/**
 * Apply the current language to every element with data-en / data-ha.
 * This bridges the old attribute system with the new dictionary.
 */
export function applyLanguageToDOM(lang: Lang): void {
  _lang = lang;
  document.querySelectorAll<HTMLElement>("[data-en][data-ha]").forEach((node) => {
    // Skip sidebar nav links — they have inner spans (icon + title) that must stay intact
    if (node.matches(".sidebar-nav a, .sidebar-vendor-cta")) return;
    node.textContent = node.dataset[lang] ?? "";
  });
  document.querySelectorAll<HTMLImageElement>("[data-alt-en][data-alt-ha]").forEach((node) => {
    node.alt = lang === "en" ? (node.dataset.altEn ?? "") : (node.dataset.altHa ?? "");
  });
  document.querySelectorAll<HTMLElement>("[data-aria-en][data-aria-ha]").forEach((node) => {
    node.setAttribute("aria-label", lang === "en" ? (node.dataset.ariaEn ?? "") : (node.dataset.ariaHa ?? ""));
  });
  document.querySelectorAll<HTMLInputElement>("[data-placeholder-en][data-placeholder-ha]").forEach((node) => {
    node.placeholder = lang === "en" ? (node.dataset.placeholderEn ?? "") : (node.dataset.placeholderHa ?? "");
  });
}

export const i18n = { t, setI18nLang, applyLanguageToDOM, keyForEnglish };
export default i18n;
