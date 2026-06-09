import type { UserSession } from "../backend/types";
import { storageKeys } from "../backend/data";
import { state, elements } from "./state";
import { getCopy, escapeHtml, isValidEmail, isValidPhone } from "./utils";
import { showToast } from "./toast";
import {
  findUserProfileByEmail,
  findUserProfileByPhone,
  isAdminPhone,
  saveUserProfile,
  updateUserProfile,
  verifyPassword,
} from "../backend/users";
import { normalizePhone } from "../backend/phone";
import { api, type ApiAuthResponse, clearApiToken, saveApiToken } from "./api-client";
import { fetchLiveOrders, renderOrdersPanel } from "./orders";


function sessionFromApi(response: ApiAuthResponse): UserSession {
  const user = response.user;
  return {
    id: user.id,
    token: response.token,
    phone: user.phone,
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    name: user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.phone,
    role: user.role,
    vendorStatus: user.vendorStatus,
    deliveryAddress: user.deliveryAddress,
    preferredLanguage: user.preferredLanguage,
    createdAt: user.createdAt || new Date().toISOString(),
  };
}

async function syncApiLogin(identifier: string, password: string): Promise<UserSession | null> {
  if (!password) return null;
  const response = await api.login(identifier, password);
  saveApiToken(response.token, response.expiresAt);
  return sessionFromApi(response);
}

async function syncApiRegistration(input: {
  phone: string;
  email?: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "customer" | "vendor";
  deliveryAddress?: string;
  preferredLanguage?: "en" | "ha";
  businessName?: string;
  area?: string;
  category?: string;
}): Promise<UserSession | null> {
  if (input.password.length < 8) return null;
  const response = await api.register(input);
  saveApiToken(response.token, response.expiresAt);
  return sessionFromApi(response);
}

export function saveSession(session: UserSession, expiresAt?: string): void {
  state.currentUser = session;
  if (session.token) saveApiToken(session.token, expiresAt);
  state.adminAuthenticated = session.role === "admin";
  localStorage.setItem(storageKeys.session, JSON.stringify(session));
  if (session.role === "admin") {
    localStorage.setItem(storageKeys.adminSession, new Date().toISOString());
  } else {
    localStorage.removeItem(storageKeys.adminSession);
  }
  syncUserButton();
  window.dispatchEvent(new CustomEvent("kanoMart:signed-in", { detail: session }));
}

export function signOut(): void {
  void api.logout().catch(() => undefined);
  state.currentUser = null;
  state.adminAuthenticated = false;
  clearApiToken();
  localStorage.removeItem(storageKeys.session);
  localStorage.removeItem(storageKeys.adminSession);
  syncUserButton();
  closeUserPanel();
  window.dispatchEvent(new CustomEvent("kanoMart:signed-out"));
  showToast({ message: getCopy("Signed out.", "An fita."), type: "info" });
}

export function syncUserButton(): void {
  const user = state.currentUser;
  if (user) {
    elements.userButtonLabel.textContent = user.name || user.phone;
    elements.userButton.setAttribute("aria-label", getCopy("My account", "Asusuna"));
  } else {
    elements.userButtonLabel.textContent = getCopy("Sign in", "Shiga");
    elements.userButton.setAttribute("aria-label", getCopy("Sign in", "Shiga"));
  }
}

// — Auth modal —

