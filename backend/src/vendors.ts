import type { VendorApprovalStatus, VendorRequest } from "./types";
import { storageKeys } from "./data";
import { getStoredList, setStoredList, createId } from "./storage";
import { normalizePhone } from "./phone";

export function normalizeVendorRequest(request: VendorRequest): VendorRequest {
  return {
    ...request,
    status: request.status ?? "pending",
  };
}

export function getVendorRequests(): VendorRequest[] {
  const seen = new Set<string>();
  return [...getStoredList<VendorRequest>(storageKeys.liveVendors), ...getStoredList<VendorRequest>(storageKeys.vendors)]
    .map(normalizeVendorRequest)
    .filter((vendor) => {
      if (seen.has(vendor.id)) return false;
      seen.add(vendor.id);
      return true;
    });
}

export function setLiveVendorRequests(nextVendors: VendorRequest[]): void {
  setStoredList(storageKeys.liveVendors, nextVendors);
}

export function saveVendorRequest(input: {
  businessName: string;
  phone: string;
  area: string;
  category: string;
}): VendorRequest {
  const request: VendorRequest = {
    id: createId(),
    businessName: input.businessName.trim(),
    phone: normalizePhone(input.phone),
    area: input.area.trim(),
    category: input.category,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  setStoredList(storageKeys.vendors, [request, ...getVendorRequests()]);
  return request;
}

export function reviewVendorRequest(
  id: string,
  status: Exclude<VendorApprovalStatus, "pending">,
  reviewNote = ""
): VendorRequest | null {
  const vendors = getVendorRequests();
  const vendor = vendors.find((item) => item.id === id);
  if (!vendor) return null;

  vendor.status = status;
  vendor.reviewedAt = new Date().toISOString();
  vendor.reviewNote = reviewNote.trim();
  setStoredList(storageKeys.vendors, vendors);
  return vendor;
}

export function getVendorStatusCounts(vendors = getVendorRequests()): Record<VendorApprovalStatus, number> {
  return vendors.reduce(
    (counts, vendor) => {
      counts[vendor.status ?? "pending"] += 1;
      return counts;
    },
    { pending: 0, approved: 0, rejected: 0 } as Record<VendorApprovalStatus, number>
  );
}
