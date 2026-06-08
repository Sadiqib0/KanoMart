import { beforeEach, describe, expect, it } from "vitest";
import type { WithdrawalRequest } from "../backend/src/types";
import { storageKeys } from "../backend/src/data";
import {
  approveWithdrawal,
  getWithdrawableBalance,
  getWithdrawals,
  rejectWithdrawal,
  requestWithdrawal,
} from "../backend/src/withdrawals";
import { getVendorWalletSummaries, recordWithdrawalDebit } from "../backend/src/wallet";

function seedAvailableBalance(vendor = "Dan Marke Stores", amount = 9000): void {
  localStorage.setItem(
    storageKeys.walletLedger,
    JSON.stringify([
      {
        id: "credit-1",
        orderId: "KM-300001",
        productId: "food-rice",
        vendor,
        type: "vendor_pending_credit",
        status: "available",
        amount,
        createdAt: "2026-05-29T10:00:00.000Z",
        availableAt: "2026-05-29T10:00:00.000Z",
      },
    ])
  );
}

describe("vendor withdrawals", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("creates a pending withdrawal within available balance", () => {
    seedAvailableBalance();

    const withdrawal = requestWithdrawal("Dan Marke Stores", 5000);

    expect(withdrawal?.status).toBe("pending");
    expect(getWithdrawableBalance("Dan Marke Stores")).toBe(4000);
  });

  it("rejects withdrawal requests above withdrawable balance", () => {
    seedAvailableBalance();

    expect(requestWithdrawal("Dan Marke Stores", 10000)).toBeNull();
    expect(getWithdrawals()).toEqual([]);
  });

  it("approves a withdrawal and debits available balance once", () => {
    seedAvailableBalance();
    const withdrawal = requestWithdrawal("Dan Marke Stores", 5000)!;

    approveWithdrawal(withdrawal.id, "Paid to bank");
    approveWithdrawal(withdrawal.id, "Paid to bank");

    expect(getVendorWalletSummaries()[0]).toMatchObject({
      vendor: "Dan Marke Stores",
      availableBalance: 4000,
    });
  });

  it("rejects without debiting wallet", () => {
    seedAvailableBalance();
    const withdrawal = requestWithdrawal("Dan Marke Stores", 5000)!;

    rejectWithdrawal(withdrawal.id, "Bank details mismatch");

    expect(getVendorWalletSummaries()[0]).toMatchObject({
      availableBalance: 9000,
    });
  });

  it("does not duplicate withdrawal debit ledger entries", () => {
    seedAvailableBalance();
    const withdrawal: WithdrawalRequest = {
      id: "wd-1",
      vendor: "Dan Marke Stores",
      amount: 3000,
      status: "approved",
      requestedAt: "2026-05-29T10:00:00.000Z",
    };

    recordWithdrawalDebit(withdrawal);
    recordWithdrawalDebit(withdrawal);

    const debits = JSON.parse(localStorage.getItem(storageKeys.walletLedger) || "[]").filter(
      (entry: { type: string }) => entry.type === "vendor_withdrawal_debit"
    );
    expect(debits).toHaveLength(1);
  });
});
