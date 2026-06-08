import { beforeEach, describe, expect, it } from "vitest";
import type { VendorRequest } from "../backend/src/types";
import { storageKeys } from "../backend/src/data";
import {
  getVendorRequests,
  getVendorStatusCounts,
  reviewVendorRequest,
  saveVendorRequest,
} from "../backend/src/vendors";

describe("vendor approval lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves new vendor applications as pending", () => {
    const vendor = saveVendorRequest({
      businessName: "Kantin Gwale Foods",
      phone: "08012345678",
      area: "Gwale",
      category: "food",
    });

    expect(vendor.status).toBe("pending");
    expect(getVendorRequests()).toHaveLength(1);
    expect(getVendorRequests()[0].businessName).toBe("Kantin Gwale Foods");
  });

  it("treats older saved applications without status as pending", () => {
    const legacyVendor: VendorRequest = {
      id: "legacy-1",
      businessName: "Legacy Textiles",
      phone: "08012345678",
      area: "Kantin Kwari",
      category: "fashion",
      createdAt: new Date().toISOString(),
    };
    localStorage.setItem(storageKeys.vendors, JSON.stringify([legacyVendor]));

    expect(getVendorRequests()[0].status).toBe("pending");
  });

  it("approves a pending vendor and records review metadata", () => {
    const vendor = saveVendorRequest({
      businessName: "Amina Boutique",
      phone: "08012345678",
      area: "Farm Centre",
      category: "fashion",
    });

    const reviewed = reviewVendorRequest(vendor.id, "approved", "Documents checked");

    expect(reviewed?.status).toBe("approved");
    expect(reviewed?.reviewNote).toBe("Documents checked");
    expect(reviewed?.reviewedAt).toBeTruthy();
  });

  it("counts vendor statuses for admin metrics", () => {
    const pending = saveVendorRequest({
      businessName: "Pending Store",
      phone: "08012345678",
      area: "Tarauni",
      category: "food",
    });
    const rejected = saveVendorRequest({
      businessName: "Rejected Store",
      phone: "08012345679",
      area: "Hotoro",
      category: "children",
    });
    reviewVendorRequest(rejected.id, "rejected", "Incomplete details");

    expect(pending.status).toBe("pending");
    expect(getVendorStatusCounts()).toEqual({ pending: 1, approved: 0, rejected: 1 });
  });
});
