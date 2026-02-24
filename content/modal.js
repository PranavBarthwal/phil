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
        <span class="phil-modal-title">AI Fill Preview</span>
        <span class="phil-modal-field-label">${escapeHtml(fieldLabel)}</span>
        <button class="phil-modal-close" title="Cancel" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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
      confirmBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Insert`;
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
        <span class="phil-modal-title">PhilAI Error</span>
        <button class="phil-modal-close" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
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

  /**
   * Shows a context-input modal before AI generation.
   * User can type and/or speak additional context.
   * Returns a Promise<string|null> — null means cancelled.
   *
   * @param {string} fieldLabel – label of the field being filled
   * @returns {Promise<string|null>}
   */
  function showContextInput(fieldLabel) {
    destroy();

    return new Promise((resolve) => {
      // ── Backdrop ────────────────────────────────────────────────────────
      const backdrop = document.createElement("div");
      backdrop.className = "phil-modal-backdrop";
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) { resolve(null); destroy(); }
      });

      // ── Box ──────────────────────────────────────────────────────────────
      const box = document.createElement("div");
      box.className = "phil-modal-box";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.setAttribute("aria-label", "Add Context");

      // ── Header ───────────────────────────────────────────────────────────
      const header = document.createElement("div");
      header.className = "phil-modal-header";
      header.innerHTML = `
        <span class="phil-modal-title">Add Context</span>
        <span class="phil-modal-field-label">${escapeHtml(fieldLabel)}</span>
        <button class="phil-modal-close" title="Cancel" type="button"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      `;
      header.querySelector(".phil-modal-close").addEventListener("click", () => { resolve(null); destroy(); });

      // ── Description ──────────────────────────────────────────────────────
      const desc = document.createElement("p");
      desc.className = "phil-context-desc";
      desc.textContent = "Add extra details to guide the AI, then pick an answer length.";

      // ── Length picker ─────────────────────────────────────────────────────
      const LENGTHS = [
        { type: "crisp",  label: "Crisp" },
        { type: "short",  label: "Short" },
        { type: "medium", label: "Medium" },
        { type: "long",   label: "Long"  },
      ];
      let selectedLength = "medium";

      const picker = document.createElement("div");
      picker.className = "phil-length-picker";

      LENGTHS.forEach(({ type, label }) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "phil-length-opt" + (type === selectedLength ? " phil-length-opt-active" : "");
        btn.dataset.length = type;
        btn.textContent = label;
        btn.addEventListener("click", () => {
          selectedLength = type;
          picker.querySelectorAll(".phil-length-opt").forEach((b) =>
            b.classList.toggle("phil-length-opt-active", b.dataset.length === type)
          );
        });
        picker.appendChild(btn);
      });

      // ── Textarea + mic ────────────────────────────────────────────────────
      const inputWrap = document.createElement("div");
      inputWrap.className = "phil-context-input-wrap";

      const textarea = document.createElement("textarea");
      textarea.className = "phil-modal-textarea";
      textarea.placeholder = "e.g. \"Focus on my React experience\" or speak using the mic…";
      textarea.rows = 4;
      textarea.spellcheck = true;

      // Mic button
      const micBtn = document.createElement("button");
      micBtn.className = "phil-mic-btn";
      micBtn.type = "button";
      micBtn.title = "Start / stop voice input";
      micBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;

      // Speech recognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        micBtn.style.display = "none";
      } else {
        let recognition = null;
        let isListening = false;

        micBtn.addEventListener("click", () => {
          if (isListening) {
            recognition && recognition.stop();
            return;
          }
          recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = "en-US";

          recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add("phil-mic-listening");
            micBtn.title = "Stop recording";
          };

          let finalTranscript = textarea.value;
          recognition.onresult = (event) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const t = event.results[i][0].transcript;
              if (event.results[i].isFinal) { finalTranscript += (finalTranscript ? " " : "") + t; }
              else { interim = t; }
            }
            textarea.value = finalTranscript + (interim ? " " + interim : "");
          };

          recognition.onend = () => {
            isListening = false;
            textarea.value = finalTranscript;
            micBtn.classList.remove("phil-mic-listening");
            micBtn.title = "Start voice input";
          };

          recognition.onerror = () => {
            isListening = false;
            micBtn.classList.remove("phil-mic-listening");
            micBtn.title = "Start voice input";
          };

          recognition.start();
        });
      }

      inputWrap.appendChild(textarea);
      inputWrap.appendChild(micBtn);

      // ── Footer ────────────────────────────────────────────────────────────
      const footer = document.createElement("div");
      footer.className = "phil-modal-footer";

      const cancelBtn = document.createElement("button");
      cancelBtn.className = "phil-btn phil-btn-secondary";
      cancelBtn.type = "button";
      cancelBtn.textContent = "Cancel";
      cancelBtn.addEventListener("click", () => { resolve(null); destroy(); });

      const goBtn = document.createElement("button");
      goBtn.className = "phil-btn phil-btn-primary";
      goBtn.type = "button";
      goBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Generate`;
      goBtn.addEventListener("click", () => { resolve({ text: textarea.value.trim(), fillType: selectedLength }); destroy(); });

      footer.appendChild(cancelBtn);
      footer.appendChild(goBtn);

      // ── Keyboard shortcuts ────────────────────────────────────────────────
      box.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { resolve(null); destroy(); }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { resolve({ text: textarea.value.trim(), fillType: selectedLength }); destroy(); }
      });

      // ── Assemble ──────────────────────────────────────────────────────────
      box.appendChild(header);
      box.appendChild(desc);
      box.appendChild(picker);
      box.appendChild(inputWrap);
      box.appendChild(footer);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);
      modalEl = backdrop;

      requestAnimationFrame(() => textarea.focus());
    });
  }

  return { show, showError, showContextInput, destroy };
})();

window.PhilModal = PhilModal;
