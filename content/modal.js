/**
 * modal.js – Editable AI answer preview modal.
 *
 * Shows the AI-generated answer in an overlay.
 * User can edit and confirm, or cancel.
 */

const PhilModal = (() => {
  let modalEl = null;
  let resolvePromise = null;

  /**
   * Shows the modal with the AI-generated answer.
   * Returns a Promise that resolves with the (possibly edited) answer,
   * or null if the user cancelled.
   *
   * @param {string} answer     – AI-generated answer
   * @param {string} fieldLabel – Label of the form field
   * @returns {Promise<string|null>}
   */
  function show(answer, fieldLabel) {
    destroy(); // clean up any existing modal

    return new Promise((resolve) => {
      resolvePromise = resolve;

      // ── Backdrop ──────────────────────────────────────────────────────────
      const backdrop = document.createElement("div");
      backdrop.className = "phil-modal-backdrop";
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) cancel();
      });

      // ── Modal box ─────────────────────────────────────────────────────────
      const box = document.createElement("div");
      box.className = "phil-modal-box";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "AI Fill Preview");

      // ── Header ────────────────────────────────────────────────────────────
      const header = document.createElement("div");
      header.className = "phil-modal-header";
      header.innerHTML = `
        <span class="phil-modal-title">✨ AI Fill Preview</span>
        <span class="phil-modal-field-label">${escapeHtml(fieldLabel)}</span>
        <button class="phil-modal-close" title="Cancel" type="button">✕</button>
      `;
      header.querySelector(".phil-modal-close").addEventListener("click", cancel);

      // ── Textarea ──────────────────────────────────────────────────────────
      const textarea = document.createElement("textarea");
      textarea.className = "phil-modal-textarea";
      textarea.value = answer;
      textarea.rows = answer.length > 120 ? 6 : 3;
      textarea.spellcheck = true;

      // ── Footer buttons ────────────────────────────────────────────────────
      const footer = document.createElement("div");
      footer.className = "phil-modal-footer";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "phil-btn phil-btn-secondary";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", cancel);

      const confirmBtn = document.createElement("button");
      confirmBtn.className = "phil-btn phil-btn-primary";
      confirmBtn.type = "button";
      confirmBtn.textContent = "✓ Insert Answer";
      confirmBtn.addEventListener("click", () => confirm(textarea.value));

      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);

      // ── Keyboard shortcuts ────────────────────────────────────────────────
      box.addEventListener("keydown", (e) => {
        if (e.key === "Escape") cancel();
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") confirm(textarea.value);
      });

      // ── Assemble ──────────────────────────────────────────────────────────
      box.appendChild(header);
      box.appendChild(textarea);

      const hint = document.createElement("p");
      hint.className = "phil-modal-hint";
      hint.textContent = "Edit the answer above, then click Insert. (Ctrl+Enter to insert, Esc to cancel)";
      box.appendChild(hint);
      box.appendChild(footer);
      backdrop.appendChild(box);

      document.body.appendChild(backdrop);
      modalEl = backdrop;

      // Focus textarea after mount
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });
    });
  }

  /**
   * Shows an error message inside the modal (reusing structure).
   */
  function showError(message) {
    destroy();

    const backdrop = document.createElement("div");
    backdrop.className = "phil-modal-backdrop";
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) destroy(); });

    const box = document.createElement("div");
    box.className = "phil-modal-box phil-modal-error";

    box.innerHTML = `
      <div class="phil-modal-header">
        <span class="phil-modal-title">⚠️ PhilAI Error</span>
        <button class="phil-modal-close" type="button">✕</button>
      </div>
      <p class="phil-modal-error-msg">${escapeHtml(message)}</p>
      <div class="phil-modal-footer">
        <button class="phil-btn phil-btn-secondary phil-modal-dismiss" type="button">Dismiss</button>
      </div>
    `;
    box.querySelector(".phil-modal-close").addEventListener("click", destroy);
    box.querySelector(".phil-modal-dismiss").addEventListener("click", destroy);
    backdrop.appendChild(box);
    document.body.appendChild(backdrop);
    modalEl = backdrop;
  }

  function confirm(value) {
    if (resolvePromise) resolvePromise(value.trim());
    resolvePromise = null;
    destroy();
  }

  function cancel() {
    if (resolvePromise) resolvePromise(null);
    resolvePromise = null;
    destroy();
  }

  function destroy() {
    if (modalEl) {
      modalEl.remove();
      modalEl = null;
    }
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { show, showError, destroy };
})();

window.PhilModal = PhilModal;
