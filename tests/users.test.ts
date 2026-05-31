import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_MOBILE_NUMBER, storageKeys } from "../src/backend/data";
import { saveVendorRequest } from "../src/backend/vendors";
import {
  createSessionForPhone,
  findUserProfileByPhone,
  requiresSignup,
  saveUserProfile,
} from "../src/backend/users";

describe("role-aware mobile sign-in", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resolves the configured admin mobile number as admin", () => {
    const session = createSessionForPhone(ADMIN_MOBILE_NUMBER);

    expect(session.role).toBe("admin");
    expect(session.name).toBe("Kano Mart Admin");
  });

  it("requires first-time signup for a new customer phone", () => {
    expect(requiresSignup("08012345678")).toBe(true);

    saveUserProfile({
      phone: "08012345678",
      firstName: "Aisha",
      lastName: "Bello",
      accountType: "customer",
    });

    expect(requiresSignup("08012345678")).toBe(false);
    expect(findUserProfileByPhone("+2348012345678")?.name).toBe("Aisha Bello");
    expect(createSessionForPhone("08012345678")).toMatchObject({
      role: "customer",
      name: "Aisha Bello",
    });
  });

  it("detects a vendor from saved vendor onboarding records", () => {
    saveVendorRequest({
      businessName: "Kantin Gwale Foods",
      phone: "+2348012345678",
      area: "Gwale",
      category: "food",
    });

    const session = createSessionForPhone("08012345678");

    expect(requiresSignup("08012345678")).toBe(false);
    expect(session).toMatchObject({
      role: "vendor",
      name: "Kantin Gwale Foods",
      vendorStatus: "pending",
    });
  });

  it("creates a vendor approval request during vendor first sign-up", () => {
    saveUserProfile({
      phone: "08098765432",
      firstName: "Musa",
      lastName: "Garba",
      accountType: "vendor",
      businessName: "Musa Wears",
      area: "Fagge",
      category: "fashion",
    });

    const vendors = JSON.parse(localStorage.getItem(storageKeys.vendors) || "[]");

    expect(vendors).toHaveLength(1);
    expect(createSessionForPhone("08098765432")).toMatchObject({
      role: "vendor",
      name: "Musa Garba",
      vendorStatus: "pending",
    });
  });
});
