/**
 * auth-pages.ts
 * Logic for the dedicated /login and /signup page routes.
 * These are full-page experiences (two-column desktop, single-column mobile)
 * that replace the quick-modal flow for primary sign-up/sign-in journeys.
 */

import type { UserSession } from "../backend/types";
import { api } from "./api-client";
import { saveSession } from "./auth";
import { getCopy } from "./utils";
import { showToast } from "./toast";

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function isValidPhone(v: string): boolean {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function validateLogin(id: string, pw: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!id.trim()) e.identifier = "Email or phone number is required.";
  else if (id.includes("@") && !isValidEmail(id)) e.identifier = "Enter a valid email address.";
  if (!pw) e.password = "Password is required.";
  else if (pw.length < 8) e.password = "Password must be at least 8 characters.";
  return e;
}

function validateCustomer(d: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.fullName?.trim()) e.fullName = "Full name is required.";
  if (!d.email?.trim()) e.email = "Email address is required.";
  else if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
  if (!d.phone?.trim()) e.phone = "Phone number is required.";
  else if (!isValidPhone(d.phone)) e.phone = "Enter a valid Nigerian phone number (at least 10 digits).";
  if (!d.password) e.password = "Password is required.";
  else if (d.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (d.password !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
  if (!d.terms) e.terms = "You must accept the terms and conditions to continue.";
  return e;
}

function validateVendor(d: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.businessName?.trim()) e.businessName = "Business or store name is required.";
  if (!d.ownerName?.trim()) e.ownerName = "Owner full name is required.";
  if (!d.email?.trim()) e.email = "Email address is required.";
  else if (!isValidEmail(d.email)) e.email = "Enter a valid email address.";
  if (!d.phone?.trim()) e.phone = "Phone number is required.";
  else if (!isValidPhone(d.phone)) e.phone = "Enter a valid Nigerian phone number (at least 10 digits).";
  if (!d.category) e.category = "Please select your business category.";
  if (!d.area?.trim()) e.area = "Business location or area is required.";
  if (!d.password) e.password = "Password is required.";
  else if (d.password.length < 8) e.password = "Password must be at least 8 characters.";
  if (d.password !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
  if (!d.terms) e.terms = "You must accept the terms and conditions to continue.";
  return e;
}

// ─── Field error rendering ────────────────────────────────────────────────────

function applyErrors(form: HTMLElement, errors: Record<string, string>): void {
  // Clear
  form.querySelectorAll<HTMLElement>(".field-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
  form.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => el.classList.remove("has-error"));

  // Set
  for (const [field, msg] of Object.entries(errors)) {
    const errEl = form.querySelector<HTMLElement>(`[data-error="${field}"]`);
    const fieldEl = form.querySelector<HTMLElement>(`[data-field="${field}"]`);
    if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
    if (fieldEl) fieldEl.classList.add("has-error");
  }
}

function clearErrors(form: HTMLElement): void {
  form.querySelectorAll<HTMLElement>(".field-error").forEach((el) => {
    el.textContent = "";
    el.hidden = true;
  });
  form.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => el.classList.remove("has-error"));
  const fe = form.querySelector<HTMLElement>(".auth-form-error");
  if (fe) fe.textContent = "";
}

// ─── Submit button state ──────────────────────────────────────────────────────

function setLoading(btn: HTMLButtonElement | null, loading: boolean, label: string): void {
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = label;
  btn.classList.toggle("is-loading", loading);
}

// ─── Password show/hide toggle ────────────────────────────────────────────────

function wirePasswordToggles(root: HTMLElement): void {
  root.querySelectorAll<HTMLButtonElement>(".pw-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.previousElementSibling as HTMLInputElement | null;
      if (!input || input.tagName !== "INPUT") return;
      const showing = input.type !== "password";
      input.type = showing ? "password" : "text";
      btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
      btn.classList.toggle("is-showing", !showing);
      // Update icon
      const eyeOpen = btn.querySelector<SVGElement>(".eye-open");
      const eyeClosed = btn.querySelector<SVGElement>(".eye-closed");
      if (eyeOpen) eyeOpen.hidden = !showing;
      if (eyeClosed) eyeClosed.hidden = showing;
    });
  });
}

// ─── Role tabs ────────────────────────────────────────────────────────────────

function wireRoleTabs(root: HTMLElement, onChange: (role: "customer" | "vendor") => void): void {
  root.querySelectorAll<HTMLButtonElement>("[data-role-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      root.querySelectorAll<HTMLButtonElement>("[data-role-tab]").forEach((t) => {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      onChange((tab.dataset.roleTab ?? "customer") as "customer" | "vendor");
    });
  });
}

// ─── Session builder from API response ───────────────────────────────────────

