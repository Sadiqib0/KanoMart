import {
  escapeHtml,
  getCopy,
  state
} from "./chunk-SI4ADJFE.js";

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
  const role = state.currentUser?.role ?? "customer";
  const roleCopy = {
    customer: {
      title: getCopy("Your buyer workspace is ready", "Wurin aikin mai saye ya shirya"),
      body: getCopy("Use the dashboard to move faster from discovery to delivery.", "Yi amfani da dashboard don hanzarta daga bincike zuwa isarwa."),
      cta: getCopy("Start shopping", "Fara sayayya"),
      steps: [
        [getCopy("Track live orders", "Bibiyi ododi kai tsaye"), getCopy("Open Orders to see delivery progress and payment status.", "Bude Ododi don ganin ci gaban isarwa da matsayin biyan kudi.")],
        [getCopy("Build a better cart", "Gina kwando mai kyau"), getCopy("Save items, compare vendors, then checkout when ready.", "Ajiye kaya, kwatanta dillalai, sannan ka biya idan ka shirya.")],
        [getCopy("Use Hausa or English", "Yi amfani da Hausa ko Turanci"), getCopy("Your language toggle follows you across every page.", "Canjin yare zai bi ka a kowane shafi.")]
      ]
    },
    vendor: {
      title: getCopy("Your vendor command center is ready", "Cibiyar aikin dillali ta shirya"),
      body: getCopy("Use the dashboard to protect margin, stock, and fulfillment speed.", "Yi amfani da dashboard don kula da riba, kaya, da saurin cika oda."),
      cta: getCopy("Open dashboard", "Bude dashboard"),
      steps: [
        [getCopy("Watch priority queues", "Duba jerin gaggawa"), getCopy("Low stock, pending orders, and payouts stay surfaced first.", "Karancin kaya, ododi masu jiran aiki, da biyan kudi suna bayyana farko.")],
        [getCopy("Act without page jumps", "Yi aiki ba tare da sauya shafi ba"), getCopy("Quick actions keep product and order work close to the overview.", "Ayyukan gaggawa suna kusa da takaitaccen shafi.")],
        [getCopy("Keep listings clean", "Tsabtace jerin kaya"), getCopy("Use statuses and alerts to fix risky products before buyers see issues.", "Yi amfani da matsayi da sanarwa don gyara matsaloli kafin masu saye su gani.")]
      ]
    },
    admin: {
      title: getCopy("Your operations console is ready", "Na'urar kula da aiki ta shirya"),
      body: getCopy("Use the dashboard to keep marketplace risk, finance, and moderation visible.", "Yi amfani da dashboard don ganin hadari, kudi, da tantancewa."),
      cta: getCopy("Review operations", "Duba ayyuka"),
      steps: [
        [getCopy("Moderate the marketplace", "Tantance kasuwa"), getCopy("Vendor approvals, product review, and support queues are grouped together.", "Amincewar dillalai, duba kaya, da taimako suna hade wuri daya.")],
        [getCopy("Scan system health", "Duba lafiyar tsarin"), getCopy("Operational cards make issues visible before they become user pain.", "Katunan aiki suna nuna matsala kafin ta dami masu amfani.")],
        [getCopy("Move through sections fast", "Matsa tsakanin sassa da sauri"), getCopy("The dashboard navigation stays compact, accessible, and keyboard friendly.", "Kewayar dashboard tana da sauki, tana aiki da keyboard.")]
      ]
    }
  }[role];
  const modal = document.createElement("div");
  modal.className = "modal-backdrop onboarding-modal modal-visible";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "onboardingTitle");
  modal.setAttribute("aria-describedby", "onboardingDescription");
  modal.innerHTML = `
    <div class="modal-box glass-card onboarding-card">
      <div class="modal-header">
        <div>
          <span class="onboarding-kicker">${escapeHtml(getCopy("First-use walkthrough", "Jagorar farko"))}</span>
          <h2 id="onboardingTitle">${escapeHtml(roleCopy.title)}</h2>
        </div>
        <button type="button" class="modal-close" aria-label="${getCopy("Close", "Rufe")}">\xD7</button>
      </div>
      <div class="onboarding-body">
        <p id="onboardingDescription">${escapeHtml(roleCopy.body)}</p>
        <div class="onboarding-grid">
          ${roleCopy.steps.map(([title, body], index) => `
            <article>
              <b>${String(index + 1).padStart(2, "0")}</b>
              <strong>${escapeHtml(title)}</strong>
              <span>${escapeHtml(body)}</span>
            </article>
          `).join("")}
        </div>
        <button type="button" class="checkout-done">${escapeHtml(roleCopy.cta)}</button>
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
  window.addEventListener("kanoMart:dashboard-rendered", (event) => {
    const detail = event.detail;
    writeFrontendLog({
      type: "performance",
      message: `dashboard role=${detail.role ?? "unknown"} route=${detail.route ?? "unknown"} render=${Math.round(detail.durationMs ?? 0)}ms`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
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
