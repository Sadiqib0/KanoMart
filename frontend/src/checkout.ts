import { state } from "./state";
import { getCopy, escapeHtml, formatPrice, isValidPhone } from "./utils";
import { getCartItems, getCartProduct, getCartSubtotal, clearCart } from "./cart";
import { placeOrder } from "./orders";
import { showToast } from "./toast";
import { api } from "./api-client";

const DEFAULT_DELIVERY_FEE = 1200;

function buildCheckoutModal(): HTMLElement {
  const el = document.createElement("div");
  el.className = "modal-backdrop";
  el.id = "checkoutModal";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "checkoutTitle");

  const user = state.currentUser;
  const items = getCartItems();
  const subtotal = getCartSubtotal();

  const itemsHtml = items
    .map((item) => {
      const product = getCartProduct(item.productId);
      if (!product) return "";
      const name = escapeHtml(product.name[state.language]);
      const lineTotal = escapeHtml(formatPrice(
        parseInt(product.price.replace(/[^0-9]/g, ""), 10) * item.quantity
      ));
      return `<div class="checkout-item"><span>${name} ×${item.quantity}</span><span>${lineTotal}</span></div>`;
    })
    .join("");

  el.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h2 id="checkoutTitle">${getCopy("Checkout", "Biyan kudi")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">×</button>
      </div>
      <div id="checkoutFormView">
        <div class="checkout-summary">
          ${itemsHtml}
          <div class="checkout-item"><span>${getCopy("Estimated delivery fee", "Kudin kai kaya")}</span><span>${escapeHtml(formatPrice(DEFAULT_DELIVERY_FEE))}</span></div>
          <div class="checkout-total">
            <strong>${getCopy("Total", "Jimla")}</strong>
            <strong>${escapeHtml(formatPrice(subtotal + DEFAULT_DELIVERY_FEE))}</strong>
          </div>
        </div>
        <form id="checkoutForm" class="checkout-form" novalidate>
          <label>
            <span>${getCopy("Full name", "Cikakken suna")}</span>
            <input type="text" name="customerName" value="${escapeHtml(user?.name || "")}" required autocomplete="name" />
          </label>
          <label>
            <span>${getCopy("Phone number", "Lambar waya")}</span>
            <input type="tel" name="customerPhone" value="${escapeHtml(user?.phone || "")}"
              required pattern="^(\\+234|0)[7-9][0-1]\\d{8}$" autocomplete="tel"
              placeholder="08012345678" />
          </label>
          <label>
            <span>${getCopy("Delivery or pickup", "Kai kaya ko dauka")}</span>
            <select name="deliveryOption" required>
              <option value="delivery">${getCopy("Delivery", "Kai kaya")}</option>
              <option value="pickup">${getCopy("Pickup", "Dauka")}</option>
            </select>
          </label>
          <label>
            <span>${getCopy("Delivery address", "Adireshin kai kaya")}</span>
            <input type="text" name="deliveryAddress" value="${escapeHtml(user?.deliveryAddress || "")}"
              placeholder="${getCopy("Street, house number, landmark", "Titi, lambar gida, alama")}" />
          </label>
          <label>
            <span>${getCopy("Delivery area", "Yankin isarwa")}</span>
            <input type="text" name="deliveryArea" required
              placeholder="${getCopy("e.g. Sabon Gari, Tarauni", "misali Sabon Gari, Tarauni")}" />
          </label>
          <label>
            <span>${getCopy("Payment method", "Hanyar biya")}</span>
            <select name="paymentMethod" required>
              <option value="" disabled selected>${getCopy("Choose", "Zaba")}</option>
              <option value="pay_on_delivery">${getCopy("Pay on delivery", "Biya idan an kawo")}</option>
              <option value="manual_transfer">${getCopy("Manual bank transfer", "Tura kudi ta banki")}</option>
              <option value="card">${getCopy("Card payment (later online gateway)", "Biyan kati daga baya")}</option>
              <option value="ussd">${getCopy("USSD (later online gateway)", "USSD daga baya")}</option>
              <option value="wallet">${getCopy("Wallet (later)", "Wallet daga baya")}</option>
            </select>
          </label>
          <button type="submit" class="checkout-submit">${getCopy("Place order", "Sanya oda")}</button>
          <p class="form-message" id="checkoutError" role="alert"></p>
        </form>
      </div>
      <div id="checkoutSuccessView" hidden class="checkout-success">
        <div class="success-icon" aria-hidden="true">✓</div>
        <h3>${getCopy("Order placed!", "An sanya oda!")}</h3>
        <p id="checkoutOrderId" class="muted"></p>
        <p class="muted">${getCopy("We will confirm your order shortly.", "Za mu tabbatar da odanka nan ba da jimawa ba.")}</p>
        <button type="button" class="checkout-done">${getCopy("Done", "Kammala")}</button>
      </div>
    </div>
  `;
  return el;
}

export function openCheckoutModal(): void {
  const existing = document.getElementById("checkoutModal");
  if (existing) existing.remove();

  const modal = buildCheckoutModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add("modal-visible"));
  modal.querySelector<HTMLInputElement>("input[name='customerName']")?.focus();

  modal.querySelector(".modal-close")?.addEventListener("click", () => closeCheckoutModal());
  modal.addEventListener("click", (e) => { if (e.target === modal) closeCheckoutModal(); });

  modal.querySelector<HTMLFormElement>("#checkoutForm")?.addEventListener("submit", (e) => {
    void handleCheckoutSubmit(e);
  });

  async function handleCheckoutSubmit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const submitBtn = form.querySelector<HTMLButtonElement>("button[type='submit']");
    const data = new FormData(form);
    const errorEl = modal.querySelector<HTMLElement>("#checkoutError")!;

    const customerName = String(data.get("customerName") || "").trim();
    const customerPhone = String(data.get("customerPhone") || "").trim();
    const deliveryOption = String(data.get("deliveryOption") || "delivery") === "pickup" ? "pickup" : "delivery";
    const deliveryAddress = String(data.get("deliveryAddress") || "").trim();
    const deliveryArea = String(data.get("deliveryArea") || "").trim();
    const paymentMethod = String(data.get("paymentMethod") || "");

    if (!customerName) {
      errorEl.textContent = getCopy("Enter your full name.", "Shigar da cikakken sunanka.");
      form.querySelector<HTMLInputElement>("input[name='customerName']")?.focus();
      return;
    }
    if (!customerPhone || !isValidPhone(customerPhone)) {
      errorEl.textContent = getCopy("Enter a valid phone number.", "Shigar da lambar waya mai inganci.");
      form.querySelector<HTMLInputElement>("input[name='customerPhone']")?.focus();
      return;
    }
    if (deliveryOption === "delivery" && !deliveryAddress) {
      errorEl.textContent = getCopy(
        "Delivery address is required for delivery orders.",
        "Adireshin kai kaya yana da mahimmanci don oda kai kaya."
      );
      form.querySelector<HTMLInputElement>("input[name='deliveryAddress']")?.focus();
      return;
    }
    if (!deliveryArea) {
      errorEl.textContent = getCopy("Delivery area is required.", "Ana buƙatar yankin isarwa.");
      form.querySelector<HTMLInputElement>("input[name='deliveryArea']")?.focus();
      return;
    }
    if (!paymentMethod) {
      errorEl.textContent = getCopy("Choose a payment method.", "Zaɓi hanyar biyan kuɗi.");
      form.querySelector<HTMLSelectElement>("select[name='paymentMethod']")?.focus();
      return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = getCopy("Placing order…", "Ana sanya oda…"); }
    errorEl.textContent = "";

    function showSuccess(orderId: string, paymentStatus: string): void {
      // Cart is cleared AFTER the order is confirmed — never before.
      clearCart();
      modal.querySelector<HTMLElement>("#checkoutFormView")!.hidden = true;
      const successView = modal.querySelector<HTMLElement>("#checkoutSuccessView")!;
      successView.hidden = false;
      modal.querySelector<HTMLElement>("#checkoutOrderId")!.textContent = getCopy(
        `Order ID: ${orderId} — Payment: ${paymentStatus}`,
        `Lambar oda: ${orderId} — Biya: ${paymentStatus}`
      );
    }

    function resetSubmit(): void {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = getCopy("Place order", "Sanya oda"); }
    }

    // Authenticated path — API only, no local fallback.
    // A failed API call must NEVER silently create a duplicate local order.
    if (state.currentUser?.token) {
      try {
        const result = await api.checkout({
          customerName,
          customerPhone,
          deliveryOption,
          deliveryAddress,
          deliveryArea,
          paymentMethod,
        });
        resetSubmit();
        showSuccess(result.order.id, result.order.paymentStatus ?? "pending");
      } catch (error) {
        errorEl.textContent = error instanceof Error
          ? error.message
          : getCopy("Checkout failed. Please try again.", "Biyan kudi ya kasa. Da fatan za a sake gwadawa.");
        resetSubmit();
      }
      return;
    }

    // Guest path — local order (demo / offline fallback).
    const order = placeOrder(
      customerName,
      customerPhone,
      deliveryArea,
      paymentMethod,
      deliveryOption,
      deliveryAddress,
      deliveryOption === "pickup" ? 0 : DEFAULT_DELIVERY_FEE
    );

    resetSubmit();

    if (!order) {
      errorEl.textContent = getCopy("Cart is empty.", "Kwandona a fanko.");
      return;
    }

    showSuccess(order.id, order.paymentStatus);
  }

  modal.querySelector(".checkout-done")?.addEventListener("click", () => closeCheckoutModal());
}

function closeCheckoutModal(): void {
  const modal = document.getElementById("checkoutModal");
  if (!modal) return;
  modal.classList.remove("modal-visible");
  modal.addEventListener("transitionend", () => modal.remove(), { once: true });
}
