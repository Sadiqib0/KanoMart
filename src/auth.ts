import type { UserSession } from "./types";
import { storageKeys } from "./data";
import { state, elements } from "./state";
import { getCopy, escapeHtml } from "./utils";
import { showToast } from "./toast";
import { renderOrdersPanel } from "./orders";

const MOCK_OTP = "123456";

export function saveSession(session: UserSession): void {
  state.currentUser = session;
  localStorage.setItem(storageKeys.session, JSON.stringify(session));
  syncUserButton();
}

export function signOut(): void {
  state.currentUser = null;
  localStorage.removeItem(storageKeys.session);
  syncUserButton();
  closeUserPanel();
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
            <span>${getCopy("Phone number", "Lambar waya")}</span>
            <input type="tel" id="authPhone" name="phone" placeholder="08012345678"
              pattern="^(\\+234|0)[7-9][0-1]\\d{8}$" required autocomplete="tel" />
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
          <label>
            <span>${getCopy("Your name (optional)", "Sunanka (zaɓi ne)")}</span>
            <input type="text" id="authName" name="name" autocomplete="name" />
          </label>
          <button type="submit">${getCopy("Verify", "Tabbatar")}</button>
          <p class="form-message" id="authOtpError" role="alert"></p>
        </form>
        <button type="button" class="link-button" id="authBack">${getCopy("← Change number", "← Canza lambar")}</button>
      </div>
    </div>
  `;
  return el;
}

export function openAuthModal(): void {
  const existing = document.getElementById("authModal");
  if (existing) {
    existing.hidden = false;
    return;
  }
  const modal = buildAuthModal();
  document.body.appendChild(modal);
  wireAuthModal(modal);
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
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
  let pendingPhone = "";

  phoneForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = (modal.querySelector<HTMLInputElement>("#authPhone")?.value || "").trim();
    if (!phone) return;
    pendingPhone = phone;
    otpHint.textContent = getCopy(
      `A demo code has been sent to ${phone}. Use: ${MOCK_OTP}`,
      `An aika lambar gwaji zuwa ${phone}. Yi amfani da: ${MOCK_OTP}`
    );
    phonePhase.hidden = true;
    otpPhase.hidden = false;
    modal.querySelector<HTMLInputElement>("#authOtp")?.focus();
  });

  otpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const otp = (modal.querySelector<HTMLInputElement>("#authOtp")?.value || "").trim();
    const name = (modal.querySelector<HTMLInputElement>("#authName")?.value || "").trim();
    if (otp !== MOCK_OTP) {
      otpError.textContent = getCopy("Invalid code. Try: 123456", "Lambar ba daidai ba. Gwada: 123456");
      return;
    }
    otpError.textContent = "";
    saveSession({ phone: pendingPhone, name: name || pendingPhone, createdAt: new Date().toISOString() });
    closeAuthModal();
    showToast({ message: getCopy("Signed in successfully!", "An shiga cikin nasara!") });
  });

  modal.querySelector("#authBack")?.addEventListener("click", () => {
    phonePhase.hidden = false;
    otpPhase.hidden = true;
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
        <p><strong>${escapeHtml(user.name)}</strong> · ${escapeHtml(user.phone)}</p>
        <button type="button" class="link-button" id="signOutBtn">${getCopy("Sign out", "Fita")}</button>
      </div>
      <h3>${getCopy("My orders", "Odana")}</h3>
      <div id="userOrdersList">${renderOrdersPanel()}</div>
    </div>
  `;
  return el;
}

export function openUserPanel(): void {
  if (!state.currentUser) {
    openAuthModal();
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

  panel.querySelector(".modal-close")?.addEventListener("click", closeUserPanel);
  panel.addEventListener("click", (e) => { if (e.target === panel) closeUserPanel(); });
  panel.querySelector("#signOutBtn")?.addEventListener("click", signOut);
}

export function closeUserPanel(): void {
  const panel = document.getElementById("userPanel");
  if (!panel) return;
  panel.classList.remove("modal-visible");
  panel.addEventListener("transitionend", () => panel.remove(), { once: true });
}
