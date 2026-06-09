/**
 * auth-pages.ts
 * Logic for the dedicated /login and /signup page routes.
 * These are full-page experiences (two-column desktop, single-column mobile)
 * that replace the quick-modal flow for primary sign-up/sign-in journeys.
 */

import type { UserSession } from "../backend/types";
import { api } from "./api-client";
import { saveSession } from "./auth";
import { getCopy, isValidEmail, isValidPhone } from "./utils";
import { showToast } from "./toast";

// ─── Validation helpers ───────────────────────────────────────────────────────

function validateLogin(id: string, pw: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!id.trim()) e.identifier = getCopy("Email or phone number is required.", "Ana bukatar imel ko lambar waya.");
  else if (id.includes("@") && !isValidEmail(id)) e.identifier = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!pw) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (pw.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  return e;
}

function validateCustomer(d: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.fullName?.trim()) e.fullName = getCopy("Full name is required.", "Ana bukatar cikakken suna.");
  if (!d.email?.trim()) e.email = getCopy("Email address is required.", "Ana bukatar adireshin imel.");
  else if (!isValidEmail(d.email)) e.email = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!d.phone?.trim()) e.phone = getCopy("Phone number is required.", "Ana bukatar lambar waya.");
  else if (!isValidPhone(d.phone)) e.phone = getCopy("Enter a valid Nigerian phone number (at least 10 digits).", "Shigar da lambar waya ta Najeriya mai inganci (akalla lambobi 10).");
  if (!d.password) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (d.password.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  if (d.password !== d.confirmPassword) e.confirmPassword = getCopy("Passwords do not match.", "Kalmar sirri ba ta dace ba.");
  if (!d.terms) e.terms = getCopy("You must accept the terms and conditions to continue.", "Dole ne ka amince da sharudda kafin ka ci gaba.");
  return e;
}

function validateVendor(d: Record<string, string>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.businessName?.trim()) e.businessName = getCopy("Business or store name is required.", "Ana bukatar sunan kasuwanci ko shago.");
  if (!d.ownerName?.trim()) e.ownerName = getCopy("Owner full name is required.", "Ana bukatar cikakken sunan mai shago.");
  if (!d.email?.trim()) e.email = getCopy("Email address is required.", "Ana bukatar adireshin imel.");
  else if (!isValidEmail(d.email)) e.email = getCopy("Enter a valid email address.", "Shigar da adireshin imel mai inganci.");
  if (!d.phone?.trim()) e.phone = getCopy("Phone number is required.", "Ana bukatar lambar waya.");
  else if (!isValidPhone(d.phone)) e.phone = getCopy("Enter a valid Nigerian phone number (at least 10 digits).", "Shigar da lambar waya ta Najeriya mai inganci (akalla lambobi 10).");
  if (!d.category) e.category = getCopy("Please select your business category.", "Da fatan za a zabi rukunin kasuwanci.");
  if (!d.area?.trim()) e.area = getCopy("Business location or area is required.", "Ana bukatar wurin kasuwanci ko yanki.");
  if (!d.password) e.password = getCopy("Password is required.", "Ana bukatar kalmar sirri.");
  else if (d.password.length < 8) e.password = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta zama akalla haruffa 8.");
  if (d.password !== d.confirmPassword) e.confirmPassword = getCopy("Passwords do not match.", "Kalmar sirri ba ta dace ba.");
  if (!d.terms) e.terms = getCopy("You must accept the terms and conditions to continue.", "Dole ne ka amince da sharudda kafin ka ci gaba.");
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
      btn.setAttribute("aria-label", showing ? getCopy("Show password", "Nuna kalmar sirri") : getCopy("Hide password", "Boye kalmar sirri"));
      btn.classList.toggle("is-showing", !showing);
      // Update icon
      const eyeOpen = btn.querySelector<SVGElement>(".eye-open");
      const eyeClosed = btn.querySelector<SVGElement>(".eye-closed");
      eyeOpen?.toggleAttribute("hidden", !showing);
      eyeClosed?.toggleAttribute("hidden", showing);
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
    ? getCopy("Sign in to access your vendor dashboard and manage your store.", "Shiga don bude allon dillali da kula da shagoka.")
    : getCopy("Sign in to shop from trusted local vendors around Kano.", "Shiga don saya daga amintattun dillalan gida a Kano.");
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
  setLoading(btn, true, getCopy("Signing in...", "Ana shiga..."));

  try {
    const res = await api.login(identifier, password);
    saveSession(buildSession(res.user, res.token));
    // Redirect handled by kanoMart:signed-in listener in app.ts
  } catch (err) {
    const msg = err instanceof Error ? err.message : getCopy("Sign in failed. Please check your details and try again.", "Shiga ya kasa. Da fatan za a duba bayananka ka sake gwadawa.");
    if (formErr) formErr.textContent = msg;
    setLoading(btn, false, getCopy("Sign in", "Shiga"));
  }
}

