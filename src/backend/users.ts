import type { UserProfile, UserRole, UserSession, VendorApprovalStatus } from "./types";
import { ADMIN_MOBILE_NUMBER, storageKeys } from "./data";
import { getStoredList, setStoredList } from "./storage";
import { getVendorRequests, saveVendorRequest } from "./vendors";
import { normalizePhone } from "./phone";

export interface SignupInput {
  phone: string;
  email?: string;
  password?: string;
  firstName: string;
  lastName: string;
  accountType: Exclude<UserRole, "admin">;
  deliveryAddress?: string;
  preferredLanguage?: "en" | "ha";
  businessName?: string;
  area?: string;
  category?: string;
}

function hashPassword(value = ""): string {
  const normalized = value.trim();
  if (!normalized) return "";
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `demo-${Math.abs(hash).toString(36)}`;
}

export function getUserProfiles(): UserProfile[] {
  return getStoredList<UserProfile>(storageKeys.users).map((profile) => ({
    ...profile,
    phone: normalizePhone(profile.phone),
    role: profile.role === "vendor" ? "vendor" : "customer",
  }));
}

export function findUserProfileByPhone(phone: string): UserProfile | null {
  const normalized = normalizePhone(phone);
  return getUserProfiles().find((profile) => profile.phone === normalized) ?? null;
}

export function findUserProfileByEmail(email: string): UserProfile | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  return getUserProfiles().find((profile) => profile.email?.toLowerCase() === normalized) ?? null;
}

export function isAdminPhone(phone: string): boolean {
  return normalizePhone(phone) === normalizePhone(ADMIN_MOBILE_NUMBER);
}

export function findVendorByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  return getVendorRequests().find((vendor) => normalizePhone(vendor.phone) === normalized) ?? null;
}

export function requiresSignup(phone: string): boolean {
  if (isAdminPhone(phone)) return false;
  return !findUserProfileByPhone(phone) && !findVendorByPhone(phone);
}

export function saveUserProfile(input: SignupInput): UserProfile {
  const now = new Date().toISOString();
  const phone = normalizePhone(input.phone);
  const existing = findUserProfileByPhone(phone);
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const role = input.accountType === "vendor" ? "vendor" : "customer";

  const profile: UserProfile = {
    phone,
    email: input.email?.trim().toLowerCase() || existing?.email,
    passwordHash: input.password ? hashPassword(input.password) : existing?.passwordHash,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ") || phone,
    role,
    deliveryAddress: input.deliveryAddress?.trim() || existing?.deliveryAddress,
    preferredLanguage: input.preferredLanguage ?? existing?.preferredLanguage ?? "en",
    disabled: existing?.disabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextProfiles = [profile, ...getUserProfiles().filter((item) => item.phone !== phone)];
  setStoredList(storageKeys.users, nextProfiles);

  if (role === "vendor" && !findVendorByPhone(phone)) {
    saveVendorRequest({
      businessName: input.businessName?.trim() || profile.name,
      phone,
      area: input.area?.trim() || "Kano",
      category: input.category || "essentials",
    });
  }

  return profile;
}

export function updateUserProfile(phone: string, input: Partial<SignupInput>): UserProfile | null {
  const existing = findUserProfileByPhone(phone);
  if (!existing) return null;
  return saveUserProfile({
    phone: existing.phone,
    firstName: input.firstName ?? existing.firstName,
    lastName: input.lastName ?? existing.lastName,
    email: input.email ?? existing.email,
    password: input.password,
    accountType: existing.role,
    deliveryAddress: input.deliveryAddress ?? existing.deliveryAddress,
    preferredLanguage: input.preferredLanguage ?? existing.preferredLanguage,
  });
}

export function resetUserPassword(identifier: string, password: string): boolean {
  const profile = findUserProfileByPhone(identifier) ?? findUserProfileByEmail(identifier);
  if (!profile || !password.trim()) return false;
  updateUserProfile(profile.phone, { password });
  return true;
}

export function verifyPassword(identifier: string, password: string): boolean {
  const profile = findUserProfileByPhone(identifier) ?? findUserProfileByEmail(identifier);
  if (!profile?.passwordHash) return true;
  return profile.passwordHash === hashPassword(password);
}

export function createSessionForPhone(phone: string): UserSession {
  const normalized = normalizePhone(phone);
  const profile = findUserProfileByPhone(normalized);

  if (isAdminPhone(normalized)) {
    return {
      phone: normalized,
      firstName: "Admin",
      lastName: "",
      name: "Kano Mart Admin",
      role: "admin",
      createdAt: new Date().toISOString(),
    };
  }

  const vendor = findVendorByPhone(normalized);
  if (vendor) {
    return {
      phone: normalized,
      email: profile?.email,
      firstName: profile?.firstName || vendor.businessName,
      lastName: profile?.lastName || "",
      name: profile?.name || vendor.businessName,
      role: "vendor",
      vendorStatus: (vendor.status ?? "pending") as VendorApprovalStatus,
      deliveryAddress: profile?.deliveryAddress,
      preferredLanguage: profile?.preferredLanguage,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    phone: normalized,
    email: profile?.email,
    firstName: profile?.firstName || "",
    lastName: profile?.lastName || "",
    name: profile?.name || normalized,
    role: "customer",
    deliveryAddress: profile?.deliveryAddress,
    preferredLanguage: profile?.preferredLanguage,
    createdAt: new Date().toISOString(),
  };
}

export function migrateSession(session: Partial<UserSession> | null): UserSession | null {
  if (!session?.phone) return null;
  const resolved = createSessionForPhone(session.phone);
  return {
    ...resolved,
    firstName: session.firstName || resolved.firstName,
    lastName: session.lastName || resolved.lastName,
    name: session.name || resolved.name,
    createdAt: session.createdAt || resolved.createdAt,
  };
}
