/**
 * popup.js – PhilAI Popup Controller
 *
 * Handles:
 *  - Tab switching
 *  - Loading/saving profile data to chrome.storage.local
 *  - API key management
 *  - "Fill All Fields" trigger → content script
 *  - Export/Import JSON profile
 *  - Clear all data
 */

// ── Field IDs that map directly to profile keys ──────────────────────────────

const PROFILE_FIELDS = [
  "name", "email", "phone", "location",
  "shortBio", "longBio", "skills", "experience", "education",
  "linkedin", "github", "portfolio", "otherLinks",
  "resumeText",
];

const SETTINGS_FIELDS = ["apiKey", "aiModel"];

// ── Tab Switching ─────────────────────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;

    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("tab-active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));

    btn.classList.add("tab-active");
    document.getElementById(`tab-${target}`).classList.add("active");
  });
});

// Models that require a paid Gemini plan — auto-downgrade to free tier default
const PAID_ONLY_MODELS = ["gemini-2.5-pro"];
const FREE_DEFAULT_MODEL = "gemini-2.5-flash";

// ── Load Data on Open ─────────────────────────────────────────────────────────

async function loadData() {
  const data = await chrome.storage.local.get(["profile", "apiKey", "aiModel"]);
  const profile = data.profile || {};

  PROFILE_FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el && profile[key] !== undefined) el.value = profile[key];
  });

  if (data.apiKey) document.getElementById("apiKey").value = data.apiKey;

  // If a paid-only model was previously saved, reset to free-tier default
  const storedModel = data.aiModel;
  const resolvedModel = PAID_ONLY_MODELS.includes(storedModel) ? FREE_DEFAULT_MODEL : (storedModel || FREE_DEFAULT_MODEL);
  document.getElementById("aiModel").value = resolvedModel;

  // Persist the corrected model so the service worker uses it
  if (resolvedModel !== storedModel) {
    await chrome.storage.local.set({ aiModel: resolvedModel });
  }
}

// ── Save Profile ──────────────────────────────────────────────────────────────

async function saveProfile() {
  const profile = {};
  PROFILE_FIELDS.forEach((key) => {
    const el = document.getElementById(key);
    if (el) profile[key] = el.value.trim();
  });

  const apiKey = document.getElementById("apiKey").value.trim();
  const aiModel = document.getElementById("aiModel").value;

  await chrome.storage.local.set({ profile, apiKey, aiModel });

  showSaveStatus("Saved", false);
}

document.getElementById("saveBtn").addEventListener("click", saveProfile);

// Auto-save on input with a small debounce
let autoSaveTimer = null;
[...PROFILE_FIELDS, ...SETTINGS_FIELDS].forEach((key) => {
  const el = document.getElementById(key);
  if (!el) return;
  el.addEventListener("input", () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveProfile().catch(() => {});
    }, 1200);
  });
});

// ── Fill All Button ───────────────────────────────────────────────────────────

document.getElementById("fillAllBtn").addEventListener("click", async () => {
  // Save latest profile first
  await saveProfile();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showSaveStatus("No active tab", true);
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: "FILL_ALL_TRIGGER" });
    if (response?.started) {
      showSaveStatus("Filling fields…", false);
    }
  } catch {
    // Content script may not be injected on this page yet
    showSaveStatus("Reload the page first", true);
  }

  // Close popup so user can see the form being filled
  setTimeout(() => window.close(), 800);
});

// ── API Key Visibility Toggle ──────────────────────────────────────────────────

document.getElementById("toggleApiKey").addEventListener("click", () => {
  const input = document.getElementById("apiKey");
  const btn = document.getElementById("toggleApiKey");
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
  } else {
    input.type = "password";
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  }
});

// ── Export Profile ─────────────────────────────────────────────────────────────

document.getElementById("exportDataBtn").addEventListener("click", async () => {
  const data = await chrome.storage.local.get(["profile"]);
  const json = JSON.stringify(data.profile || {}, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "philai_profile.json";
  a.click();
  URL.revokeObjectURL(url);

  showSaveStatus("Exported", false);
});

// ── Import Profile ─────────────────────────────────────────────────────────────

document.getElementById("importDataBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const profile = JSON.parse(ev.target.result);
      await chrome.storage.local.set({ profile });

      // Reload form fields
      PROFILE_FIELDS.forEach((key) => {
        const el = document.getElementById(key);
        if (el && profile[key] !== undefined) el.value = profile[key];
      });

      showSaveStatus("Imported", false);
    } catch {
      showSaveStatus("Invalid JSON file", true);
    }
  };
  reader.readAsText(file);

  // Reset input so same file can be imported again
  e.target.value = "";
});

// ── Clear All Data ─────────────────────────────────────────────────────────────

document.getElementById("clearDataBtn").addEventListener("click", async () => {
  const confirmed = confirm(
    "Are you sure you want to clear ALL PhilAI data?\n\nThis will delete your profile, resume, and API key. This action cannot be undone."
  );
  if (!confirmed) return;

  await chrome.storage.local.clear();

  // Clear all inputs
  [...PROFILE_FIELDS, ...SETTINGS_FIELDS].forEach((key) => {
    const el = document.getElementById(key);
    if (el) el.value = "";
  });

  showSaveStatus("Data cleared", false);
});

// ── Status Indicator ──────────────────────────────────────────────────────────

function showSaveStatus(message, isError) {
  const el = document.getElementById("saveStatus");
  el.textContent = message;
  el.className = "save-status" + (isError ? " error" : "");

  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.textContent = "";
    el.className = "save-status";
  }, 3000);
}

// ── Check active tab status ───────────────────────────────────────────────────

async function checkActiveTab() {
  const dot = document.getElementById("statusDot");
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
    if (resp?.alive) {
      dot.classList.remove("inactive");
      dot.title = "Extension active on this page";
    }
  } catch {
    dot.classList.add("inactive");
    dot.title = "Extension not active on this page – try reloading";
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────────

loadData();
checkActiveTab();
