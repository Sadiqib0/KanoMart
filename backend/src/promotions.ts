import type { Product, PromotionCampaign, PromotionType } from "./types";
import { storageKeys } from "./data";
import { createId, getStoredList, setStoredList } from "./storage";

export interface PromotionInput {
  title: string;
  titleHa?: string;
  type: PromotionType;
  discountPercent?: number;
  code?: string;
  productId?: string;
  vendor?: string;
  category?: string;
  daysActive?: number;
}

export function getPromotions(): PromotionCampaign[] {
  return getStoredList<PromotionCampaign>(storageKeys.promotions);
}

export function getActivePromotions(now = new Date()): PromotionCampaign[] {
  const time = now.getTime();
  return getPromotions().filter((promotion) => {
    if (!promotion.active) return false;
    if (new Date(promotion.startsAt).getTime() > time) return false;
    if (promotion.endsAt && new Date(promotion.endsAt).getTime() < time) return false;
    return true;
  });
}

export function createPromotion(input: PromotionInput): PromotionCampaign {
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + (input.daysActive ?? 14) * 24 * 60 * 60 * 1000);
  const promotion: PromotionCampaign = {
    id: createId(),
    title: {
      en: input.title.trim().slice(0, 80) || "Kano Mart promotion",
      ha: (input.titleHa || input.title).trim().slice(0, 80) || "Tallan Kano Mart",
    },
    type: input.type,
    discountPercent:
      typeof input.discountPercent === "number" ? Math.max(0, Math.min(90, Math.round(input.discountPercent))) : undefined,
    code: input.code?.trim().toUpperCase().slice(0, 24),
    productId: input.productId?.trim(),
    vendor: input.vendor?.trim(),
    category: input.category?.trim(),
    active: true,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    createdAt: startsAt.toISOString(),
  };
  setStoredList(storageKeys.promotions, [promotion, ...getPromotions()]);
  return promotion;
}

export function setPromotionActive(id: string, active: boolean): PromotionCampaign | null {
  const promotions = getPromotions();
  const promotion = promotions.find((item) => item.id === id);
  if (!promotion) return null;
  promotion.active = active;
  setStoredList(storageKeys.promotions, promotions);
  return promotion;
}

export function getPromotionForProduct(product: Product): PromotionCampaign | undefined {
  return getActivePromotions().find((promotion) => {
    if (promotion.type === "featured_product" && promotion.productId === product.id) return true;
    if (promotion.productId && promotion.productId !== product.id) return false;
    if (promotion.vendor && promotion.vendor !== product.vendor) return false;
    if (promotion.category && promotion.category !== product.category.en.toLowerCase()) return false;
    return promotion.discountPercent || promotion.type === "flash_sale" || promotion.type === "seasonal_campaign";
  });
}

export function getDiscountedPrice(amount: number, promotion?: PromotionCampaign): number {
  if (!promotion?.discountPercent) return amount;
  return Math.max(0, Math.round(amount * (1 - promotion.discountPercent / 100)));
}
