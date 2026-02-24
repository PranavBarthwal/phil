/**
 * content_main.js – Orchestrates form detection, UI injection, and AI fill flow.
 *
 * Responsibilities:
 *  - Run initial scan on page load
 *  - Re-scan when DOM mutates (SPA navigation, dynamic forms)
 *  - Handle "✨ AI Fill" button clicks (single field)
 *  - Handle "Fill All Fields" message from popup
 *  - Fill field values after AI answers are confirmed
 */

(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let currentFields = [];
  let scanDebounceTimer = null;

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    scanAndInject();
    observeDOM();
    listenForMessages();
  }

  // ── Scanning & Injection ───────────────────────────────────────────────────

  function scanAndInject() {
    currentFields = PhilDetector.detectAllFields();
    PhilUIInjector.injectButtons(currentFields, handleSingleFill);
  }

  /** Debounced re-scan on DOM mutations (handles SPAs & dynamic forms) */
  function observeDOM() {
    const observer = new MutationObserver((mutations) => {
      // Ignore mutations that only touch Phil's own UI nodes
      const hasExternalChange = mutations.some((m) =>
        Array.from(m.addedNodes).some(
          (n) =>
            n.nodeType === 1 &&
            !n.classList?.value?.includes("phil-") &&
            !n.closest?.('[class*="phil-"]')
        )
      );
      if (!hasExternalChange) return;

      clearTimeout(scanDebounceTimer);
      scanDebounceTimer = setTimeout(() => {
        scanAndInject();
      }, 800);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // ── Single Field Fill ──────────────────────────────────────────────────────

  /**
   * @param {object} field    – field descriptor from PhilDetector
   * @param {string} fillType – 'crisp' | 'short' | 'medium' | 'long' | 'context'
   */
  async function handleSingleFill(field, fillType = "short") {
    let extraContext = null;

    // For "context" mode, collect user input first (text + optional voice)
    if (fillType === "context") {
      const result = await PhilModal.showContextInput(field.label);
      if (result === null) return; // user cancelled
      extraContext = result.text || null;
      fillType = result.fillType || "medium";
    }

    PhilUIInjector.setLoading(field.id, true);

    try {
      const profile = await getStoredProfile();
      if (!hasProfileData(profile)) {
        PhilUIInjector.setLoading(field.id, false);
        PhilModal.showError(
          "Your profile is empty. Please open the PhilAI sidebar and fill in your details first."
        );
        return;
      }

      const fieldContext = buildFieldContext(field);

      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_ANSWER",
        payload: { fieldContext, profile, fillType, extraContext },
      });

      PhilUIInjector.setLoading(field.id, false);

      if (!response.success) {
        PhilModal.showError(response.error || "Gemini generation failed. Please try again.");
        return;
      }

      const confirmedAnswer = await PhilModal.show(response.answer, field.label);
      if (confirmedAnswer !== null) {
        fillField(field, confirmedAnswer);
      }
    } catch (err) {
      PhilUIInjector.setLoading(field.id, false);
      PhilModal.showError(`Unexpected error: ${err.message}`);
    }
  }

  // ── Fill All Fields ────────────────────────────────────────────────────────

  async function handleFillAll() {
    const profile = await getStoredProfile();
    if (!hasProfileData(profile)) {
      PhilModal.showError(
        "Your profile is empty. Please open the PhilAI sidebar and fill in your details first."
      );
      return;
    }

    // Re-scan to get fresh list
    currentFields = PhilDetector.detectAllFields();

    if (currentFields.length === 0) {
      PhilModal.showError("No fillable fields detected on this page.");
      return;
    }

    // Show a toast notification
    showToast(`Generating AI answers for ${currentFields.length} field(s)…`);

    const fieldsForAPI = currentFields.map(buildFieldContext);

    const response = await chrome.runtime.sendMessage({
      type: "FILL_ALL_FIELDS",
      payload: { fields: fieldsForAPI, profile },
    });

    if (!response.success) {
      PhilModal.showError(response.error || "Fill All failed. Please try again.");
      return;
    }

    const answers = response.answers;
    let filled = 0;

    for (const field of currentFields) {
      const answer = answers[field.id];
      if (answer) {
        fillField(field, answer);
        filled++;
      }
    }

    showToast(`✅ Filled ${filled} of ${currentFields.length} fields!`);
  }

  // ── Field Value Setter ─────────────────────────────────────────────────────

  function fillField(field, value) {
    const el = field.element;
    if (!el) return;

    if (field.fieldType === "select") {
      fillSelect(el, value);
    } else if (field.fieldType === "radio") {
      fillRadio(field, value);
    } else {
      // text / textarea
      fillTextInput(el, value);
    }

    // Visual highlight to show it was filled
    el.classList.add("phil-filled");
    setTimeout(() => el.classList.remove("phil-filled"), 2000);
  }

  function fillTextInput(el, value) {
    // Native input value setter – works with React, Vue, Angular controlled inputs
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    // Trigger events so frameworks pick up the change
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(el, value) {
    // Try exact match first, then case-insensitive partial match
    const options = Array.from(el.options);
    const exact = options.find((o) => o.text.toLowerCase() === value.toLowerCase());
    const partial = options.find((o) => o.text.toLowerCase().includes(value.toLowerCase()));
    const match = exact || partial;
    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function fillRadio(field, value) {
    const radios = document.querySelectorAll(`input[type="radio"][name="${field.groupName}"]`);
    radios.forEach((r) => {
      if (r.value.toLowerCase().includes(value.toLowerCase())) {
        r.checked = true;
        r.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  }

  // ── Message Listener (from popup) ─────────────────────────────────────────

  function listenForMessages() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "PING") {
        sendResponse({ alive: true });
        return;
      }
      if (message.type === "FILL_ALL_TRIGGER") {
        handleFillAll();
        sendResponse({ started: true });
      }
    });

    // Triggered by Fill All button inside the sidebar
    document.addEventListener("phil-fill-all", () => handleFillAll());
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async function getStoredProfile() {
    return new Promise((resolve) => {
      chrome.storage.local.get("profile", (data) => resolve(data.profile || {}));
    });
  }

  function hasProfileData(profile) {
    return Object.values(profile).some((v) => typeof v === "string" && v.trim().length > 0);
  }

  function buildFieldContext(field) {
    return {
      id: field.id,
      fieldType: field.fieldType,
      label: field.label,
      placeholder: field.placeholder,
      surroundingText: field.surroundingText,
      pageTitle: field.pageTitle,
      options: field.options || [],
    };
  }

  /** Simple toast notification */
  function showToast(message) {
    const existing = document.querySelector(".phil-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "phil-toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.add("phil-toast-visible");
    });

    setTimeout(() => {
      toast.classList.remove("phil-toast-visible");
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ── Boot ───────────────────────────────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
