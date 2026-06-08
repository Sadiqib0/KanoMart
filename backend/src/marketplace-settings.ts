import type { CommissionSettings, VendorPlanId, VendorSubscription, VendorSubscriptionPlan } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList } from "./storage";

export const vendorSubscriptionPlans: VendorSubscriptionPlan[] = [
  {
    id: "free",
    name: "Free",
    monthlyFee: 0,
    productLimit: 8,
    featuredPlacement: false,
    commissionRate: 0.12,
  },
  {
    id: "standard",
    name: "Standard",
    monthlyFee: 5000,
    productLimit: 40,
    featuredPlacement: false,
    commissionRate: 0.1,
  },
  {
    id: "premium",
    name: "Premium",
    monthlyFee: 15000,
    productLimit: 120,
    featuredPlacement: true,
    commissionRate: 0.08,
  },
];

const defaultCommissionSettings: CommissionSettings = {
  defaultRate: 0.1,
  perVendorRates: {},
  updatedAt: new Date(0).toISOString(),
};

export function getCommissionSettings(): CommissionSettings {
  try {
    const raw = localStorage.getItem(storageKeys.commissionSettings);
    return raw ? { ...defaultCommissionSettings, ...JSON.parse(raw) } : defaultCommissionSettings;
  } catch {
    return defaultCommissionSettings;
  }
}

export function saveCommissionSettings(input: Partial<CommissionSettings>): CommissionSettings {
  const settings: CommissionSettings = {
    ...getCommissionSettings(),
    ...input,
    defaultRate: Math.max(0, Math.min(0.5, input.defaultRate ?? getCommissionSettings().defaultRate)),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(storageKeys.commissionSettings, JSON.stringify(settings));
  return settings;
}

export function getVendorSubscriptions(): VendorSubscription[] {
  return getStoredList<VendorSubscription>(storageKeys.vendorSubscriptions);
}

export function getVendorSubscription(vendor: string): VendorSubscription {
  return (
    getVendorSubscriptions().find((subscription) => subscription.vendor === vendor) ?? {
      vendor,
      planId: "free",
      status: "active",
      updatedAt: new Date(0).toISOString(),
    }
  );
}

export function setVendorSubscription(vendor: string, planId: VendorPlanId): VendorSubscription {
  const next: VendorSubscription = {
    vendor,
    planId,
    status: "active",
    paidThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  setStoredList(storageKeys.vendorSubscriptions, [
    next,
    ...getVendorSubscriptions().filter((subscription) => subscription.vendor !== vendor),
  ]);
  return next;
}

export function getVendorPlan(vendor: string): VendorSubscriptionPlan {
  const subscription = getVendorSubscription(vendor);
  return vendorSubscriptionPlans.find((plan) => plan.id === subscription.planId) ?? vendorSubscriptionPlans[0];
}

export function getCommissionRateForVendor(vendor: string): number {
  const settings = getCommissionSettings();
  const customRate = settings.perVendorRates[vendor];
  if (typeof customRate === "number") return customRate;
  return getVendorPlan(vendor).commissionRate || settings.defaultRate;
}

export function getVendorSubscriptionRevenue(): number {
  return getVendorSubscriptions().reduce((total, subscription) => {
    if (subscription.status !== "active") return total;
    const plan = vendorSubscriptionPlans.find((item) => item.id === subscription.planId);
    return total + (plan?.monthlyFee ?? 0);
  }, 0);
}