function buildAuthModal(): HTMLElement {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "authModal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "authModalTitle");
  el.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="authModalTitle">${getCopy("Sign in to Kano Mart", "Shiga Kano Mart")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">×</button>
      </div>
      <div id="authPhasePhone" class="auth-phase">
        <p class="muted">${getCopy("Enter your phone number or email address.", "Shigar da lambar wayarka ko adireshin email.")}</p>
        <form id="authPhoneForm" novalidate>
          <label>
            <span>${getCopy("Email or phone number", "Email ko lambar waya")}</span>
            <input type="text" id="authPhone" name="phone" placeholder="08012345678 or name@email.com"
              required autocomplete="username" />
          </label>
          <button type="submit">${getCopy("Continue", "Ci gaba")}</button>
          <p class="form-message" id="authPhoneError" role="alert"></p>
        </form>
      </div>
      <div id="authPhaseOtp" class="auth-phase" hidden>
        <p class="muted" id="authOtpHint"></p>
        <form id="authOtpForm" novalidate>
          <label id="authLoginPasswordWrap" hidden>
            <span>${getCopy("Password", "Kalmar sirri")}</span>
            <input type="password" id="authLoginPassword" name="loginPassword" autocomplete="current-password" />
          </label>
          <div id="authSignupFields" class="auth-signup-fields" hidden>
            <div class="form-grid-two">
              <label>
                <span>${getCopy("First name", "Sunan farko")}</span>
                <input type="text" id="authFirstName" name="firstName" autocomplete="given-name" minlength="2" />
              </label>
              <label>
                <span>${getCopy("Last name", "Sunan karshe")}</span>
                <input type="text" id="authLastName" name="lastName" autocomplete="family-name" minlength="2" />
              </label>
            </div>
            <label>
              <span>${getCopy("Email address", "Adireshin email")}</span>
              <input type="email" id="authEmail" name="email" autocomplete="email" />
            </label>
            <label>
              <span>${getCopy("Password", "Kalmar sirri")}</span>
              <input type="password" id="authPassword" name="password" minlength="8" autocomplete="new-password" />
            </label>
            <label>
              <span>${getCopy("Delivery address", "Adireshin isarwa")}</span>
              <input type="text" id="authDeliveryAddress" name="deliveryAddress" autocomplete="street-address" />
            </label>
            <label>
              <span>${getCopy("Preferred language", "Yaren da ka fi so")}</span>
              <select id="authPreferredLanguage" name="preferredLanguage">
                <option value="en">English</option>
                <option value="ha">Hausa</option>
              </select>
            </label>
            <label>
              <span>${getCopy("Account type", "Nau'in asusu")}</span>
              <select id="authAccountType" name="accountType">
                <option value="customer">${getCopy("Customer", "Kwastoma")}</option>
                <option value="vendor">${getCopy("Vendor / seller", "Dan kasuwa")}</option>
              </select>
            </label>
            <div id="authVendorFields" class="auth-vendor-fields" hidden>
              <label>
                <span>${getCopy("Business name", "Sunan kasuwanci")}</span>
                <input type="text" id="authBusinessName" name="businessName" autocomplete="organization" />
              </label>
              <label>
                <span>${getCopy("Market area", "Yankin kasuwa")}</span>
                <input type="text" id="authArea" name="area" placeholder="${getCopy("Kantin Kwari, Tarauni...", "Kantin Kwari, Tarauni...")}" />
              </label>
              <label>
                <span>${getCopy("Main category", "Babban rukuni")}</span>
                <select id="authCategory" name="category">
                  <option value="food">${getCopy("Food", "Abinci")}</option>
                  <option value="fashion">${getCopy("Fashion", "Kaya")}</option>
                  <option value="children">${getCopy("Children", "Yara")}</option>
                  <option value="essentials">${getCopy("Essentials", "Kayan yau da kullum")}</option>
                </select>
              </label>
            </div>
          </div>
          <button type="submit" id="authSubmitBtn">${getCopy("Sign in", "Shiga")}</button>
          <p class="form-message" id="authOtpError" role="alert"></p>
        </form>
        <button type="button" class="link-button" id="authBack">${getCopy("← Change number", "← Canza lambar")}</button>
      </div>
    </div>
  `;
  return el;
}

export type AuthModalPrefill = {
  phone?: string;
  role?: "customer" | "vendor";
  businessName?: string;
  area?: string;
  category?: string;
};

export function openAuthModal(prefill?: AuthModalPrefill): void {
  const existing = document.getElementById("authModal");
  if (existing) existing.remove();

  const modal = buildAuthModal();
  document.body.appendChild(modal);
  wireAuthModal(modal);
  requestAnimationFrame(() => modal.classList.add("modal-visible"));

  if (prefill?.phone) {
    const phoneInput = modal.querySelector<HTMLInputElement>("#authPhone");
    if (phoneInput) phoneInput.value = prefill.phone;
  }
  if (prefill?.role === "vendor") {
    const accountType = modal.querySelector<HTMLSelectElement>("#authAccountType");
    if (accountType) accountType.value = "vendor";
  }
  if (prefill?.businessName) {
    const businessNameInput = modal.querySelector<HTMLInputElement>("#authBusinessName");
    if (businessNameInput) businessNameInput.value = prefill.businessName;
  }
  if (prefill?.area) {
    const areaInput = modal.querySelector<HTMLInputElement>("#authArea");
    if (areaInput) areaInput.value = prefill.area;
  }
  if (prefill?.category) {
    const categorySelect = modal.querySelector<HTMLSelectElement>("#authCategory");
    if (categorySelect) categorySelect.value = prefill.category;
  }

  modal.querySelector<HTMLInputElement>("#authPhone")?.focus();
}

function closeAuthModal(): void {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
}

function wireAuthModal(modal: HTMLElement): void {
  modal.querySelector(".modal-close")?.addEventListener("click", closeAuthModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAuthModal();
  });

  const phoneForm = modal.querySelector<HTMLFormElement>("#authPhoneForm")!;
  const credForm = modal.querySelector<HTMLFormElement>("#authOtpForm")!;
  const phonePhase = modal.querySelector<HTMLElement>("#authPhasePhone")!;
  const credPhase = modal.querySelector<HTMLElement>("#authPhaseOtp")!;
  const credHint = modal.querySelector<HTMLElement>("#authOtpHint")!;
  const phoneError = modal.querySelector<HTMLElement>("#authPhoneError")!;
  const credError = modal.querySelector<HTMLElement>("#authOtpError")!;
  const signupFields = modal.querySelector<HTMLElement>("#authSignupFields")!;
  const vendorFields = modal.querySelector<HTMLElement>("#authVendorFields")!;
  const accountType = modal.querySelector<HTMLSelectElement>("#authAccountType")!;
  const submitBtn = modal.querySelector<HTMLButtonElement>("#authSubmitBtn")!;
  let pendingIdentifier = "";
  let needsSignup = false;

  function setSignupRequired(required: boolean): void {
    signupFields.hidden = !required;
    modal.querySelectorAll<HTMLInputElement>("#authFirstName, #authLastName, #authEmail, #authPassword, #authDeliveryAddress").forEach((input) => {
      input.required = required;
    });
    accountType.required = required;
    setVendorRequired(required && accountType.value === "vendor");
    submitBtn.textContent = required
      ? getCopy("Create account", "Ƙirƙiri asusu")
      : getCopy("Sign in", "Shiga");
  }

  function setVendorRequired(required: boolean): void {
    vendorFields.hidden = !required;
    modal.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      "#authBusinessName, #authArea, #authCategory"
    ).forEach((input) => {
      input.required = required;
    });
  }

  phoneForm.addEventListener("submit", (e) => {
    e.preventDefault();
    phoneError.textContent = "";
    const identifier = (modal.querySelector<HTMLInputElement>("#authPhone")?.value || "").trim();
    if (!identifier) {
      phoneError.textContent = getCopy("Enter your phone number or email address.", "Shigar da lambar waya ko adireshin email.");
      modal.querySelector<HTMLInputElement>("#authPhone")?.focus();
      return;
    }
    if (identifier.includes("@") && !isValidEmail(identifier)) {
      phoneError.textContent = getCopy("Enter a valid email address.", "Shigar da adireshin email mai inganci.");
      modal.querySelector<HTMLInputElement>("#authPhone")?.focus();
      return;
    }
    if (!identifier.includes("@") && !isValidPhone(identifier)) {
      phoneError.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci.");
      modal.querySelector<HTMLInputElement>("#authPhone")?.focus();
      return;
    }

    pendingIdentifier = identifier;
    const normalised = identifier.includes("@") ? identifier : normalizePhone(identifier);
    const emailProfile = identifier.includes("@") ? findUserProfileByEmail(identifier) : null;
    const phoneProfile = findUserProfileByPhone(normalised);
    needsSignup = !emailProfile && !phoneProfile && !isAdminPhone(normalised);

    setSignupRequired(needsSignup);

    const loginPasswordWrap = modal.querySelector<HTMLElement>("#authLoginPasswordWrap");
    if (loginPasswordWrap) loginPasswordWrap.hidden = needsSignup;

    credHint.textContent = needsSignup
      ? getCopy(
          `Creating a new account for ${normalised}.`,
          `Ana ƙirƙirar sabon asusu don ${normalised}.`
        )
      : getCopy(
          `Welcome back. Enter your password to sign in.`,
          `Barka da dawo. Shigar da kalmar sirri don shiga.`
        );

    phonePhase.hidden = true;
    credPhase.hidden = false;
    const focusTarget = needsSignup
      ? modal.querySelector<HTMLInputElement>("#authFirstName")
      : modal.querySelector<HTMLInputElement>("#authLoginPassword");
    focusTarget?.focus();
  });

  accountType.addEventListener("change", () => {
    setVendorRequired(needsSignup && accountType.value === "vendor");
  });

  credForm.addEventListener("submit", (e) => {
    void handleCredSubmit(e);
  });

  async function handleCredSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    credError.textContent = "";
    submitBtn.disabled = true;
    submitBtn.textContent = getCopy("Signing in…", "Ana shiga…");

    const normalised = pendingIdentifier.includes("@")
      ? pendingIdentifier
      : normalizePhone(pendingIdentifier);

    try {
      let session: UserSession | null = null;

      if (needsSignup) {
        const firstName = (modal.querySelector<HTMLInputElement>("#authFirstName")?.value || "").trim();
        const lastName = (modal.querySelector<HTMLInputElement>("#authLastName")?.value || "").trim();
        const email = (modal.querySelector<HTMLInputElement>("#authEmail")?.value || "").trim();
        const password = (modal.querySelector<HTMLInputElement>("#authPassword")?.value || "").trim();
        const deliveryAddress = (modal.querySelector<HTMLInputElement>("#authDeliveryAddress")?.value || "").trim();
        const preferredLanguage =
          modal.querySelector<HTMLSelectElement>("#authPreferredLanguage")?.value === "ha" ? "ha" : "en";
        const selectedType = accountType.value === "vendor" ? "vendor" : "customer";
        const businessName = (modal.querySelector<HTMLInputElement>("#authBusinessName")?.value || "").trim();
        const area = (modal.querySelector<HTMLInputElement>("#authArea")?.value || "").trim();
        const category = modal.querySelector<HTMLSelectElement>("#authCategory")?.value || "essentials";

        if (!firstName || firstName.length < 2) {
          credError.textContent = getCopy("First name must be at least 2 characters.", "Sunan farko ya zama akalla haruffa 2.");
          modal.querySelector<HTMLInputElement>("#authFirstName")?.focus();
          return;
        }
        if (!lastName || lastName.length < 2) {
          credError.textContent = getCopy("Last name must be at least 2 characters.", "Sunan karshe ya zama akalla haruffa 2.");
          modal.querySelector<HTMLInputElement>("#authLastName")?.focus();
          return;
        }
        if (!email || !isValidEmail(email)) {
          credError.textContent = getCopy("Enter a valid email address.", "Shigar da adireshin email mai inganci.");
          modal.querySelector<HTMLInputElement>("#authEmail")?.focus();
          return;
        }
        if (!password || password.length < 8) {
          credError.textContent = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta kasance akalla haruffa 8.");
          modal.querySelector<HTMLInputElement>("#authPassword")?.focus();
          return;
        }
        if (!deliveryAddress) {
          credError.textContent = getCopy("Delivery address is required.", "Ana buƙatar adireshin isarwa.");
          modal.querySelector<HTMLInputElement>("#authDeliveryAddress")?.focus();
          return;
        }
        if (selectedType === "vendor" && !businessName) {
          credError.textContent = getCopy("Business name is required.", "Ana buƙatar sunan kasuwanci.");
          modal.querySelector<HTMLInputElement>("#authBusinessName")?.focus();
          return;
        }
        if (selectedType === "vendor" && !area) {
          credError.textContent = getCopy("Business area is required.", "Ana buƙatar yankin kasuwanci.");
          modal.querySelector<HTMLInputElement>("#authArea")?.focus();
          return;
        }

        session = await syncApiRegistration({
          phone: normalised,
          firstName,
          lastName,
          email,
          password,
          role: selectedType,
          deliveryAddress,
          preferredLanguage,
          businessName,
          area,
          category,
        });
        if (!session) throw new Error(getCopy("Registration failed. Please try again.", "Rajista ta kasa. Da fatan za a sake gwadawa."));
      } else {
        const password = (modal.querySelector<HTMLInputElement>("#authLoginPassword")?.value || "").trim();
        if (!password) {
          credError.textContent = getCopy("Password is required to sign in.", "Ana buƙatar kalmar sirri don shiga.");
          modal.querySelector<HTMLInputElement>("#authLoginPassword")?.focus();
          return;
        }
        session = await syncApiLogin(pendingIdentifier, password);
        if (!session) throw new Error(getCopy("Incorrect phone number or password.", "Lambar waya ko kalmar sirri ba daidai ba."));
      }

      saveSession(session);
      closeAuthModal();
      const roleCopy =
        session.role === "admin"
          ? getCopy("Admin signed in.", "Admin ya shiga.")
          : session.role === "vendor"
            ? getCopy("Vendor account signed in.", "Asusun dillali ya shiga.")
            : getCopy("Signed in successfully!", "An shiga cikin nasara!");
      showToast({ message: roleCopy });
    } catch (err) {
      credError.textContent = err instanceof Error
        ? err.message
        : getCopy("Sign in failed. Check your details and try again.", "Shiga ta kasa. Duba bayananku ku sake gwadawa.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = needsSignup
        ? getCopy("Create account", "Ƙirƙiri asusu")
        : getCopy("Sign in", "Shiga");
    }
  }

  modal.querySelector("#authBack")?.addEventListener("click", () => {
    phonePhase.hidden = false;
    credPhase.hidden = true;
    setSignupRequired(false);
    phoneError.textContent = "";
    credError.textContent = "";
    modal.querySelector<HTMLInputElement>("#authPhone")?.focus();
  });
}

// — User panel (orders/account) —

function buildUserPanel(): HTMLElement {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "userPanel";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "userPanelTitle");
  const user = state.currentUser!;
  el.innerHTML = `
    <div class="modal-box modal-box-wide">
      <div class="modal-header">
        <h2 id="userPanelTitle">${getCopy("My account", "Asusuna")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">×</button>
      </div>
      <div class="user-info">
        <p><strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.phone)} · ${escapeHtml(user.role)}</p>
        <button type="button" class="link-button" id="signOutBtn">${getCopy("Sign out", "Fita")}</button>
      </div>
      <form id="profileUpdateForm" class="auth-phase" novalidate>
        <div class="form-grid-two">
          <label>
            <span>${getCopy("Full name", "Cikakken suna")}</span>
            <input type="text" name="name" value="${escapeHtml(user.name)}" required />
          </label>
          <label>
            <span>${getCopy("Email", "Email")}</span>
            <input type="email" name="email" value="${escapeHtml(user.email || "")}" />
          </label>
        </div>
        ${user.role === "vendor"
          ? `<label>
          <span>${getCopy("Shop address (pickup location)", "Adireshin shago (don karbar kaya)")}</span>
          <input type="text" name="deliveryAddress" value="${escapeHtml(user.deliveryAddress || "")}" />
        </label>`
          : `<label>
          <span>${getCopy("Delivery address", "Adireshin isarwa")}</span>
          <input type="text" name="deliveryAddress" value="${escapeHtml(user.deliveryAddress || "")}" />
        </label>`}
        <label>
          <span>${getCopy("Preferred language", "Yaren da ka fi so")}</span>
          <select name="preferredLanguage">
            <option value="en"${user.preferredLanguage === "ha" ? "" : " selected"}>English</option>
            <option value="ha"${user.preferredLanguage === "ha" ? " selected" : ""}>Hausa</option>
          </select>
        </label>
        <button type="submit">${getCopy("Update profile", "Sabunta bayanai")}</button>
        <p class="form-message" id="profileUpdateMessage" role="status"></p>
      </form>
      <h3>${getCopy("My orders", "Odana")}</h3>
      <div id="userOrdersList">${renderOrdersPanel()}</div>
    </div>
  `;
  return el;
}

export function openUserPanel(): void {
  if (!state.currentUser) {
    // Route unauthenticated users to the proper sign-in page
    window.location.hash = "login";
    return;
  }
  const existing = document.getElementById("userPanel");
  if (existing) {
    existing.hidden = false;
    requestAnimationFrame(() => existing.classList.add("modal-visible"));
    return;
  }
  const panel = buildUserPanel();
  document.body.appendChild(panel);
  requestAnimationFrame(() => panel.classList.add("modal-visible"));

  // Fetch live orders for customers and re-render the orders list
  if (state.currentUser.role === "customer" && state.currentUser.token) {
    fetchLiveOrders()
      .then(() => {
        const listEl = panel.querySelector<HTMLElement>("#userOrdersList");
        if (listEl) listEl.innerHTML = renderOrdersPanel();
      })
      .catch(() => undefined);
  }

  panel.querySelector(".modal-close")?.addEventListener("click", closeUserPanel);
  panel.addEventListener("click", (e) => { if (e.target === panel) closeUserPanel(); });
  panel.querySelector("#signOutBtn")?.addEventListener("click", signOut);
  panel.querySelector<HTMLFormElement>("#profileUpdateForm")?.addEventListener("submit", (event) => {
    void handleProfileUpdate(event);
  });

  async function handleProfileUpdate(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "");
    const deliveryAddress = String(data.get("deliveryAddress") || "");
    const preferredLanguage = data.get("preferredLanguage") === "ha" ? "ha" : "en" as "en" | "ha";

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(" ");

    // Sync to live API if authenticated
    if (state.currentUser?.token) {
      try {
        const result = await api.updateMe({ name, email, deliveryAddress, preferredLanguage });
        const updated = { ...state.currentUser, ...result.user, token: state.currentUser.token };
        saveSession(updated);
      } catch {
        // Fall through to local update on API failure
      }
    }

    // Always update local profile store as well
    const updated = updateUserProfile(state.currentUser!.phone, {
      firstName: firstName || state.currentUser!.firstName,
      lastName: lastName || state.currentUser!.lastName,
      email, deliveryAddress, preferredLanguage,
    });
    if (updated && !state.currentUser?.token) return; // must be signed in via API

    const message = panel.querySelector<HTMLElement>("#profileUpdateMessage");
    if (message) message.textContent = getCopy("Profile updated.", "An sabunta bayanai.");
  }
}

export function closeUserPanel(): void {
  const panel = document.getElementById("userPanel");
  if (!panel) return;
  panel.classList.remove("modal-visible");
  panel.addEventListener("transitionend", () => panel.remove(), { once: true });
}

export function refreshUserPanelLanguage(): void {
  const panel = document.getElementById("userPanel");
  if (!panel || !state.currentUser) return;
  panel.remove();
  openUserPanel();
}
