// popup.js

let countdownInterval = null;
let isArmed = false;
let saveTimeout = null;

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  time: "08:00:00.500",
  checkboxSelector: "",
  submitSelector: "#searchButton",
  submitTextFallback: "Submit"
};

async function loadSettings() {
  const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
  return { ...DEFAULTS, ...settings };
}

async function saveSettings(updates) {
  const current = await loadSettings();
  const updated = { ...current, ...updates };
  await chrome.storage.local.set({ settings: updated });
  showSaveIndicator();
  return updated;
}

function showSaveIndicator() {
  const indicator = $("saveIndicator");
  indicator.textContent = "✓ Saved";
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    indicator.textContent = "";
  }, 2000);
}

function getTargetTimeMs(timeStr) {
  const defaultTime = "08:00:00.000";
  const input = (timeStr || defaultTime).trim();
  
  // Split by colon for HH:MM:SS.mmm
  const parts = input.split(":");
  const hh = parseInt(parts[0], 10) || 0;
  const mm = parseInt(parts[1], 10) || 0;
  
  // Handle seconds and milliseconds (SS.mmm or SS)
  let ss = 0;
  let ms = 0;
  if (parts[2]) {
    const secParts = parts[2].split(".");
    ss = parseInt(secParts[0], 10) || 0;
    ms = secParts[1] ? parseInt(secParts[1].padEnd(3, '0').substring(0, 3), 10) : 0;
  }
  
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, ss, ms);
  
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

function updateCountdown() {
  const timeValue = $("timeInput").value || "08:00:00.000";
  const targetMs = getTargetTimeMs(timeValue);
  const now = Date.now();
  const diff = targetMs - now;

  if (diff <= 0) {
    $("countdown").textContent = "⚠️ Target time has passed (will trigger tomorrow)";
    return;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  const milliseconds = diff % 1000;

  if (hours > 0) {
    $("countdown").textContent = `⏳ ${hours}h ${minutes}m ${seconds}s ${milliseconds}ms remaining`;
  } else if (minutes > 0) {
    $("countdown").textContent = `⏳ ${minutes}m ${seconds}s ${milliseconds}ms remaining`;
  } else if (seconds > 0) {
    $("countdown").textContent = `⏳ ${seconds}s ${milliseconds}ms remaining`;
  } else {
    $("countdown").textContent = `⏳ ${milliseconds}ms remaining`;
  }
}

async function armExtension() {
  try {
    // Save current settings before arming
    await saveSettings({
      time: $("timeInput").value || "08:00:00.000",
      submitSelector: $("submitSelector").value.trim() || "#searchButton",
      checkboxSelector: $("checkboxSelector").value.trim(),
      submitTextFallback: $("submitTextFallback").value.trim() || "Submit"
    });

    $("status").textContent = "Arming...";
    $("status").className = "status idle";
    $("armBtn").disabled = true;

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "ARM_EXTENSION" }, resolve);
    });

    if (response?.error) {
      $("status").textContent = `❌ ${response.error}`;
      $("status").className = "status error";
      $("armBtn").disabled = false;
      return;
    }

    isArmed = true;
    $("status").textContent = "✓ Armed! Waiting for target time...";
    $("status").className = "status armed";
    $("armBtn").disabled = true;
    $("disarmBtn").disabled = false;

    // Start live countdown
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      updateCountdown();
      
      const timeValue = $("timeInput").value || "08:00:00.000";
      const targetMs = getTargetTimeMs(timeValue);
      
      // Auto-refresh status if past target time + 5s
      if (Date.now() > targetMs + 5000) {
        clearInterval(countdownInterval);
        $("status").textContent = "✓ Completed (or target time passed)";
        $("status").className = "status idle";
        $("armBtn").disabled = false;
        $("disarmBtn").disabled = true;
        isArmed = false;
      }
    }, 100);

  } catch (err) {
    $("status").textContent = `❌ ${err.message}`;
    $("status").className = "status error";
    $("armBtn").disabled = false;
  }
}

function disarm() {
  isArmed = false;
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  $("status").textContent = "Ready to arm";
  $("status").className = "status idle";
  $("armBtn").disabled = false;
  $("disarmBtn").disabled = true;
  
  // Reload current tab to remove injected script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.reload(tabs[0].id);
    }
  });
}

function setPresetTime(preset) {
  if (preset.startsWith("+")) {
    // Relative time (e.g., +2min, +5min)
    const minutes = parseInt(preset.match(/\d+/)[0]);
    const target = new Date(Date.now() + minutes * 60 * 1000);
    const hh = target.getHours().toString().padStart(2, '0');
    const mm = target.getMinutes().toString().padStart(2, '0');
    const ss = target.getSeconds().toString().padStart(2, '0');
    const ms = target.getMilliseconds().toString().padStart(3, '0');
    $("timeInput").value = `${hh}:${mm}:${ss}.${ms}`;
  } else {
    // Absolute time (e.g., 08:00:00)
    $("timeInput").value = preset;
  }
  
  // Auto-save and update countdown
  saveSettings({ time: $("timeInput").value });
  updateCountdown();
}

function toggleAdvanced() {
  const section = $("advancedSection");
  const arrow = $("arrow");
  
  if (section.classList.contains("open")) {
    section.classList.remove("open");
    arrow.classList.remove("open");
  } else {
    section.classList.add("open");
    arrow.classList.add("open");
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  const settings = await loadSettings();
  $("timeInput").value = settings.time || "08:00:00.000";
  $("submitSelector").value = settings.submitSelector || "#searchButton";
  $("checkboxSelector").value = settings.checkboxSelector || "";
  $("submitTextFallback").value = settings.submitTextFallback || "Submit";

  // Initial countdown
  updateCountdown();
  
  // Update countdown every 100ms for smooth display
  setInterval(() => {
    if (!isArmed) {
      updateCountdown();
    }
  }, 100);

  // Time input change -> auto-save
  $("timeInput").addEventListener('change', () => {
    saveSettings({ time: $("timeInput").value });
    updateCountdown();
  });

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setPresetTime(btn.dataset.preset);
    });
  });

  // Advanced settings inputs -> auto-save
  $("submitSelector").addEventListener('change', () => {
    saveSettings({ submitSelector: $("submitSelector").value.trim() || "#searchButton" });
  });
  
  $("checkboxSelector").addEventListener('change', () => {
    saveSettings({ checkboxSelector: $("checkboxSelector").value.trim() });
  });
  
  $("submitTextFallback").addEventListener('change', () => {
    saveSettings({ submitTextFallback: $("submitTextFallback").value.trim() || "Submit" });
  });

  // Advanced toggle
  $("advancedToggle").addEventListener('click', toggleAdvanced);

  // Arm/Disarm buttons
  $("armBtn").addEventListener('click', armExtension);
  $("disarmBtn").addEventListener('click', disarm);
});