function buildSession(user: { id: string; phone: string; email?: string; firstName?: string; lastName?: string; name?: string; role: "customer" | "vendor" | "admin"; vendorStatus?: string; deliveryAddress?: string; preferredLanguage?: string; createdAt?: string }, token: string): UserSession {
  return {
    id: user.id,
    token,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName ?? "",
    lastName: user.lastName ?? "",
    name: user.name ?? ([user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone),
    role: user.role,
    vendorStatus: user.vendorStatus as UserSession["vendorStatus"],
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage as UserSession["preferredLanguage"],
    createdAt: user.createdAt ?? new Date().toISOString(),
  };
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────

export function initLoginPage(): void {
  const page = document.getElementById("loginPage");
  if (!page) return;

  let currentRole: "customer" | "vendor" = "customer";

  wirePasswordToggles(page);
  wireRoleTabs(page, (role) => {
    currentRole = role;
    updateLoginRoleHint(page, role);
  });

  const form = page.querySelector<HTMLFormElement>("#loginForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitLogin(form, currentRole);
  });
}

function updateLoginRoleHint(page: HTMLElement, role: "customer" | "vendor"): void {
  const hint = page.querySelector<HTMLElement>(".auth-role-hint");
  if (!hint) return;
  hint.textContent = role === "vendor"
    ? "Sign in to access your vendor dashboard and manage your store."
    : "Sign in to shop from trusted local vendors around Kano.";
}

async function submitLogin(form: HTMLFormElement, role: "customer" | "vendor"): Promise<void> {
  clearErrors(form);
  const data = new FormData(form);
  const identifier = String(data.get("identifier") ?? "").trim();
  const password = String(data.get("password") ?? "");

  const errors = validateLogin(identifier, password);
  if (Object.keys(errors).length) {
    applyErrors(form, errors);
    form.querySelector<HTMLElement>(".has-error input")?.focus();
    return;
  }

  const btn = form.querySelector<HTMLButtonElement>("#loginSubmitBtn");
  const formErr = form.querySelector<HTMLElement>(".auth-form-error");
  setLoading(btn, true, "Signing in…");

  try {
    const res = await api.login(identifier, password);
    saveSession(buildSession(res.user, res.token));
    // Redirect handled by kanoMart:signed-in listener in app.ts
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign in failed. Please check your details and try again.";
    if (formErr) formErr.textContent = msg;
    setLoading(btn, false, "Sign in");
  }
}

// ─── SIGNUP PAGE ──────────────────────────────────────────────────────────────

export function initSignupPage(): void {
  const page = document.getElementById("signupPage");
  if (!page) return;

  let currentRole: "customer" | "vendor" = "customer";

  wirePasswordToggles(page);
  wireRoleTabs(page, (role) => {
    currentRole = role;
    applySignupRole(page, role);
  });

  // Initialise as customer
  applySignupRole(page, "customer");

  const form = page.querySelector<HTMLFormElement>("#signupForm");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void submitSignup(form, currentRole);
  });
}

function applySignupRole(page: HTMLElement, role: "customer" | "vendor"): void {
  // Show/hide role-specific sections
  page.querySelectorAll<HTMLElement>("[data-customer-only]").forEach((el) => {
    el.hidden = role !== "customer";
  });
  page.querySelectorAll<HTMLElement>("[data-vendor-only]").forEach((el) => {
    el.hidden = role !== "vendor";
  });

  // Update role hint
  const hint = page.querySelector<HTMLElement>(".auth-role-hint");
  if (hint) {
    hint.textContent = role === "vendor"
      ? "Create your store and start selling to real customers in Kano."
      : "Join thousands of customers shopping from trusted local vendors.";
  }

  // Update submit button label
  const btn = page.querySelector<HTMLButtonElement>("#signupSubmitBtn");
  if (btn && !btn.disabled) {
    btn.textContent = role === "vendor" ? "Create vendor account" : "Create my account";
  }

  // Update brand sub-copy
  const brandSub = page.querySelector<HTMLElement>("#signupBrandSub");
  if (brandSub) {
    brandSub.textContent = role === "vendor"
      ? "Set up your store in minutes and reach thousands of customers across Kano."
      : "Create your account in minutes and start shopping from trusted local vendors.";
  }
}

async function submitSignup(form: HTMLFormElement, role: "customer" | "vendor"): Promise<void> {
  clearErrors(form);

  const data = new FormData(form);
  const fields: Record<string, string> = {};
  for (const [k, v] of data.entries()) {
    if (typeof v === "string") fields[k] = v;
  }
  fields.terms = data.get("terms") ? "yes" : "";

  const errors = role === "vendor" ? validateVendor(fields) : validateCustomer(fields);
  if (Object.keys(errors).length) {
    applyErrors(form, errors);
    form.querySelector<HTMLElement>(".has-error input, .has-error select")?.scrollIntoView({ behavior: "smooth", block: "center" });
    form.querySelector<HTMLElement>(".has-error input, .has-error select")?.focus();
    return;
  }

  const btn = form.querySelector<HTMLButtonElement>("#signupSubmitBtn");
  const formErr = form.querySelector<HTMLElement>(".auth-form-error");
  setLoading(btn, true, "Creating account…");

  try {
    const [firstName, ...rest] = (role === "vendor" ? fields.ownerName : fields.fullName).trim().split(/\s+/);
    const lastName = rest.join(" ");

    const payload = role === "vendor"
      ? { phone: fields.phone, email: fields.email, password: fields.password, firstName, lastName, role: "vendor" as const, businessName: fields.businessName, area: fields.area, category: fields.category }
      : { phone: fields.phone, email: fields.email, password: fields.password, firstName, lastName, role: "customer" as const };

    const res = await api.register(payload);
    saveSession(buildSession(res.user, res.token));

    showToast({
      message: role === "vendor"
        ? getCopy("Vendor account created! Your application is under review.", "An ƙirƙiri asusun dillali! Ana duba buƙatarka.")
        : getCopy("Account created! Welcome to Kano Mart.", "An ƙirƙiri asusu! Barka da zuwa Kano Mart."),
    });
    // Redirect handled by kanoMart:signed-in listener in app.ts
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Sign up failed. Please try again.";
    if (formErr) formErr.textContent = msg;
    const defaultLabel = role === "vendor" ? "Create vendor account" : "Create my account";
    setLoading(btn, false, defaultLabel);
  }
}