// ─── SIGNUP PAGE ──────────────────────────────────────────────────────────────

export function initSignupPage(): void {
  const page = document.getElementById("signupPage");
  if (!page) return;

  // Check if a role was requested via hash fragment e.g. #signup/vendor
  const hashRole = window.location.hash.split("/")[1];
  let currentRole: "customer" | "vendor" = hashRole === "vendor" ? "vendor" : "customer";

  wirePasswordToggles(page);
  wireRoleTabs(page, (role) => {
    currentRole = role;
    applySignupRole(page, role);
  });

  // Pre-activate the correct tab
  if (currentRole === "vendor") {
    page.querySelectorAll<HTMLButtonElement>("[data-role-tab]").forEach((tab) => {
      const isVendor = tab.dataset.roleTab === "vendor";
      tab.classList.toggle("is-active", isVendor);
      tab.setAttribute("aria-selected", String(isVendor));
    });
  }

  // Initialise form fields for the chosen role
  applySignupRole(page, currentRole);

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
      ? getCopy("Create your store and start selling to real customers in Kano.", "Kirkiri shagoka ka fara sayarwa ga kwastomomi na gaske a Kano.")
      : getCopy("Join thousands of customers shopping from trusted local vendors.", "Shiga cikin dubban kwastomomi da ke saya daga amintattun dillalai.");
  }

  // Update submit button label
  const btn = page.querySelector<HTMLButtonElement>("#signupSubmitBtn");
  if (btn && !btn.disabled) {
    btn.textContent = role === "vendor" ? getCopy("Create vendor account", "Kirkiri asusun dillali") : getCopy("Create my account", "Kirkiri asusuna");
  }

  // Update brand sub-copy
  const brandSub = page.querySelector<HTMLElement>("#signupBrandSub");
  if (brandSub) {
    brandSub.textContent = role === "vendor"
      ? getCopy("Set up your store in minutes and reach thousands of customers across Kano.", "Kafa shagoka cikin mintuna ka kai ga dubban kwastomomi a fadin Kano.")
      : getCopy("Create your account in minutes and start shopping from trusted local vendors.", "Kirkiri asusunka cikin mintuna ka fara saya daga amintattun dillalai.");
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
  setLoading(btn, true, getCopy("Creating account...", "Ana kirkirar asusu..."));

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
    const msg = err instanceof Error ? err.message : getCopy("Sign up failed. Please try again.", "Rajista ta kasa. Da fatan za a sake gwadawa.");
    if (formErr) formErr.textContent = msg;
    const defaultLabel = role === "vendor" ? getCopy("Create vendor account", "Kirkiri asusun dillali") : getCopy("Create my account", "Kirkiri asusuna");
    setLoading(btn, false, defaultLabel);
  }
}

function getActiveAuthRole(page: HTMLElement): "customer" | "vendor" {
  return page.querySelector<HTMLButtonElement>("[data-role-tab].is-active")?.dataset.roleTab === "vendor" ? "vendor" : "customer";
}

function setText(root: ParentNode, selector: string, en: string, ha: string): void {
  const node = root.querySelector<HTMLElement>(selector);
  if (node) node.textContent = getCopy(en, ha);
}

function setHtml(root: ParentNode, selector: string, en: string, ha: string): void {
  const node = root.querySelector<HTMLElement>(selector);
  if (node) node.innerHTML = getCopy(en, ha);
}

