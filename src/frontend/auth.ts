import type { UserSession } from "../backend/types";
import { storageKeys } from "../backend/data";
import { state, elements } from "./state";
import { getCopy, escapeHtml } from "./utils";
import { showToast } from "./toast";
import {
  createSessionForPhone,
  findUserProfileByEmail,
  findUserProfileByPhone,
  isAdminPhone,
  requiresSignup,
  saveUserProfile,
  updateUserProfile,
  verifyPassword,
} from "../backend/users";
import { normalizePhone } from "../backend/phone";
import { api, type ApiAuthResponse, clearApiToken, saveApiToken } from "./api-client";
import { fetchLiveOrders, renderOrdersPanel } from "./orders";

const MOCK_OTP = "123456";

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
  try {
    const response = await api.login(identifier, password);
    saveApiToken(response.token);
    return sessionFromApi(response);
  } catch {
    return null;
  }
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
  try {
    const response = await api.register(input);
    saveApiToken(response.token);
    return sessionFromApi(response);
  } catch (error) {
    const existing = await syncApiLogin(input.phone, input.password);
    if (existing) return existing;
    throw error;
  }
}

export function saveSession(session: UserSession): void {
  state.currentUser = session;
  if (session.token) saveApiToken(session.token);
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
        <p class="muted">${getCopy("Enter your phone number to receive a one-time code.", "Shigar da lambar wayarka domin karban lambar shiga.")}</p>
        <form id="authPhoneForm" novalidate>
          <label>
            <span>${getCopy("Email or phone number", "Email ko lambar waya")}</span>
            <input type="text" id="authPhone" name="phone" placeholder="08012345678 or name@email.com"
              required autocomplete="username" />
          </label>
          <button type="submit">${getCopy("Send code", "Aika lambar")}</button>
          <p class="form-message" id="authPhoneError" role="alert"></p>
        </form>
      </div>
      <div id="authPhaseOtp" class="auth-phase" hidden>
        <p class="muted" id="authOtpHint"></p>
        <form id="authOtpForm" novalidate>
          <label>
            <span>${getCopy("One-time code", "Lambar shiga")}</span>
            <input type="text" id="authOtp" name="otp" maxlength="6" pattern="\\d{6}"
              inputmode="numeric" autocomplete="one-time-code" required placeholder="${getCopy("6-digit code", "Lambar lamba 6")}" />
          </label>
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
          <button type="submit">${getCopy("Verify", "Tabbatar")}</button>
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
  const otpForm = modal.querySelector<HTMLFormElement>("#authOtpForm")!;
  const phonePhase = modal.querySelector<HTMLElement>("#authPhasePhone")!;
  const otpPhase = modal.querySelector<HTMLElement>("#authPhaseOtp")!;
  const otpHint = modal.querySelector<HTMLElement>("#authOtpHint")!;
  const phoneError = modal.querySelector<HTMLElement>("#authPhoneError")!;
  const otpError = modal.querySelector<HTMLElement>("#authOtpError")!;
  const signupFields = modal.querySelector<HTMLElement>("#authSignupFields")!;
  const vendorFields = modal.querySelector<HTMLElement>("#authVendorFields")!;
  const accountType = modal.querySelector<HTMLSelectElement>("#authAccountType")!;
  let pendingPhone = "";
  let needsSignup = false;

  function setSignupRequired(required: boolean): void {
    signupFields.hidden = !required;
    modal.querySelectorAll<HTMLInputElement>("#authFirstName, #authLastName, #authEmail, #authPassword, #authDeliveryAddress").forEach((input) => {
      input.required = required;
    });
    accountType.required = required;
    setVendorRequired(required && accountType.value === "vendor");
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
    const identifier = (modal.querySelector<HTMLInputElement>("#authPhone")?.value || "").trim();
    if (!identifier) return;
    const emailProfile = identifier.includes("@") ? findUserProfileByEmail(identifier) : null;
    pendingPhone = emailProfile?.phone || normalizePhone(identifier);
    needsSignup = requiresSignup(pendingPhone);
    setSignupRequired(needsSignup);
    const loginPasswordWrap = modal.querySelector<HTMLElement>("#authLoginPasswordWrap");
    if (loginPasswordWrap) loginPasswordWrap.hidden = needsSignup || (!findUserProfileByPhone(pendingPhone)?.passwordHash && !isAdminPhone(pendingPhone));
    otpHint.textContent = getCopy(
      isAdminPhone(pendingPhone)
        ? `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}. Enter an admin password of at least 8 characters.`
        : needsSignup
        ? `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}. Complete the first-time profile after the code.`
        : `A demo code has been sent to ${pendingPhone}. Use: ${MOCK_OTP}`,
      isAdminPhone(pendingPhone)
        ? `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}. Shigar da kalmar admin akalla haruffa 8.`
        : needsSignup
        ? `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}. Kammala bayanan farko bayan lambar.`
        : `An aika lambar gwaji zuwa ${pendingPhone}. Yi amfani da: ${MOCK_OTP}`
    );
    phonePhase.hidden = true;
    otpPhase.hidden = false;
    modal.querySelector<HTMLInputElement>("#authOtp")?.focus();
  });

  accountType.addEventListener("change", () => {
    setVendorRequired(needsSignup && accountType.value === "vendor");
  });

  otpForm.addEventListener("submit", (e) => {
    void handleOtpSubmit(e);
  });

  async function handleOtpSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const submitBtn = otpForm.querySelector<HTMLButtonElement>("button[type='submit']");
    const otp = (modal.querySelector<HTMLInputElement>("#authOtp")?.value || "").trim();
    if (otp !== MOCK_OTP) {
      otpError.textContent = getCopy("Invalid code. Try: 123456", "Lambar ba daidai ba. Gwada: 123456");
      return;
    }
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = getCopy("Signing in…", "Ana shiga…"); }
    let apiSession: UserSession | null = null;
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
      if (!firstName || !lastName || !email || !password || !deliveryAddress || (selectedType === "vendor" && (!businessName || !area))) {
        otpError.textContent = getCopy(
          "Complete the required sign-up details.",
          "Kammala muhimman bayanan rajista."
        );
        return;
      }
      if (password.length < 8) {
        otpError.textContent = getCopy("Password must be at least 8 characters.", "Kalmar sirri ta kasance akalla haruffa 8.");
        return;
      }
      saveUserProfile({
        phone: pendingPhone,
        firstName,
        lastName,
        email,
        password,
        accountType: selectedType,
        deliveryAddress,
        preferredLanguage,
        businessName,
        area,
        category,
      });
      try {
        apiSession = await syncApiRegistration({
          phone: pendingPhone,
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
      } catch {
        showToast({
          message: getCopy("Signed in locally. Live account sync needs backend storage.", "An shiga a gida. Ana bukatar ajiyar backend."),
          type: "info",
        });
      }
    } else {
      const profile = findUserProfileByPhone(pendingPhone);
      const password = (modal.querySelector<HTMLInputElement>("#authLoginPassword")?.value || "").trim();
      if (isAdminPhone(pendingPhone) && password.length < 8) {
        otpError.textContent = getCopy("Enter an admin password of at least 8 characters.", "Shigar da kalmar admin akalla haruffa 8.");
        return;
      }
      if (profile?.passwordHash && !verifyPassword(pendingPhone, password)) {
        otpError.textContent = getCopy("Incorrect password.", "Kalmar sirri ba daidai ba.");
        return;
      }
      apiSession = await syncApiLogin(pendingPhone, password);
      if (!apiSession && isAdminPhone(pendingPhone)) {
        try {
          apiSession = await syncApiRegistration({
            phone: pendingPhone,
            firstName: "Admin",
            lastName: "User",
            password,
            role: "customer",
          });
        } catch {
          showToast({
            message: getCopy("Signed in locally. Live admin sync is unavailable.", "An shiga a gida. Haɗin admin live bai samu ba."),
            type: "info",
          });
        }
      }
      if (!apiSession && profile && password.length >= 8) {
        try {
          apiSession = await syncApiRegistration({
            phone: pendingPhone,
            firstName: profile.firstName,
            lastName: profile.lastName,
            email: profile.email,
            password,
            role: profile.role,
            deliveryAddress: profile.deliveryAddress,
            preferredLanguage: profile.preferredLanguage,
          });
        } catch {
          showToast({
            message: getCopy("Signed in locally. Live account sync is unavailable.", "An shiga a gida. Haɗin asusun live bai samu ba."),
            type: "info",
          });
        }
      }
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = getCopy("Verify", "Tabbatar"); }
    otpError.textContent = "";
    const session = apiSession ?? createSessionForPhone(pendingPhone);
    saveSession(session);
    closeAuthModal();
    const roleCopy =
      session.role === "admin"
        ? getCopy("Admin verified.", "An tabbatar da admin.")
        : session.role === "vendor"
          ? getCopy("Vendor account detected.", "An gano asusun dan kasuwa.")
          : getCopy("Signed in successfully!", "An shiga cikin nasara!");
    showToast({ message: roleCopy });
  }

  modal.querySelector("#authBack")?.addEventListener("click", () => {
    phonePhase.hidden = false;
    otpPhase.hidden = true;
    setSignupRequired(false);
    phoneError.textContent = "";
    otpError.textContent = "";
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
    if (updated && !state.currentUser?.token) saveSession(createSessionForPhone(updated.phone));

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
