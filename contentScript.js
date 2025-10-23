// contentScript.js
// Receives configuration from background.js and performs the checkbox + submit click

(function() {
  const log = (...args) => console.log("[8AM Auto Submit]", ...args);

  // Execute immediately when script is injected
  (async () => {
    try {
      const { settings } = await chrome.storage.local.get({ settings: {} });
      const targetTimeMs = getTargetTimeMs(settings.time || "08:00:00");
      await run({ settings, targetTimeMs });
    } catch (err) {
      log("Initialization error:", err);
    }
  })();

  function getTargetTimeMs(timeStr) {
    const parts = (timeStr || "08:00:00").split(":");
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    const ss = parseInt(parts[2], 10) || 0;
    
    const now = new Date();
    const target = new Date(now);
    target.setHours(hh, mm, ss, 0);
    
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }
    return target.getTime();
  }

  async function run(payload) {
    const { settings, targetTimeMs } = payload;
    log("Starting with settings:", settings, "target:", new Date(targetTimeMs).toLocaleString());

    const controller = new AbortController();
    const { signal } = controller;

    // Pre-tick checkbox early if present to enable the Submit button
    try { await tickDeclarationIfFound(settings, signal); } catch (e) { log("Pre-tick error:", e); }

    // Wait precisely until target time
    await preciseWait(targetTimeMs, signal);

    // Ensure checkbox is ticked again (in case DOM re-rendered)
    try { await tickDeclarationIfFound(settings, signal); } catch {}

    // Attempt to click the Submit button
    const clicked = await clickSubmit(settings, signal);
    if (clicked) {
      log("Submit button clicked at:", new Date().toLocaleTimeString());
    } else {
      log("Failed to find/click the Submit button.");
    }
  }

  async function preciseWait(targetMs, signal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");

    let now = Date.now();
    if (now >= targetMs) return; // already past

    // Coarse sleep loop until ~50ms before target
    while ((targetMs - now) > 50) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const ms = Math.min(200, Math.max(20, targetMs - now - 40));
      await sleep(ms);
      now = Date.now();
    }

    // Busy-wait for the final tiny window to hit as close as possible
    while (Date.now() < targetMs) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    }
  }

  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  async function tickDeclarationIfFound(settings, signal) {
    const checkbox = await findCheckbox(settings?.checkboxSelector || "", signal);
    if (checkbox && !checkbox.checked && !checkbox.disabled) {
      checkbox.click();
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      log("Declaration checkbox checked.");
      await sleep(50); // allow any enabling logic to run
    }
  }

  function queryTextCandidates(root, selector, text) {
    const els = Array.from(root.querySelectorAll(selector));
    return els.filter(isVisible).filter(el => {
      const t = (el.textContent || "").trim().toLowerCase();
      return t.includes(String(text || "").trim().toLowerCase());
    });
  }

  async function findCheckbox(customSelector, signal) {
    if (customSelector) {
      const el = document.querySelector(customSelector);
      if (el && isVisible(el)) return el;
    }

    // Heuristics: try obvious checkboxes first
    let candidates = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter(isVisible)
      .filter(el => !el.disabled);

    // Prefer ones with nearby labels mentioning declaration/rules/etc.
    const keywords = ["declare", "rules", "regulations", "terms", "conditions", "agreement"];
    const scored = candidates.map(el => {
      let score = 0;
      const label = el.closest('label') || document.querySelector(`label[for="${el.id}"]`);
      const text = ((label?.textContent) || el.parentElement?.textContent || "").toLowerCase();
      for (const k of keywords) if (text.includes(k)) score += 2;
      if (label) score += 1;
      return { el, score };
    }).sort((a,b) => b.score - a.score);

    if (scored[0]) return scored[0].el;

    // As a last resort, wait briefly for dynamic content
    return waitFor(() => {
      const el = document.querySelector('input[type="checkbox"]');
      return (el && isVisible(el)) ? el : null;
    }, 3000, signal);
  }

  async function clickSubmit(settings, signal) {
    const { submitSelector, submitTextFallback } = settings || {};

    // 1) Try custom selector
    if (submitSelector) {
      const el = document.querySelector(submitSelector);
      if (el && isVisible(el)) return clickElement(el);
    }

    // 2) Try buttons with text
    const text = submitTextFallback || 'Submit';
    let el = queryTextCandidates(document, 'button, a, [role="button"], input[type="submit"], input[type="button"]', text)[0];
    if (el) return clickElement(el);

    // 3) Try inputs with value=Submit
    el = Array.from(document.querySelectorAll('input[type="submit"], input[type="button"], button'))
      .filter(isVisible)
      .find(e => ((e.value || e.textContent || '').trim().toLowerCase().includes(text.toLowerCase())));
    if (el) return clickElement(el);

    // 4) Wait a bit for dynamic rendering then re-try
    el = await waitFor(() => {
      const e = queryTextCandidates(document, 'button, a, [role="button"], input[type="submit"], input[type="button"]', text)[0];
      return e || null;
    }, 3000, signal);

    if (el) return clickElement(el);

    return false;
  }

  function clickElement(el) {
    try {
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
    } catch {}
    el.click();
    return true;
  }

  async function waitFor(fn, timeoutMs = 5000, signal) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));

      const cleanup = () => { obs.disconnect(); clearInterval(timer); };

      const tryNow = () => {
        if (signal?.aborted) { cleanup(); return reject(new DOMException("Aborted", "AbortError")); }
        try {
          const val = fn();
          if (val) { cleanup(); return resolve(val); }
        } catch {}
        if (Date.now() - start >= timeoutMs) { cleanup(); return resolve(null); }
      };

      const obs = new MutationObserver(() => tryNow());
      obs.observe(document.documentElement || document.body, { childList: true, subtree: true });

      const timer = setInterval(tryNow, 150);
      tryNow();
    });
  }
})();