function setPlaceholder(root: ParentNode, selector: string, en: string, ha: string): void {
  const node = root.querySelector<HTMLInputElement>(selector);
  if (node) node.placeholder = getCopy(en, ha);
}

function setTrailingButtonText(button: HTMLButtonElement | null, en: string, ha: string): void {
  if (!button) return;
  const text = getCopy(en, ha);
  const textNode = Array.from(button.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
  if (textNode) textNode.textContent = ` ${text}`;
  else button.append(document.createTextNode(` ${text}`));
}

function syncLoginPageCopy(page: HTMLElement): void {
  setText(page, ".auth-brand-headline", "Your local marketplace, wherever you are.", "Kasuwarka ta gida, duk inda kake.");
  setText(page, ".auth-brand-sub", "Shop from trusted vendors around Kano - or manage your store. All in one place.", "Saya daga amintattun dillalai a Kano ko kula da shagoka. Duk a wuri daya.");
  const trustItems = page.querySelectorAll<HTMLElement>(".auth-trust-list li");
  [
    [getCopy("Thousands of products from verified local vendors", "Dubban kaya daga tabbatattun dillalan gida")],
    [getCopy("Fast delivery across Kano and major areas", "Isarwa cikin sauri a Kano da manyan yankuna")],
    [getCopy("Secure payments with multiple options", "Biyan kudi mai tsaro da hanyoyi da dama")],
    [getCopy("Full English and Hausa language support", "Cikakken goyon bayan Turanci da Hausa")],
  ].forEach(([text], index) => {
    if (trustItems[index]) trustItems[index].textContent = text;
  });
  setText(page, "#login-page-heading", "Sign in to your account", "Shiga asusunka");
  setHtml(
    page,
    ".auth-card-subheading",
    'New to Kano Mart? <a href="#signup" data-route="signup">Create a free account</a>',
    'Sabon mai amfani ne a Kano Mart? <a href="#signup" data-route="signup">Kirkiri asusu kyauta</a>'
  );
  setTrailingButtonText(page.querySelector<HTMLButtonElement>('[data-role-tab="customer"]'), "Customer", "Kwastoma");
  setTrailingButtonText(page.querySelector<HTMLButtonElement>('[data-role-tab="vendor"]'), "Vendor", "Dillali");
  updateLoginRoleHint(page, getActiveAuthRole(page));
  setText(page, 'label[for="loginIdentifier"]', "Email or phone number", "Imel ko lambar waya");
  setPlaceholder(page, "#loginIdentifier", "08012345678 or name@email.com", "08012345678 ko suna@email.com");
  setText(page, 'label[for="loginPassword"]', "Password", "Kalmar sirri");
  setPlaceholder(page, "#loginPassword", "Enter your password", "Shigar da kalmar sirri");
  setText(page, ".auth-check-label span", "Remember me", "Tuna da ni");
  const loginBtn = page.querySelector<HTMLButtonElement>("#loginSubmitBtn");
  if (loginBtn && !loginBtn.disabled) loginBtn.textContent = getCopy("Sign in", "Shiga");
}

function syncSignupPageCopy(page: HTMLElement): void {
  setText(page, ".auth-brand-headline", "Join the Kano marketplace community.", "Shiga cikin al'ummar kasuwar Kano.");
  const trustItems = page.querySelectorAll<HTMLElement>(".auth-trust-list li");
  [
    getCopy("Free for customers - no hidden fees", "Kyauta ga kwastomomi - babu boyayyen kudi"),
    getCopy("Browse hundreds of products from Kano vendors", "Bincika daruruwan kaya daga dillalan Kano"),
    getCopy("Vendors: reach real customers from day one", "Dillalai: ku kai ga kwastomomi tun daga rana ta farko"),
    getCopy("Verified, secure marketplace platform", "Dandali tabbatacce kuma mai tsaro"),
  ].forEach((text, index) => {
    if (trustItems[index]) trustItems[index].textContent = text;
  });
  setText(page, "#signup-page-heading", "Create your account", "Kirkiri asusunka");
  setHtml(
    page,
    ".auth-card-subheading",
    'Already have an account? <a href="#login" data-route="login">Sign in</a>',
    'Kana da asusu? <a href="#login" data-route="login">Shiga</a>'
  );
  setTrailingButtonText(page.querySelector<HTMLButtonElement>('[data-role-tab="customer"]'), "Customer", "Kwastoma");
  setTrailingButtonText(page.querySelector<HTMLButtonElement>('[data-role-tab="vendor"]'), "Vendor / Seller", "Dillali / Mai sayarwa");
  setText(page, 'label[for="signupFullName"]', "Full name", "Cikakken suna");
  setPlaceholder(page, "#signupFullName", "e.g. Amina Bello", "misali Amina Bello");
  setText(page, 'label[for="signupBusinessName"]', "Business / Store name", "Sunan kasuwanci / shago");
  setPlaceholder(page, "#signupBusinessName", "e.g. Amina Fashion House", "misali Amina Fashion House");
  setText(page, 'label[for="signupOwnerName"]', "Owner full name", "Cikakken sunan mai shago");
  setPlaceholder(page, "#signupOwnerName", "e.g. Amina Bello", "misali Amina Bello");
  setText(page, 'label[for="signupEmail"]', "Email address", "Adireshin imel");
  setPlaceholder(page, "#signupEmail", "name@example.com", "suna@example.com");
  setText(page, 'label[for="signupPhone"]', "Phone number", "Lambar waya");
  setText(page, 'label[for="signupCategory"]', "Business category", "Rukunin kasuwanci");
  setText(page, '#signupCategory option[value=""]', "Select a category...", "Zabi rukuni...");
  setText(page, '#signupCategory option[value="food"]', "Food & Groceries", "Abinci da kayan masarufi");
  setText(page, '#signupCategory option[value="fashion"]', "Fashion & Clothing", "Kaya da tufafi");
  setText(page, '#signupCategory option[value="children"]', "Children & School Supplies", "Yara da kayan makaranta");
  setText(page, '#signupCategory option[value="essentials"]', "Essentials & Daily Needs", "Abubuwan yau da kullum");
  setText(page, 'label[for="signupArea"]', "Business location / area", "Wurin kasuwanci / yanki");
  setPlaceholder(page, "#signupArea", "e.g. Kantin Kwari, Tarauni, Sabon Gari", "misali Kantin Kwari, Tarauni, Sabon Gari");
  setHtml(
    page,
    ".vendor-signup-note",
    "<strong>About vendor accounts</strong>Products you list will appear in the marketplace after admin review. This typically takes 1-2 business days.",
    "<strong>Game da asusun dillali</strong>Kayan da ka saka za su bayyana a kasuwa bayan duba admin. Yawanci yana daukar kwanakin aiki 1-2."
  );
  setText(page, 'label[for="signupPassword"]', "Password", "Kalmar sirri");
  setPlaceholder(page, "#signupPassword", "At least 8 characters", "Akalla haruffa 8");
  setText(page, 'label[for="signupConfirmPassword"]', "Confirm password", "Tabbatar da kalmar sirri");
  setPlaceholder(page, "#signupConfirmPassword", "Re-enter your password", "Sake shigar da kalmar sirri");
  setHtml(
    page,
    ".auth-terms-field .auth-check-label span",
    'I agree to the <span class="auth-policy-link">Terms of Service</span> and <span class="auth-policy-link">Privacy Policy</span>',
    'Na amince da <span class="auth-policy-link">Sharuddan Amfani</span> da <span class="auth-policy-link">Dokar Sirri</span>'
  );
  applySignupRole(page, getActiveAuthRole(page));
}

export function syncAuthPagesLanguage(): void {
  const loginPage = document.getElementById("loginPage");
  if (loginPage) {
    syncLoginPageCopy(loginPage);
  }

  const signupPage = document.getElementById("signupPage");
  if (signupPage) {
    syncSignupPageCopy(signupPage);
  }

  document.querySelectorAll<HTMLButtonElement>(".pw-toggle").forEach((button) => {
    const showing = button.classList.contains("is-showing");
    button.setAttribute("aria-label", showing ? getCopy("Hide password", "Boye kalmar sirri") : getCopy("Show password", "Nuna kalmar sirri"));
  });
}
