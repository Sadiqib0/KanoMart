import type { Order, VendorWalletSummary, WalletLedgerEntry, WithdrawalRequest } from "./types";
import { storageKeys } from "./data";
import { createId, getStoredList, setStoredList } from "./storage";
import { getVendorSubscriptionRevenue } from "./marketplace-settings";

export const PLATFORM_COMMISSION_RATE = 0.1;

export function calculateCommission(amount: number, rate = PLATFORM_COMMISSION_RATE): number {
  return Math.round(amount * rate);
}

export function getWalletLedger(): WalletLedgerEntry[] {
  return getStoredList<WalletLedgerEntry>(storageKeys.walletLedger);
}

export function settleDeliveredOrder(orderId: string): WalletLedgerEntry[] {
  const ledger = getWalletLedger();
  let changed = false;
  const availableAt = new Date().toISOString();
  const updated = ledger.map((entry) => {
    if (entry.orderId !== orderId || entry.type !== "vendor_pending_credit" || entry.status === "available") {
      return entry;
    }

    changed = true;
    return {
      ...entry,
      status: "available" as const,
      availableAt,
    };
  });

  if (changed) {
    setStoredList(storageKeys.walletLedger, updated);
  }

  return updated.filter((entry) => entry.orderId === orderId);
}

export function createLedgerEntriesForPaidOrder(order: Order): WalletLedgerEntry[] {
  const existing = getWalletLedger();
  if (existing.some((entry) => entry.orderId === order.id)) {
    return existing.filter((entry) => entry.orderId === order.id);
  }

  const createdAt = new Date().toISOString();
  const entries = order.items.flatMap((item) => [
    {
      id: createId(),
      orderId: order.id,
      productId: item.productId,
      vendor: item.vendor,
      type: "vendor_pending_credit" as const,
      status: "pending" as const,
      amount: item.vendorPayout,
      createdAt,
    },
    {
      id: createId(),
      orderId: order.id,
      productId: item.productId,
      vendor: item.vendor,
      type: "platform_commission" as const,
      status: "available" as const,
      amount: item.commissionAmount,
      createdAt,
    },
  ]);

  setStoredList(storageKeys.walletLedger, [...entries, ...existing]);
  return entries;
}

export function getVendorWalletSummaries(): VendorWalletSummary[] {
  const summaries = new Map<string, VendorWalletSummary>();

  getWalletLedger().forEach((entry) => {
    const summary =
      summaries.get(entry.vendor) ??
      {
        vendor: entry.vendor,
        pendingBalance: 0,
        availableBalance: 0,
        totalCommission: 0,
      };

    if (entry.type === "vendor_pending_credit") {
      if (entry.status === "available") {
        summary.availableBalance += entry.amount;
      } else {
        summary.pendingBalance += entry.amount;
      }
    }

    if (entry.type === "platform_commission") {
      summary.totalCommission += entry.amount;
    }

    if (entry.type === "vendor_withdrawal_debit") {
      summary.availableBalance -= entry.amount;
    }

    summaries.set(entry.vendor, summary);
  });

  return [...summaries.values()].sort(
    (a, b) =>
      b.pendingBalance + b.availableBalance - (a.pendingBalance + a.availableBalance) ||
      a.vendor.localeCompare(b.vendor)
  );
}

export function getPlatformCommissionTotal(): number {
  return getWalletLedger()
    .filter((entry) => entry.type === "platform_commission")
    .reduce((total, entry) => total + entry.amount, 0);
}

export function getPlatformRevenueTotal(): number {
  return getPlatformCommissionTotal() + getVendorSubscriptionRevenue();
}

export function getVendorAvailableBalance(vendor: string): number {
  return getVendorWalletSummaries().find((summary) => summary.vendor === vendor)?.availableBalance ?? 0;
}

export function recordWithdrawalDebit(withdrawal: WithdrawalRequest): WalletLedgerEntry | null {
  const existing = getWalletLedger().find(
    (entry) => entry.orderId === withdrawal.id && entry.type === "vendor_withdrawal_debit"
  );
  if (existing) return existing;

  const entry: WalletLedgerEntry = {
    id: createId(),
    orderId: withdrawal.id,
    productId: "withdrawal",
    vendor: withdrawal.vendor,
    type: "vendor_withdrawal_debit",
    status: "available",
    amount: withdrawal.amount,
    createdAt: new Date().toISOString(),
    availableAt: new Date().toISOString(),
  };

  setStoredList(storageKeys.walletLedger, [entry, ...getWalletLedger()]);
  return entry;
}
