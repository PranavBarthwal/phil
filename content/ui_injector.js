/**
 * ui_injector.js – Injects AI Fill trigger icons next to form fields.
 *
 * Each trigger shows a hover popout with five fill-mode options:
 *   crisp   – exact value (name, email, phone)
 *   short   – 1–2 sentence answer
 *   medium  – 3–4 sentence answer
 *   long    – detailed paragraph
 *   context – user provides extra text / voice context before generating
 */

const PhilUIInjector = (() => {
  const injectedIds = new Set();

  // ── Fill action definitions ──────────────────────────────────────────────

  const FILL_ACTIONS = [
    {
      type: "crisp",
      label: "Crisp",
      title: "Crisp — exact value (name, email, phone)",
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    },
    {
      type: "short",
      label: "Short",
      title: "Short — 1–2 sentences",
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="13" y2="12"/></svg>`,
    },
    {
      type: "medium",
      label: "Medium",
      title: "Medium — 3–4 sentences",
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="14" y2="18"/></svg>`,
    },
    {
      type: "long",
      label: "Long",
      title: "Long — full detailed paragraph",
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="5" x2="21" y2="5"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="13" x2="21" y2="13"/><line x1="3" y1="17" x2="14" y2="17"/></svg>`,
    },
    {
      type: "context",
      label: "Add Context",
      title: "Add Context — provide extra detail via text or voice",
      icon: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="12" y1="8" x2="12" y2="14"/><line x1="9" y1="11" x2="15" y2="11"/></svg>`,
      separator: true,
    },
  ];

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Injects triggers for a list of field descriptors.
   * @param {object[]} fields      – output of PhilDetector.detectAllFields()
   * @param {function} onFillClick – callback(field, fillType)
   *   fillType: 'crisp' | 'short' | 'medium' | 'long' | 'context'
   */
  function injectButtons(fields, onFillClick) {
    fields.forEach((field) => {
      if (injectedIds.has(field.id)) return;
      // Skip elements that live inside Phil's own UI (modal, popout, etc.)
      if (field.element.closest('[class*="phil-"]')) return;
      injectedIds.add(field.id);
      const trigger = createTrigger(field, onFillClick);
      insertTriggerNear(trigger, field.element);
    });
  }

  /** Removes all injected wrappers (e.g., on SPA navigation). */
  function removeAll() {
    document.querySelectorAll(".phil-field-wrapper").forEach((wrapper) => {
      const field = wrapper.querySelector("input, textarea, select");
      if (field && wrapper.parentNode) {
        wrapper.parentNode.insertBefore(field, wrapper);
      }
      wrapper.remove();
    });
    injectedIds.clear();
  }

  // ── DOM helpers ──────────────────────────────────────────────────────────

  function createTrigger(field, onFillClick) {
    const wrap = document.createElement("span");
    wrap.className = "phil-trigger-wrap";
    wrap.dataset.philId = field.id;

    // Icon-only trigger button
    const btn = document.createElement("button");
    btn.className = "phil-trigger";
    btn.type = "button";
    btn.title = "AI Fill";
    btn.setAttribute("aria-haspopup", "true");
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3.5 13.5H11L10 22L20.5 10.5H13L13 2Z"/></svg>`;

    // Hover popout menu
    const popout = document.createElement("div");
    popout.className = "phil-popout";
    popout.setAttribute("role", "menu");

    FILL_ACTIONS.forEach(({ type, label, title, icon, separator }) => {
      if (separator) {
        const hr = document.createElement("div");
        hr.className = "phil-popout-sep";
        popout.appendChild(hr);
      }
      const item = document.createElement("button");
      item.className = "phil-popout-item";
      item.type = "button";
      item.title = title;
      item.dataset.fillType = type;
      item.innerHTML = `${icon}<span>${label}</span>`;
      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFillClick(field, type);
      });
      popout.appendChild(item);
    });

    wrap.appendChild(btn);
    wrap.appendChild(popout);
    return wrap;
  }

  function insertTriggerNear(triggerWrap, el) {
    const wrapper = document.createElement("span");
    wrapper.className = "phil-field-wrapper";
    const parent = el.parentNode;
    if (!parent) return;
    parent.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(triggerWrap);
  }

  /** Shows / hides the loading spinner on a trigger. */
  function setLoading(fieldId, isLoading) {
    const wrap = document.querySelector(`.phil-trigger-wrap[data-phil-id="${CSS.escape(fieldId)}"]`);
    if (!wrap) return;
    const btn = wrap.querySelector(".phil-trigger");
    if (!btn) return;
    if (isLoading) {
      btn.classList.add("phil-loading");
      btn.disabled = true;
      btn.innerHTML = `<span class="phil-spinner"></span>`;
    } else {
      btn.classList.remove("phil-loading");
      btn.disabled = false;
      btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3.5 13.5H11L10 22L20.5 10.5H13L13 2Z"/></svg>`;
    }
  }

  return { injectButtons, removeAll, setLoading };
})();

window.PhilUIInjector = PhilUIInjector;
