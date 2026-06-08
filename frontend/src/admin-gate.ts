import { state, elements } from "./state";

export function isAdminUnlocked(): boolean {
  return state.currentUser?.role === "admin";
}

export function unlockAdmin(pin: string): boolean {
  void pin;
  renderAdminGate();
  return isAdminUnlocked();
}

export function lockAdmin(): void {
  state.adminAuthenticated = false;
  renderAdminGate();
}

export function renderAdminGate(): void {
  if (isAdminUnlocked()) {
    elements.adminGate.hidden = true;
    elements.adminContent.hidden = false;
  } else {
    elements.adminGate.hidden = false;
    elements.adminContent.hidden = true;
  }
}

export function handlePinSubmit(pin: string): void {
  unlockAdmin(pin);
}
