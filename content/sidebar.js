/**
 * sidebar.js – PhilAI In-Page Sidebar
 *
 * Injects a fixed right-side panel with the same tabs/forms as the old popup,
 * but living directly on the page. Toggled by clicking the extension icon
 * (chrome.action.onClicked → service worker → TOGGLE_SIDEBAR message).
 */

const PhilSidebar = (() => {
  // ── State ──────────────────────────────────────────────────────────────────

  let sidebar = null;
  let toggleBtn = null;
  let isOpen = false;
  let autoSaveTimer = null;

  const PROFILE_FIELDS = [
    "name", "email", "phone", "location",
    "shortBio", "longBio", "skills", "experience", "education",
    "linkedin", "github", "portfolio", "otherLinks",
    "resumeText",
  ];
  const SETTINGS_FIELDS = ["apiKey", "aiModel", "ollamaUrl", "ollamaModel"];

  // ── SVG icons (inline, reused across UI) ──────────────────────────────────

  const ICONS = {
    bolt:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3.5 13.5H11L10 22L20.5 10.5H13L13 2Z"/></svg>`,
    person:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    link:     `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    resume:   `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    settings: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    close:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    save:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
    fillAll:  `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    eye:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
    eyeOff:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
    export:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    import:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    trash:    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    info:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  };

  // ── HTML builder ──────────────────────────────────────────────────────────

  function buildHTML() {
    return `
    <header class="phil-sb-header">
      <div class="phil-sb-logo">${ICONS.bolt}</div>
      <div class="phil-sb-title-block">
        <span class="phil-sb-title">PhilAI</span>
        <span class="phil-sb-subtitle">AI Job Form Filler</span>
      </div>
      <div class="phil-sb-status-dot" id="phil-sb-status-dot" title="Extension active"></div>
      <label class="phil-sb-onoff" id="phil-sb-injection-label" title="Enable / disable field injection">
        <input type="checkbox" id="phil-sb-injection-toggle" checked />
        <span class="phil-sb-onoff-track"><span class="phil-sb-onoff-thumb"></span></span>
        <span class="phil-sb-onoff-text">ON</span>
      </label>
      <button class="phil-sb-close" id="phil-sb-close-btn" title="Close sidebar">${ICONS.close}</button>
    </header>

    <nav class="phil-sb-tabs">
      <button class="phil-sb-tab phil-sb-tab-active" data-tab="profile">${ICONS.person} Profile</button>
      <button class="phil-sb-tab" data-tab="links">${ICONS.link} Links</button>
      <button class="phil-sb-tab" data-tab="resume">${ICONS.resume} Resume</button>
      <button class="phil-sb-tab" data-tab="settings">${ICONS.settings} Settings</button>
    </nav>

    <div class="phil-sb-body">

      <!-- Profile -->
      <section class="phil-sb-content phil-sb-content-active" data-tab="profile">
        <div class="phil-sb-form-group">
          <label for="phil-sb-name">Full Name</label>
          <input type="text" id="phil-sb-name" placeholder="Jane Doe" autocomplete="off" />
        </div>
        <div class="phil-sb-form-row">
          <div class="phil-sb-form-group">
            <label for="phil-sb-email">Email</label>
            <input type="email" id="phil-sb-email" placeholder="jane@example.com" autocomplete="off" />
          </div>
          <div class="phil-sb-form-group">
            <label for="phil-sb-phone">Phone</label>
            <input type="tel" id="phil-sb-phone" placeholder="+1 555 000 0000" autocomplete="off" />
          </div>
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-location">Location</label>
          <input type="text" id="phil-sb-location" placeholder="San Francisco, CA" autocomplete="off" />
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-shortBio">Short Bio <span class="phil-sb-label-hint">(1–2 sentences)</span></label>
          <textarea id="phil-sb-shortBio" rows="2" placeholder="A seasoned full-stack engineer with 5 years of experience…"></textarea>
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-longBio">Long Bio / Cover Statement <span class="phil-sb-label-hint">(3–5 sentences)</span></label>
          <textarea id="phil-sb-longBio" rows="4" placeholder="I am a product-focused engineer who loves turning complex problems…"></textarea>
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-skills">Skills <span class="phil-sb-label-hint">(comma-separated)</span></label>
          <textarea id="phil-sb-skills" rows="2" placeholder="React, Node.js, TypeScript, AWS, PostgreSQL…"></textarea>
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-experience">Experience Summary</label>
          <textarea id="phil-sb-experience" rows="4" placeholder="2019–2022: Software Engineer at Acme Corp…"></textarea>
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-education">Education</label>
          <textarea id="phil-sb-education" rows="2" placeholder="B.Sc. Computer Science, MIT, 2019"></textarea>
        </div>
      </section>

      <!-- Links -->
      <section class="phil-sb-content" data-tab="links">
        <div class="phil-sb-form-group">
          <label for="phil-sb-linkedin">LinkedIn URL</label>
          <input type="url" id="phil-sb-linkedin" placeholder="https://linkedin.com/in/janedoe" autocomplete="off" />
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-github">GitHub URL</label>
          <input type="url" id="phil-sb-github" placeholder="https://github.com/janedoe" autocomplete="off" />
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-portfolio">Portfolio / Website</label>
          <input type="url" id="phil-sb-portfolio" placeholder="https://janedoe.dev" autocomplete="off" />
        </div>
        <div class="phil-sb-form-group">
          <label for="phil-sb-otherLinks">Other Links <span class="phil-sb-label-hint">(one per line)</span></label>
          <textarea id="phil-sb-otherLinks" rows="3" placeholder="https://medium.com/@janedoe&#10;https://dribbble.com/janedoe"></textarea>
        </div>
      </section>

      <!-- Resume -->
      <section class="phil-sb-content" data-tab="resume">
        <p class="phil-sb-intro">Paste your full resume text below. The AI uses this as the primary source of truth when answering questions.</p>
        <div class="phil-sb-form-group">
          <label for="phil-sb-resumeText">Full Resume Text</label>
          <textarea id="phil-sb-resumeText" rows="16" placeholder="Paste plain-text resume here…&#10;&#10;EXPERIENCE&#10;Senior Engineer, Acme Corp (2021–Present)&#10;- Led migration to microservices…"></textarea>
        </div>
        <p class="phil-sb-tip">
          ${ICONS.info}
          Copy from your resume document and paste as plain text for best results.
        </p>
      </section>

      <!-- Settings -->
      <section class="phil-sb-content" data-tab="settings">

        <!-- Provider picker -->
        <div class="phil-sb-form-group">
          <label>AI Provider</label>
          <div class="phil-sb-provider-toggle">
            <button class="phil-sb-provider-opt phil-sb-provider-active" data-provider="gemini">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
              Gemini
            </button>
            <button class="phil-sb-provider-opt" data-provider="ollama">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              Ollama (Local)
            </button>
          </div>
        </div>

        <!-- Gemini config -->
        <div id="phil-sb-gemini-cfg">
          <div class="phil-sb-form-group">
            <label for="phil-sb-apiKey">
              Gemini API Key
              <a href="https://aistudio.google.com/app/apikey" target="_blank" class="phil-sb-label-link" title="Get your Gemini API key">Get key ↗</a>
            </label>
            <div class="phil-sb-input-wrap">
              <input type="password" id="phil-sb-apiKey" placeholder="AIza…" autocomplete="off" />
              <button class="phil-sb-toggle-vis" id="phil-sb-toggle-key" type="button" title="Show/hide key">${ICONS.eye}</button>
            </div>
            <p class="phil-sb-field-note">Stored only in your browser. Calls go directly to Google's Gemini API — never proxied.</p>
          </div>
          <div class="phil-sb-form-group">
            <label for="phil-sb-aiModel">Gemini Model</label>
            <select id="phil-sb-aiModel">
              <option value="gemini-2.5-flash" selected>Gemini 2.5 Flash (Free tier – recommended)</option>
              <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Free tier – lightest)</option>
              <option value="gemini-2.5-pro">Gemini 2.5 Pro (Paid – best quality)</option>
            </select>
          </div>
        </div>

        <!-- Ollama config -->
        <div id="phil-sb-ollama-cfg" style="display:none">
          <div class="phil-sb-form-group">
            <label for="phil-sb-ollamaUrl">Ollama API URL</label>
            <input type="text" id="phil-sb-ollamaUrl" placeholder="http://localhost:11434/api/chat" autocomplete="off" />
            <p class="phil-sb-field-note">Ollama must be running with <code style="font-family:monospace;font-size:10px;background:#f1f5f9;padding:1px 4px;border-radius:3px">OLLAMA_ORIGINS=*</code> to allow browser access.</p>
          </div>
          <div class="phil-sb-form-group">
            <label for="phil-sb-ollamaModel">Model Name</label>
            <input type="text" id="phil-sb-ollamaModel" placeholder="llama3.2:1b" autocomplete="off" />
            <p class="phil-sb-field-note">Must be pulled locally, e.g. <code style="font-family:monospace;font-size:10px;background:#f1f5f9;padding:1px 4px;border-radius:3px">ollama pull llama3.2:1b</code></p>
          </div>
        </div>

        <div class="phil-sb-section">
          <p class="phil-sb-section-title">Data Management</p>
          <div class="phil-sb-btn-row">
            <button class="phil-sb-btn phil-sb-btn-outline" id="phil-sb-export-btn">
              ${ICONS.export} Export
            </button>
            <button class="phil-sb-btn phil-sb-btn-outline" id="phil-sb-import-btn">
              ${ICONS.import} Import
            </button>
            <input type="file" id="phil-sb-import-file" accept=".json" style="display:none!important" />
          </div>
          <button class="phil-sb-btn phil-sb-btn-danger" id="phil-sb-clear-btn">
            ${ICONS.trash} Clear All Data
          </button>
        </div>

        <div class="phil-sb-section">
          <p class="phil-sb-section-title">About</p>
          <p class="phil-sb-about-text">PhilAI v1.0.0 – AI-powered job application assistant.<br/>All data stays local. Open source.</p>
        </div>
      </section>

    </div>

    <footer class="phil-sb-footer">
      <span class="phil-sb-save-msg" id="phil-sb-save-status"></span>
      <div class="phil-sb-footer-btns">
        <button class="phil-sb-btn phil-sb-btn-secondary" id="phil-sb-save-btn">
          ${ICONS.save} Save
        </button>
        <button class="phil-sb-btn phil-sb-btn-primary" id="phil-sb-fill-btn">
          ${ICONS.fillAll} Fill All
        </button>
      </div>
    </footer>`;
  }

  // ── DOM injection ─────────────────────────────────────────────────────────

  function inject() {
    if (document.getElementById("phil-sidebar")) return; // already injected

    // Main sidebar panel — class "phil-sidebar" ensures injection guard skips its inputs
    sidebar = document.createElement("div");
    sidebar.id = "phil-sidebar";
    sidebar.className = "phil-sidebar"; // used by injection guard in ui_injector.js
    sidebar.innerHTML = buildHTML();
    document.body.appendChild(sidebar);

    // Floating toggle pill (visible when sidebar is closed)
    toggleBtn = document.createElement("button");
    toggleBtn.id = "phil-sb-toggle";
    toggleBtn.title = "Open PhilAI";
    toggleBtn.innerHTML = `${ICONS.bolt}<span>Phil</span>`;
    document.body.appendChild(toggleBtn);

    initEventListeners();
    loadData();
    checkPageStatus();
  }

  // ── Visibility ────────────────────────────────────────────────────────────

  function open() {
    if (!sidebar) inject();
    isOpen = true;
    sidebar.classList.add("phil-sb-open");
    toggleBtn.classList.add("phil-sb-toggle-hidden");
  }

  function close() {
    isOpen = false;
    sidebar.classList.remove("phil-sb-open");
    toggleBtn.classList.remove("phil-sb-toggle-hidden");
  }

  function toggle() {
    if (!sidebar) inject();
    isOpen ? close() : open();
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  function initEventListeners() {
    // Close button
    sidebar.querySelector("#phil-sb-close-btn").addEventListener("click", close);

    // Injection on/off toggle
    sidebar.querySelector("#phil-sb-injection-toggle").addEventListener("change", async (e) => {
      const enabled = e.target.checked;
      const label = sidebar.querySelector(".phil-sb-onoff-text");
      if (label) label.textContent = enabled ? "ON" : "OFF";
      await chrome.storage.local.set({ injectionEnabled: enabled });
      document.dispatchEvent(new CustomEvent("phil-injection-toggle", { detail: { enabled } }));
    });

    // Floating toggle
    toggleBtn.addEventListener("click", open);

    // Tab switching
    sidebar.querySelectorAll(".phil-sb-tab").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    // Save button
    sidebar.querySelector("#phil-sb-save-btn").addEventListener("click", saveProfile);

    // Auto-save on input
    [...PROFILE_FIELDS, ...SETTINGS_FIELDS].forEach((key) => {
      const el = sidebar.querySelector(`#phil-sb-${key}`);
      if (!el) return;
      el.addEventListener("input", () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => saveProfile().catch(() => {}), 1200);
      });
    });

    // Fill All
    sidebar.querySelector("#phil-sb-fill-btn").addEventListener("click", async () => {
      await saveProfile();
      close();
      // Let content_main.js handle the actual fill
      document.dispatchEvent(new CustomEvent("phil-fill-all"));
    });

    // Provider toggle
    sidebar.querySelectorAll(".phil-sb-provider-opt").forEach((btn) => {
      btn.addEventListener("click", () => {
        sidebar.querySelectorAll(".phil-sb-provider-opt").forEach((b) => b.classList.remove("phil-sb-provider-active"));
        btn.classList.add("phil-sb-provider-active");
        updateProviderVisibility(btn.dataset.provider);
        saveProfile().catch(() => {});
      });
    });

    // API key visibility toggle
    const keyInput = sidebar.querySelector("#phil-sb-apiKey");
    const keyToggle = sidebar.querySelector("#phil-sb-toggle-key");
    keyToggle.addEventListener("click", () => {
      if (keyInput.type === "password") {
        keyInput.type = "text";
        keyToggle.innerHTML = ICONS.eyeOff;
      } else {
        keyInput.type = "password";
        keyToggle.innerHTML = ICONS.eye;
      }
    });

    // Export
    sidebar.querySelector("#phil-sb-export-btn").addEventListener("click", async () => {
      const data = await storageGet(["profile"]);
      const json = JSON.stringify(data.profile || {}, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "philai_profile.json";
      a.click();
      URL.revokeObjectURL(url);
      showStatus("Exported", false);
    });

    // Import
    const importInput = sidebar.querySelector("#phil-sb-import-file");
    sidebar.querySelector("#phil-sb-import-btn").addEventListener("click", () => importInput.click());
    importInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const profile = JSON.parse(ev.target.result);
          await chrome.storage.local.set({ profile });
          PROFILE_FIELDS.forEach((key) => {
            const el = sidebar.querySelector(`#phil-sb-${key}`);
            if (el && profile[key] !== undefined) el.value = profile[key];
          });
          showStatus("Imported", false);
        } catch {
          showStatus("Invalid JSON file", true);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });

    // Clear data
    sidebar.querySelector("#phil-sb-clear-btn").addEventListener("click", async () => {
      const confirmed = confirm(
        "Clear ALL PhilAI data?\n\nThis will delete your profile, resume, and API key. Cannot be undone."
      );
      if (!confirmed) return;
      await chrome.storage.local.clear();
      [...PROFILE_FIELDS, ...SETTINGS_FIELDS].forEach((key) => {
        const el = sidebar.querySelector(`#phil-sb-${key}`);
        if (el) el.value = "";
      });
      showStatus("Data cleared", false);
    });
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  function switchTab(target) {
    sidebar.querySelectorAll(".phil-sb-tab").forEach((t) => {
      t.classList.toggle("phil-sb-tab-active", t.dataset.tab === target);
    });
    sidebar.querySelectorAll(".phil-sb-content").forEach((c) => {
      c.classList.toggle("phil-sb-content-active", c.dataset.tab === target);
    });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  const PAID_ONLY_MODELS = ["gemini-2.5-pro"];
  const FREE_DEFAULT_MODEL = "gemini-2.5-flash";

  function updateProviderVisibility(provider) {
    const geminiCfg = sidebar.querySelector("#phil-sb-gemini-cfg");
    const ollamaCfg = sidebar.querySelector("#phil-sb-ollama-cfg");
    if (!geminiCfg || !ollamaCfg) return;
    if (provider === "ollama") {
      geminiCfg.style.display = "none";
      ollamaCfg.style.removeProperty("display");
    } else {
      ollamaCfg.style.display = "none";
      geminiCfg.style.removeProperty("display");
    }
  }

  async function loadData() {
    const data = await storageGet(["profile", "apiKey", "aiModel", "llmProvider", "ollamaUrl", "ollamaModel", "injectionEnabled"]);
    const profile = data.profile || {};

    PROFILE_FIELDS.forEach((key) => {
      const el = sidebar.querySelector(`#phil-sb-${key}`);
      if (el && profile[key] !== undefined) el.value = profile[key];
    });

    if (data.apiKey) {
      const el = sidebar.querySelector("#phil-sb-apiKey");
      if (el) el.value = data.apiKey;
    }

    const storedModel = data.aiModel;
    const resolvedModel =
      PAID_ONLY_MODELS.includes(storedModel)
        ? FREE_DEFAULT_MODEL
        : storedModel || FREE_DEFAULT_MODEL;

    const modelEl = sidebar.querySelector("#phil-sb-aiModel");
    if (modelEl) modelEl.value = resolvedModel;

    if (resolvedModel !== storedModel) {
      await chrome.storage.local.set({ aiModel: resolvedModel });
    }

    // Ollama fields
    const ollamaUrlEl   = sidebar.querySelector("#phil-sb-ollamaUrl");
    const ollamaModelEl = sidebar.querySelector("#phil-sb-ollamaModel");
    if (ollamaUrlEl)   ollamaUrlEl.value   = data.ollamaUrl   || "http://localhost:11434/api/chat";
    if (ollamaModelEl) ollamaModelEl.value = data.ollamaModel || "llama3.2:1b";

    // Provider selection
    const provider = data.llmProvider || "gemini";
    sidebar.querySelectorAll(".phil-sb-provider-opt").forEach((btn) => {
      btn.classList.toggle("phil-sb-provider-active", btn.dataset.provider === provider);
    });
    updateProviderVisibility(provider);

    // Injection toggle (default ON)
    const injectionEnabled = data.injectionEnabled !== false;
    const toggleEl = sidebar.querySelector("#phil-sb-injection-toggle");
    const labelEl  = sidebar.querySelector(".phil-sb-onoff-text");
    if (toggleEl) toggleEl.checked = injectionEnabled;
    if (labelEl)  labelEl.textContent = injectionEnabled ? "ON" : "OFF";
  }

  async function saveProfile() {
    const profile = {};
    PROFILE_FIELDS.forEach((key) => {
      const el = sidebar.querySelector(`#phil-sb-${key}`);
      if (el) profile[key] = el.value.trim();
    });

    const apiKeyEl      = sidebar.querySelector("#phil-sb-apiKey");
    const modelEl       = sidebar.querySelector("#phil-sb-aiModel");
    const ollamaUrlEl   = sidebar.querySelector("#phil-sb-ollamaUrl");
    const ollamaModelEl = sidebar.querySelector("#phil-sb-ollamaModel");
    const activeProvider = sidebar.querySelector(".phil-sb-provider-opt.phil-sb-provider-active");

    const apiKey      = apiKeyEl      ? apiKeyEl.value.trim()      : "";
    const aiModel     = modelEl       ? modelEl.value              : FREE_DEFAULT_MODEL;
    const ollamaUrl   = ollamaUrlEl   ? ollamaUrlEl.value.trim()   : "http://localhost:11434/api/chat";
    const ollamaModel = ollamaModelEl ? ollamaModelEl.value.trim() : "llama3.2:1b";
    const llmProvider = activeProvider ? activeProvider.dataset.provider : "gemini";

    await chrome.storage.local.set({ profile, apiKey, aiModel, ollamaUrl, ollamaModel, llmProvider });
    showStatus("Saved", false);
  }

  // ── Status indicator ──────────────────────────────────────────────────────

  function showStatus(message, isError) {
    const el = sidebar.querySelector("#phil-sb-save-status");
    if (!el) return;
    el.textContent = message;
    el.className = "phil-sb-save-msg" + (isError ? " error" : "");
    clearTimeout(el._timer);
    el._timer = setTimeout(() => {
      el.textContent = "";
      el.className = "phil-sb-save-msg";
    }, 3000);
  }

  // ── Page status dot ───────────────────────────────────────────────────────

  function checkPageStatus() {
    // If content scripts are running on this page the sidebar itself is proof
    const dot = sidebar.querySelector("#phil-sb-status-dot");
    if (dot) dot.classList.remove("inactive");
  }

  // ── Storage helper ────────────────────────────────────────────────────────

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  // ── Message listener (toggle from extension icon) ─────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "TOGGLE_SIDEBAR") {
      toggle();
    }
  });

  // ── Boot ──────────────────────────────────────────────────────────────────

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }

  return { toggle, open, close };
})();
