/**
 * service_worker.js – Background Service Worker (Manifest V3)
 *
 * Architecture:
 * ┌─────────────────────────────────────────────────────────┐
 * │                  PhilAI Extension                       │
 * │                                                         │
 * │  ┌──────────┐   messages   ┌──────────────────────────┐ │
 * │  │  Popup   │ ◄──────────► │  Background SW           │ │
 * │  │ (React-  │              │  - Gemini API proxy      │ │
 * │  │  like)   │              │  - Storage management    │ │
 * │  └──────────┘              └────────────┬─────────────┘ │
 * │                                         │ messages      │
 * │  ┌──────────────────────────────────────▼─────────────┐ │
 * │  │  Content Script (injected into every page)         │ │
 * │  │  - detector.js   → finds form fields               │ │
 * │  │  - ui_injector.js → places ✨ AI Fill buttons      │ │
 * │  │  - modal.js      → editable preview modal          │ │
 * │  │  - content_main.js → orchestrates everything       │ │
 * │  └────────────────────────────────────────────────────┘ │
 * └─────────────────────────────────────────────────────────┘
 *
 * Data flows:
 *  1. User saves profile in Popup → chrome.storage.local
 *  2. Content script clicks "AI Fill" → message to BG SW
 *  3. BG SW reads profile + API key → calls Gemini API → returns answer
 *  4. Content script shows answer in modal → user edits → fills field
 */

