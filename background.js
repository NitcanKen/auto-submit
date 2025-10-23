// background.js (MV3 service worker)
// Manual injection model: user arms extension on current page, clicks at exact time

const DEFAULTS = Object.freeze({
  time: "08:00:00",
  checkboxSelector: "",
  submitSelector: "#searchButton",
  submitTextFallback: "Submit"
});

chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
  if (!settings) {
    await chrome.storage.local.set({ settings: DEFAULTS });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "ARM_EXTENSION") {
    (async () => {
      try {
        const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ error: "No active tab" });
          return;
        }

        const targetMs = getTargetTimeMs(settings.time);
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ["contentScript.js"]
        });

        sendResponse({ ok: true, targetTimeMs: targetMs });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (msg?.type === "GET_TARGET_TIME") {
    (async () => {
      const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
      const targetMs = getTargetTimeMs(settings.time);
      sendResponse({ targetTimeMs: targetMs });
    })();
    return true;
  }
});

function getTargetTimeMs(hhmm) {
  const [hh, mm] = String(hhmm || "08:00").split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}
