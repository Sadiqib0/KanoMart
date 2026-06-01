import {
  getCopy,
  state
} from "./chunk-II4BTV2J.js";

// src/frontend-enhancements.ts
var ONBOARDING_KEY = "kanoMart.onboardingSeen";
var FRONTEND_LOG_KEY = "kanoMart.frontendLogs";
function writeFrontendLog(log) {
  try {
    const logs = JSON.parse(localStorage.getItem(FRONTEND_LOG_KEY) || "[]");
    localStorage.setItem(FRONTEND_LOG_KEY, JSON.stringify([log, ...logs].slice(0, 30)));
  } catch {
  }
}
function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function initScrollProgress() {
  const progress = document.querySelector(".scroll-progress");
  if (!progress) return;
  let ticking = false;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const percent = max > 0 ? window.scrollY / max : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, percent))})`;
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  update();
}
function initScrollReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (items.length === 0) return;
  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-revealed"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-revealed");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });
  items.forEach((item) => observer.observe(item));
}
function initCounters() {
  const counters = document.querySelectorAll("[data-counter][data-target]");
  if (counters.length === 0) return;
  const runCounter = (counter) => {
    const target = Number(counter.dataset.target || 0);
    if (!Number.isFinite(target)) return;
    if (prefersReducedMotion()) {
      counter.textContent = String(target);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      counter.textContent = String(Math.round(target * eased));
      if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  if (!("IntersectionObserver" in window)) {
    counters.forEach(runCounter);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      runCounter(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.45 });
  counters.forEach((counter) => observer.observe(counter));
}
function initTypewriter() {
  const target = document.querySelector("[data-typewriter]");
  if (!target || prefersReducedMotion()) return;
  const getPhrases = () => {
    const attr = state.language === "ha" ? "phrasesHa" : "phrasesEn";
    return (target.dataset[attr] || target.textContent || "").split("|").map((phrase) => phrase.trim()).filter(Boolean);
  };
  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;
  const tick = () => {
    const phrases = getPhrases();
    if (phrases.length === 0) return;
    const phrase = phrases[phraseIndex % phrases.length];
    target.textContent = phrase.slice(0, charIndex);
    if (!deleting && charIndex < phrase.length) {
      charIndex += 1;
      window.setTimeout(tick, 54);
      return;
    }
    if (!deleting) {
      deleting = true;
      window.setTimeout(tick, 1400);
      return;
    }
    if (charIndex > 0) {
      charIndex -= 1;
      window.setTimeout(tick, 28);
      return;
    }
    deleting = false;
    phraseIndex += 1;
    window.setTimeout(tick, 220);
  };
  tick();
}
function initParallax() {
  const image = document.querySelector("[data-parallax]");
  if (!image || prefersReducedMotion()) return;
  let ticking = false;
  const update = () => {
    const offset = Math.max(-28, Math.min(28, window.scrollY * 0.08));
    image.style.setProperty("--parallax-y", `${offset}px`);
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  update();
}
function initScrollFill() {
  const elements = document.querySelectorAll("[data-scroll-fill]");
  if (elements.length === 0 || prefersReducedMotion()) return;
  let ticking = false;
  const update = () => {
    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const progress = 1 - Math.max(0, Math.min(1, rect.top / Math.max(1, window.innerHeight * 0.72)));
      element.style.setProperty("--text-fill", `${Math.round(progress * 100)}%`);
    });
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  }, { passive: true });
  update();
}
function showOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return;
  localStorage.setItem(ONBOARDING_KEY, (/* @__PURE__ */ new Date()).toISOString());
  const modal = document.createElement("div");
  modal.className = "modal-backdrop onboarding-modal modal-visible";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "onboardingTitle");
  modal.innerHTML = `
    <div class="modal-box glass-card">
      <div class="modal-header">
        <h2 id="onboardingTitle">${getCopy("Welcome to Kano Mart", "Barka da zuwa Kano Mart")}</h2>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div class="onboarding-body">
        <ol>
          <li>${getCopy("Search products from trusted Kano vendors.", "Nemi kaya daga amintattun dillalan Kano.")}</li>
          <li>${getCopy("Save items or add them to cart.", "Ajiye kaya ko saka su a kwando.")}</li>
          <li>${getCopy("Checkout with card, transfer, USSD, wallet, or pay on delivery.", "Biya da kati, transfer, USSD, wallet, ko biya idan an kawo.")}</li>
        </ol>
        <button type="button" class="checkout-done">${getCopy("Start shopping", "Fara sayayya")}</button>
      </div>
    </div>
  `;
  const close = () => modal.remove();
  document.body.appendChild(modal);
  modal.querySelector(".modal-close")?.addEventListener("click", close);
  modal.querySelector(".checkout-done")?.addEventListener("click", close);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) close();
  });
}
function initOnboarding() {
  window.addEventListener("kanoMart:signed-in", () => showOnboarding());
}
function initObservability() {
  window.addEventListener("error", (event) => {
    writeFrontendLog({
      type: "error",
      message: event.message || "Unknown frontend error",
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    writeFrontendLog({
      type: "unhandledrejection",
      message: event.reason instanceof Error ? event.reason.message : String(event.reason || "Unhandled rejection"),
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  window.addEventListener("load", () => {
    window.setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (!nav) return;
      writeFrontendLog({
        type: "performance",
        message: `load=${Math.round(nav.loadEventEnd)}ms dom=${Math.round(nav.domContentLoadedEventEnd)}ms`,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }, 0);
  }, { once: true });
}
function initFrontendEnhancements() {
  initObservability();
  initScrollProgress();
  initScrollReveal();
  initCounters();
  initTypewriter();
  initParallax();
  initScrollFill();
  initOnboarding();
}
export {
  initFrontendEnhancements
};