// Toggle sidebar when user clicks the extension icon
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_SIDEBAR" });
  } catch {
    // Content script not available on this page (e.g. chrome:// URLs)
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GENERATE_ANSWER") {
    handleGenerateAnswer(message.payload)
      .then((answer) => sendResponse({ success: true, answer }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }

  if (message.type === "FILL_ALL_FIELDS") {
    handleFillAll(message.payload)
      .then((answers) => sendResponse({ success: true, answers }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

/**
 * Generates an AI answer for a single field.
 * @param {{ fieldContext: object, profile: object }} payload
 */
async function handleGenerateAnswer({ fieldContext, profile, fillType = "short", extraContext = null }) {
  const settings = await chrome.storage.local.get(["apiKey", "aiModel", "llmProvider", "ollamaUrl", "ollamaModel"]);
  const provider = settings.llmProvider || "gemini";

  const prompt = buildPrompt(fieldContext, profile, false, fillType, extraContext);

  if (provider === "ollama") {
    const ollamaUrl   = settings.ollamaUrl   || "http://localhost:11434/api/chat";
    const ollamaModel = settings.ollamaModel || "llama3.2:1b";
    return await callOllama(ollamaUrl, ollamaModel, prompt);
  }

  // Default: Gemini
  if (!settings.apiKey) throw new Error("No Gemini API key set. Open the PhilAI sidebar → Settings.");
  return await callGemini(settings.apiKey, settings.aiModel, prompt, fillType);
}

/**
 * Generates AI answers for multiple fields at once.
 * @param {{ fields: object[], profile: object }} payload
 */
async function handleFillAll({ fields, profile }) {
  const settings = await chrome.storage.local.get(["apiKey", "aiModel", "llmProvider", "ollamaUrl", "ollamaModel"]);
  const provider     = settings.llmProvider || "gemini";
  const ollamaUrl    = settings.ollamaUrl   || "http://localhost:11434/api/chat";
  const ollamaModel  = settings.ollamaModel || "llama3.2:1b";

  if (provider === "gemini" && !settings.apiKey) {
    throw new Error("No Gemini API key set. Open the PhilAI sidebar → Settings.");
  }

  const answers = {};
  // Sequential calls to respect rate limits
  for (const field of fields) {
    try {
      const prompt = buildPrompt(field, profile, false, "medium", null);
      if (provider === "ollama") {
        answers[field.id] = await callOllama(ollamaUrl, ollamaModel, prompt);
      } else {
        answers[field.id] = await callGemini(settings.apiKey, settings.aiModel, prompt, "medium");
      }
    } catch (e) {
      answers[field.id] = null;
    }
  }
  return answers;
}

/**
 * Constructs a Gemini prompt from field context + user profile.
 * @param {object}      fieldContext
 * @param {object}      profile
 * @param {boolean}     isBatch
 * @param {string}      fillType     – 'crisp' | 'short' | 'medium' | 'long'
 * @param {string|null} extraContext – additional user-provided context
 */
function buildPrompt(fieldContext, profile, isBatch, fillType = "short", extraContext = null) {
  const {
    label = "",
    placeholder = "",
    fieldType = "text",
    surroundingText = "",
    pageTitle = "",
  } = fieldContext;

  const LENGTH_INSTRUCTIONS = {
    crisp:  "Return ONLY the exact raw value — a name, email address, phone number, URL, or a single word/phrase. No sentences. No explanation. Just the bare value itself.",
    short:  "Write a concise answer of 1–2 sentences maximum. Be direct and professional.",
    medium: "Write a clear, informative answer of 3–4 sentences. Be professional and specific.",
    long:   "Write a well-structured, detailed paragraph of 5–7 sentences. Be thorough, specific, and professional.",
  };

  const lengthInstruction = LENGTH_INSTRUCTIONS[fillType] || LENGTH_INSTRUCTIONS.short;

  const profileBlock = buildProfileBlock(profile);

  const contextBlock = extraContext
    ? `\n--- ADDITIONAL USER CONTEXT ---\n${extraContext}\n--- END ADDITIONAL CONTEXT ---\n`
    : "";

  return `You are an AI assistant helping a job applicant fill out a job application form.
You must answer ONLY based on the applicant's profile data below. 
Do NOT invent, exaggerate, or hallucinate any experience or skills not present in the profile.
Use a professional, confident, and human tone.

--- APPLICANT PROFILE ---
${profileBlock}
--- END PROFILE ---

--- FORM FIELD CONTEXT ---
Page / Job Title: ${pageTitle}
Field Label: ${label}
Field Placeholder: ${placeholder}
Nearby text on page: ${surroundingText}
--- END CONTEXT ---
${contextBlock}
INSTRUCTIONS:
${lengthInstruction}
Answer in first person (e.g., "I have..." not "The applicant has...").
Return ONLY the answer text, no explanations, no quotes.

Answer:`;
}

/**
 * Serialises the user profile object into a readable text block for the prompt.
 */
function buildProfileBlock(profile = {}) {
  const sections = [];

  if (profile.name)        sections.push(`Full Name: ${profile.name}`);
  if (profile.email)       sections.push(`Email: ${profile.email}`);
  if (profile.phone)       sections.push(`Phone: ${profile.phone}`);
  if (profile.location)    sections.push(`Location: ${profile.location}`);
  if (profile.shortBio)    sections.push(`Short Bio:\n${profile.shortBio}`);
  if (profile.longBio)     sections.push(`Long Bio / Summary:\n${profile.longBio}`);
  if (profile.skills)      sections.push(`Skills:\n${profile.skills}`);
  if (profile.experience)  sections.push(`Experience Summary:\n${profile.experience}`);
  if (profile.education)   sections.push(`Education:\n${profile.education}`);
  if (profile.resumeText)  sections.push(`Full Resume Text:\n${profile.resumeText}`);
  if (profile.linkedin)    sections.push(`LinkedIn: ${profile.linkedin}`);
  if (profile.github)      sections.push(`GitHub: ${profile.github}`);
  if (profile.portfolio)   sections.push(`Portfolio: ${profile.portfolio}`);
  if (profile.otherLinks)  sections.push(`Other Links:\n${profile.otherLinks}`);

  return sections.join("\n\n") || "No profile data provided.";
}

/**
 * Calls a local Ollama instance via the /api/chat endpoint.
 * @param {string} url   – full URL, e.g. "http://localhost:11434/api/chat"
 * @param {string} model – e.g. "llama3.2:1b"
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function callOllama(url, model, prompt) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: { temperature: 0.4 },
      }),
    });
  } catch (err) {
    throw new Error(`Could not reach Ollama at ${url}. Make sure Ollama is running and OLLAMA_ORIGINS=* is set. (${err.message})`);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Ollama error ${response.status}: ${body || "unknown error"}`);
  }

  const data = await response.json();
  const text = data?.message?.content?.trim();
  if (!text) throw new Error("Ollama returned an empty response. Please try again.");
  return text;
}

/**
 * Calls the Google Gemini generateContent API.
 * Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *
 * @param {string} apiKey   – Google AI Studio API key
 * @param {string} model    – e.g. "gemini-2.0-flash" (default)
 * @param {string} prompt   – full prompt string
 * @param {string} fillType – controls maxOutputTokens budget
 * @returns {Promise<string>}
 */
async function callGemini(apiKey, model, prompt, fillType = "short") {
  const selectedModel = model || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT",        threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH",       threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error ${response.status}`;
    throw new Error(msg);
  }

  const data = await response.json();
  // Response shape: data.candidates[0].content.parts[0].text
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("Gemini returned an empty response. Please try again.");
  return text;
}
