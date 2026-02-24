/**
 * detector.js – Detects fillable form fields on any page.
 *
 * Supports:
 *  - Standard HTML forms (input[text/email/url/tel/number], textarea, select)
 *  - Google Forms (div[role="listitem"], input, textarea inside Google's shadow-like structure)
 *  - Radio / checkbox groups (Yes/No questions)
 */

const PhilDetector = (() => {
  // ─── Selectors ────────────────────────────────────────────────────────────

  /** Field types we actively target */
  const FILLABLE_INPUTS = [
    'input[type="text"]',
    'input[type="email"]',
    'input[type="url"]',
    'input[type="tel"]',
    'input[type="number"]',
    'input[type="search"]',
    'input:not([type])',
    "textarea",
  ].join(",");

  const SELECT_SELECTOR = "select";
  const RADIO_SELECTOR = 'input[type="radio"]';

  // ─── Noise filters ────────────────────────────────────────────────────────

  const SKIP_ROLES = ["search", "combobox"];
  const SKIP_AUTOCOMPLETE = ["one-time-code", "current-password", "new-password"];
  const SKIP_NAME_PATTERNS = /captcha|csrf|token|hidden|nonce/i;

  // ─── Public API ───────────────────────────────────────────────────────────

  function detectAllFields() {
    const fields = [];

    // Text inputs & textareas
    document.querySelectorAll(FILLABLE_INPUTS).forEach((el) => {
      if (shouldSkip(el)) return;
      fields.push(buildFieldDescriptor(el));
    });

    // Select dropdowns
    document.querySelectorAll(SELECT_SELECTOR).forEach((el) => {
      if (shouldSkip(el)) return;
      fields.push(buildSelectDescriptor(el));
    });

    // Radio groups (deduplicate by name)
    const radioGroups = {};
    document.querySelectorAll(RADIO_SELECTOR).forEach((el) => {
      const groupName = el.name || el.id;
      if (!groupName || radioGroups[groupName]) return;
      radioGroups[groupName] = true;
      fields.push(buildRadioDescriptor(el, groupName));
    });

    return fields;
  }

  // ─── Field Builders ───────────────────────────────────────────────────────

  function buildFieldDescriptor(el) {
    return {
      id: getOrAssignId(el),
      element: el,
      fieldType: el.tagName.toLowerCase() === "textarea" ? "textarea" : "text",
      label: extractLabel(el),
      placeholder: el.placeholder || "",
      surroundingText: extractSurroundingText(el),
      pageTitle: document.title,
      currentValue: el.value || "",
    };
  }

  function buildSelectDescriptor(el) {
    const options = Array.from(el.options).map((o) => o.text).filter(Boolean);
    return {
      id: getOrAssignId(el),
      element: el,
      fieldType: "select",
      label: extractLabel(el),
      placeholder: "",
      surroundingText: extractSurroundingText(el),
      pageTitle: document.title,
      options,
      currentValue: el.value || "",
    };
  }

  function buildRadioDescriptor(firstRadio, groupName) {
    const allInGroup = document.querySelectorAll(`input[type="radio"][name="${groupName}"]`);
    const options = Array.from(allInGroup).map((r) => r.value || r.id);
    return {
      id: `radio_group_${groupName}`,
      element: firstRadio,
      fieldType: "radio",
      label: extractLabel(firstRadio),
      placeholder: "",
      surroundingText: extractSurroundingText(firstRadio),
      pageTitle: document.title,
      options,
      groupName,
      currentValue: "",
    };
  }

  // ─── Label Extraction ─────────────────────────────────────────────────────

  function extractLabel(el) {
    // 1. Explicit <label for="...">
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.innerText.trim();
    }

    // 2. Wrapping <label>
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.innerText.replace(el.value, "").trim();

    // 3. aria-label / aria-labelledby
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
    if (el.getAttribute("aria-labelledby")) {
      const labelEl = document.getElementById(el.getAttribute("aria-labelledby"));
      if (labelEl) return labelEl.innerText.trim();
    }

    // 4. Google Forms specific – look for the question title in the parent container
    const googleTitle = el.closest("[data-params], .Qr7Oae, .M7eMe");
    if (googleTitle) {
      const titleEl = googleTitle.querySelector(".M7eMe, [role='heading'], .freebirdFormviewerComponentsQuestionBaseTitle");
      if (titleEl) return titleEl.innerText.trim();
    }

    // 5. Previous sibling text
    const prevSibling = el.previousElementSibling;
    if (prevSibling && prevSibling.innerText) return prevSibling.innerText.trim().slice(0, 120);

    // 6. Closest ancestor heading or label-like element
    const ancestor = el.closest("div, li, section");
    if (ancestor) {
      const heading = ancestor.querySelector("h1,h2,h3,h4,h5,h6,label,legend");
      if (heading) return heading.innerText.trim().slice(0, 120);
    }

    // 7. Fallback to name/id
    return el.name || el.id || el.placeholder || "Unknown field";
  }

  function extractSurroundingText(el) {
    const container = el.closest("div, li, fieldset, section") || el.parentElement;
    if (!container) return "";
    return container.innerText?.replace(/\s+/g, " ").trim().slice(0, 300) || "";
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  let philIdCounter = 0;
  function getOrAssignId(el) {
    if (!el.dataset.philId) {
      el.dataset.philId = `phil_field_${++philIdCounter}`;
    }
    return el.dataset.philId;
  }

  function shouldSkip(el) {
    if (!el.offsetParent && el.type !== "hidden") return false; // allow hidden but not display:none
    if (el.disabled || el.readOnly) return true;
    if (el.type === "hidden") return true;
    if (SKIP_NAME_PATTERNS.test(el.name || "")) return true;
    if (SKIP_AUTOCOMPLETE.includes(el.autocomplete)) return true;
    if (SKIP_ROLES.includes(el.getAttribute("role"))) return true;
    if (el.closest('[style*="display: none"], [style*="display:none"], [hidden]')) return true;
    return false;
  }

  return { detectAllFields };
})();

// Export for use in content_main.js
window.PhilDetector = PhilDetector;
