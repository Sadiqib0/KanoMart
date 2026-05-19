import { ADMIN_PIN, storageKeys } from "./data";
import { state, elements } from "./state";
import { getCopy } from "./utils";
import { showToast } from "./toast";

export function isAdminUnlocked(): boolean {
  return state.adminAuthenticated;
}

export function unlockAdmin(pin: string): boolean {
  if (pin !== ADMIN_PIN) return false;
  state.adminAuthenticated = true;
  localStorage.setItem(storageKeys.adminSession, new Date().toISOString());
  renderAdminGate();
  return true;
}

export function lockAdmin(): void {
  state.adminAuthenticated = false;
  localStorage.removeItem(storageKeys.adminSession);
  renderAdminGate();
}

export function renderAdminGate(): void {
  if (isAdminUnlocked()) {
    elements.adminGate.hidden = true;
    elements.adminContent.hidden = false;
  } else {
    elements.adminGate.hidden = false;
    elements.adminContent.hidden = true;
    elements.adminPinError.textContent = "";
  }
}

export function handlePinSubmit(pin: string): void {
  const ok = unlockAdmin(pin);
  if (!ok) {
    elements.adminPinError.textContent = getCopy("Incorrect PIN.", "PIN ba daidai ba.");
    showToast({ message: getCopy("Incorrect PIN.", "PIN ba daidai ba."), type: "error" });
  } else {
    showToast({ message: getCopy("Admin unlocked.", "An buɗe admin.") });
  }
}
