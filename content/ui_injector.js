/**
 * ui_injector.js – Injects "✨ AI Fill" buttons next to form fields.
 *
 * Each button is positioned relative to its target field.
 * Buttons are tracked so we don't inject duplicates on re-scans.
 */

const PhilUIInjector = (() => {
  const injectedIds = new Set();

  /**
   * Injects AI Fill buttons for a list of field descriptors.
   * @param {object[]} fields  – output of PhilDetector.detectAllFields()
   * @param {function} onFillClick – callback(fieldDescriptor)
   */
  function injectButtons(fields, onFillClick) {
    fields.forEach((field) => {
      if (injectedIds.has(field.id)) return;
      injectedIds.add(field.id);

      const btn = createButton(field);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onFillClick(field);
      });

      insertButtonNear(btn, field.element);
    });
  }

  /**
   * Removes all injected buttons (e.g., on page nav).
   */
  function removeAll() {
    document.querySelectorAll(".phil-ai-btn").forEach((el) => el.remove());
    injectedIds.clear();
  }

  // ─── DOM helpers ──────────────────────────────────────────────────────────

  function createButton(field) {
    const btn = document.createElement("button");
    btn.className = "phil-ai-btn";
    btn.dataset.philTarget = field.id;
    btn.type = "button";
    btn.title = `AI Fill: ${field.label}`;
    btn.innerHTML = `<span class="phil-btn-icon">✨</span><span class="phil-btn-text">AI Fill</span>`;
    return btn;
  }

  function insertButtonNear(btn, el) {
    // Wrap field + button in a relative container
    const wrapper = document.createElement("span");
    wrapper.className = "phil-field-wrapper";

    const parent = el.parentNode;
    if (!parent) return;

    parent.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    wrapper.appendChild(btn);
  }

  /**
   * Shows a loading spinner on a specific button.
   */
  function setLoading(fieldId, isLoading) {
    const btn = document.querySelector(`[data-phil-target="${fieldId}"]`);
    if (!btn) return;
    if (isLoading) {
      btn.classList.add("phil-loading");
      btn.disabled = true;
      btn.innerHTML = `<span class="phil-spinner"></span>`;
    } else {
      btn.classList.remove("phil-loading");
      btn.disabled = false;
      btn.innerHTML = `<span class="phil-btn-icon">✨</span><span class="phil-btn-text">AI Fill</span>`;
    }
  }

  return { injectButtons, removeAll, setLoading };
})();

window.PhilUIInjector = PhilUIInjector;
