import type { WithdrawalRequest } from "./types";
import { storageKeys } from "./data";
import { createId, getStoredList, setStoredList } from "./storage";
import { getVendorAvailableBalance, recordWithdrawalDebit } from "./wallet";

export function getWithdrawals(): WithdrawalRequest[] {
  return getStoredList<WithdrawalRequest>(storageKeys.withdrawals);
}

export function getPendingWithdrawalTotal(vendor: string): number {
  return getWithdrawals()
    .filter((withdrawal) => withdrawal.vendor === vendor && withdrawal.status === "pending")
    .reduce((total, withdrawal) => total + withdrawal.amount, 0);
}

export function getWithdrawableBalance(vendor: string): number {
  return Math.max(0, getVendorAvailableBalance(vendor) - getPendingWithdrawalTotal(vendor));
}

export function requestWithdrawal(vendor: string, amount: number): WithdrawalRequest | null {
  const cleanVendor = vendor.trim();
  const cleanAmount = Math.round(amount);
  if (!cleanVendor || cleanAmount <= 0) return null;
  if (cleanAmount > getWithdrawableBalance(cleanVendor)) return null;

  const withdrawal: WithdrawalRequest = {
    id: createId(),
    vendor: cleanVendor,
    amount: cleanAmount,
    status: "pending",
    requestedAt: new Date().toISOString(),
  };

  setStoredList(storageKeys.withdrawals, [withdrawal, ...getWithdrawals()]);
  return withdrawal;
}

export function approveWithdrawal(id: string, reviewNote = ""): WithdrawalRequest | null {
  const withdrawals = getWithdrawals();
  const withdrawal = withdrawals.find((item) => item.id === id);
  if (!withdrawal) return null;
  if (withdrawal.status === "approved") return withdrawal;
  if (withdrawal.status === "rejected") return null;
  if (withdrawal.amount > getVendorAvailableBalance(withdrawal.vendor)) return null;

  withdrawal.status = "approved";
  withdrawal.reviewedAt = new Date().toISOString();
  withdrawal.reviewNote = reviewNote.trim();
  setStoredList(storageKeys.withdrawals, withdrawals);
  recordWithdrawalDebit(withdrawal);
  return withdrawal;
}

export function rejectWithdrawal(id: string, reviewNote = ""): WithdrawalRequest | null {
  const withdrawals = getWithdrawals();
  const withdrawal = withdrawals.find((item) => item.id === id);
  if (!withdrawal || withdrawal.status === "approved") return null;
  if (withdrawal.status === "rejected") return withdrawal;

  withdrawal.status = "rejected";
  withdrawal.reviewedAt = new Date().toISOString();
  withdrawal.reviewNote = reviewNote.trim();
  setStoredList(storageKeys.withdrawals, withdrawals);
  return withdrawal;
}
