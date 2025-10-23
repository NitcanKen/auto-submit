// options.js

const DEFAULTS = Object.freeze({
  time: "08:00:00",
  checkboxSelector: "",
  submitSelector: "#searchButton",
  submitTextFallback: "Submit"
});

function $(id) { return document.getElementById(id); }

function getNextTargetDate(hhmm) {
  const parts = String(hhmm || "08:00:00").split(":");
  const hh = parseInt(parts[0], 10) || 0;
  const mm = parseInt(parts[1], 10) || 0;
  const ss = parseInt(parts[2], 10) || 0;
  
  const now = new Date();
  const target = new Date(now);
  target.setHours(hh, mm, ss, 0);
  
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

function format(t) {
  try { 
    return t.toLocaleString('en-US', { 
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }); 
  } catch { 
    return String(t); 
  }
}

async function load() {
  const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
  const s = { ...DEFAULTS, ...(settings || {}) };
  
  $("time").value = s.time || "08:00:00";
  $("checkboxSelector").value = s.checkboxSelector || "";
  $("submitSelector").value = s.submitSelector || "#searchButton";
  $("submitTextFallback").value = s.submitTextFallback || "Submit";

  showNextRun(s);
}

function showNextRun(s) {
  const target = getNextTargetDate(s.time);
  const el = $("nextRun");
  el.textContent = format(target);
}

async function save() {
  const s = {
    time: $("time").value || "08:00:00",
    checkboxSelector: $("checkboxSelector").value.trim(),
    submitSelector: $("submitSelector").value.trim(),
    submitTextFallback: $("submitTextFallback").value.trim() || "Submit"
  };
  
  await chrome.storage.local.set({ settings: s });
  $("status").textContent = "✓ Saved successfully";
  $("status").className = "hint ok";
  showNextRun(s);
  
  setTimeout(() => { 
    $("status").textContent = ""; 
    $("status").className = "hint";
  }, 3000);
}

window.addEventListener('DOMContentLoaded', () => {
  load();
  $("save").addEventListener('click', save);
  $("time").addEventListener('change', async () => {
    const { settings } = await chrome.storage.local.get({ settings: DEFAULTS });
    showNextRun({ ...settings, time: $("time").value });
  });
});
