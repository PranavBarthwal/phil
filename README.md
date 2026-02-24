# PhilAI – AI Job Form Filler

> Automatically fill job application forms using your personal professional data and AI. Works on any website — Google Forms, Lever, Greenhouse, Workday, Ashby, custom career pages, and more.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Setup and Installation](#setup-and-installation)
- [AI Provider Setup](#ai-provider-setup)
- [Loading the Extension](#loading-the-extension)
- [Usage Guide](#usage-guide)
- [Privacy and Security](#privacy-and-security)
- [File Structure](#file-structure)

---

## Features

| Feature | Status |
|---|---|
| In-page sidebar (no popup) | Done |
| Personal profile store (local, browser only) | Done |
| Detect text inputs, textareas, selects, radio buttons | Done |
| Google Forms support | Done |
| Per-field AI fill trigger with hover popout | Done |
| Five fill modes: Crisp, Short, Medium, Long, Add Context | Done |
| Voice input (speech-to-text) for context | Done |
| Length picker inside context modal | Done |
| Editable preview modal before inserting | Done |
| Fill All Fields from sidebar | Done |
| Google Gemini API integration | Done |
| Ollama local LLM support | Done |
| Injection on/off toggle | Done |
| Works with React / Vue / Angular controlled inputs | Done |
| Dynamic form re-scan (SPA support) | Done |
| Export / Import profile as JSON | Done |
| API key stored securely in local storage | Done |

---

## Architecture

```
+-----------------------------------------------------------------------+
|                           PhilAI Extension                            |
|                                                                       |
|  chrome.storage.local                                                 |
|  +---------------------------+     +-----------------------------+    |
|  |  profile {}               |     |  Background Service Worker  |    |
|  |  apiKey                   |     |  background/service_worker  |    |
|  |  aiModel                  |     |  . AI API proxy             |    |
|  |  llmProvider              |     |  . Prompt builder           |    |
|  |  ollamaUrl                |     |  . Gemini + Ollama routing  |    |
|  |  ollamaModel              |     +-------------+---------------+    |
|  |  injectionEnabled         |                   | messages           |
|  +---------------------------+     +-------------v---------------+    |
|                                    |  Content Scripts            |    |
|                                    |  (injected on every page)   |    |
|                                    |                             |    |
|                                    |  detector.js               |    |
|                                    |    finds all form fields    |    |
|                                    |                             |    |
|                                    |  ui_injector.js            |    |
|                                    |    hover popout per field   |    |
|                                    |                             |    |
|                                    |  modal.js                  |    |
|                                    |    preview, edit, confirm  |    |
|                                    |    context input + voice   |    |
|                                    |                             |    |
|                                    |  sidebar.js / sidebar.css  |    |
|                                    |    profile editor          |    |
|                                    |    AI provider config      |    |
|                                    |    injection toggle        |    |
|                                    |    fill all trigger        |    |
|                                    |                             |    |
|                                    |  content_main.js           |    |
|                                    |    orchestrates everything  |    |
|                                    +-----------------------------+    |
+-----------------------------------------------------------------------+

Data Flow (single field):
  1. User fills profile in sidebar -> saved to chrome.storage.local
  2. User hovers the bolt icon next to a field -> selects fill mode
  3. content_main.js sends { fieldContext, profile, fillType } to BG SW
  4. BG SW builds prompt -> calls Gemini API or local Ollama
  5. Answer returned -> modal.js shows editable preview
  6. User confirms -> field filled via native event dispatch
```

---

## Setup and Installation

### Prerequisites

- Google Chrome or any Chromium-based browser
- One of the following AI backends:
  - **Gemini API** (free tier available) — [get a key at Google AI Studio](https://aistudio.google.com/app/apikey)
  - **Ollama** running locally with any pulled model (e.g. `llama3.2:1b`)
- Node.js (only needed if regenerating icons)

### Steps

1. Clone or download this repository:
   ```
   git clone https://github.com/PranavBarthwal/phil.git
   cd phil
   ```

2. Icons are pre-generated. To regenerate them:
   ```
   node scripts/generate_icons_svg.js
   ```

3. Load the extension in Chrome — see [Loading the Extension](#loading-the-extension) below.

---

## AI Provider Setup

### Option A — Google Gemini (cloud)

1. Get a free API key at [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Open the PhilAI sidebar (click the extension icon).
3. Go to the **Settings** tab.
4. Make sure **Gemini** is selected in the AI Provider toggle.
5. Paste your API key into the **Gemini API Key** field.
6. Choose a model. Gemini 2.5 Flash is recommended for the free tier.
7. Click **Save**.

Your key is stored only in `chrome.storage.local` and sent exclusively to Google's API.

### Option B — Ollama (local, fully offline)

1. Install Ollama from [ollama.com](https://ollama.com).
2. Pull a model:
   ```
   ollama pull llama3.2:1b
   ```
3. Start Ollama with browser CORS allowed:
   ```
   # Windows PowerShell
   $env:OLLAMA_ORIGINS="*"
   ollama serve
   ```
   To set this permanently:
   ```
   [System.Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
   ```
   Then restart Ollama.
4. Open the PhilAI sidebar, go to **Settings**, select **Ollama (Local)**.
5. Set the URL to `http://localhost:11434/api/chat` and model name to `llama3.2:1b` (or whichever model you pulled).
6. Click **Save**.

---

## Loading the Extension

1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the root folder of this project (the folder containing `manifest.json`).
5. The PhilAI extension will appear in your extensions list.
6. Pin it to your toolbar: click the puzzle-piece icon in the Chrome toolbar, then pin PhilAI.

After any code change, go to `chrome://extensions` and click the refresh button on the PhilAI card.

---

## Usage Guide

### 1. Fill In Your Profile

Click the extension icon to open the sidebar. Fill in your details across the four tabs:

| Tab | What to add |
|---|---|
| Profile | Name, email, phone, location, short bio, long bio, skills, experience, education |
| Links | LinkedIn, GitHub, portfolio, other links |
| Resume | Paste your full resume as plain text |
| Settings | AI provider, API key or Ollama config, model preference |

The sidebar auto-saves as you type, or click **Save** manually.

### 2. Injection Toggle

The header of the sidebar has an **ON / OFF** toggle. When set to OFF, all bolt trigger icons are removed from the page and no new ones are injected. Flip it back ON to re-enable injection. The state persists across page loads.

### 3. Per-Field Fill

Each detected form field gets a small bolt icon on the right edge.

- **Hover** the bolt icon to reveal the fill mode popout.
- Choose a mode:

| Mode | Output |
|---|---|
| Crisp | Exact raw value — name, email, URL, single word |
| Short | 1–2 sentence answer |
| Medium | 3–4 sentence answer |
| Long | Detailed 5–7 sentence paragraph |
| Add Context | Opens a modal where you can type or speak additional context, then choose a length |

- A preview modal appears with the generated answer.
- Edit if needed, then click **Insert Answer** to fill the field.

### 4. Fill All Fields

Click **Fill All** in the sidebar footer. The extension detects every fillable field on the page and fills them in sequence using medium-length answers. A toast notification reports how many fields were filled.

### 5. Context Input and Voice

When you select **Add Context**, a modal opens with:
- A textarea to type extra context (e.g. "focus on my leadership experience")
- A mic button for voice input via Web Speech API
- A length picker (Crisp / Short / Medium / Long) defaulting to Medium

Press **Generate** or Ctrl+Enter to submit. Press Escape to cancel.

---

## Privacy and Security

- All profile data is stored in `chrome.storage.local` — accessible only by the extension, never synced to Google servers.
- Gemini API calls are made directly from your browser to Google. No proxy, no third-party server.
- Ollama calls are made entirely on your local machine. Nothing leaves your device.
- Form data is never persisted — answers are generated in real time and discarded.
- No analytics, no telemetry, no external tracking of any kind.

---

## File Structure

```
phil/
├── manifest.json                  # Chrome Extension Manifest V3
├── background/
│   └── service_worker.js          # AI API proxy, prompt builder, Gemini + Ollama routing
├── content/
│   ├── detector.js                # Form field detection engine
│   ├── ui_injector.js             # Bolt trigger icon and hover popout injection
│   ├── modal.js                   # Preview modal, error modal, context input modal
│   ├── content_main.js            # Orchestrator and entry point
│   ├── content_styles.css         # Injected UI styles (triggers, popout, modals, toast)
│   ├── sidebar.js                 # In-page sidebar (profile editor, settings, fill all)
│   └── sidebar.css                # Sidebar styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   └── generate_icons_svg.js      # Icon generator (Node.js, no external dependencies)
└── README.md
```

---

## License

MIT License — free to use, modify, and distribute.


> Fill job application forms intelligently using your personal professional data and OpenAI. Works on **any website** – Google Forms, Lever, Greenhouse, Workday, custom career pages, and more.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Setup & Installation](#-setup--installation)
- [How to Add Your OpenAI API Key](#-how-to-add-your-openai-api-key)
- [How to Load the Unpacked Extension](#-how-to-load-the-unpacked-extension)
- [Usage Guide](#-usage-guide)
- [Privacy & Security](#-privacy--security)
- [File Structure](#-file-structure)
- [Future Roadmap](#-future-roadmap)

---

## ✅ Features

| Feature | Status |
|---|---|
| Personal data store (local, browser) | ✅ |
| Detect text inputs, textareas, selects, radio buttons | ✅ |
| Google Forms support | ✅ |
| "✨ AI Fill" button per field | ✅ |
| Editable preview modal before inserting | ✅ |
| "⚡ Fill All Fields" button in popup | ✅ |
| OpenAI GPT integration | ✅ |
| Works with React/Vue/Angular controlled inputs | ✅ |
| Dynamic form re-scan (SPA support) | ✅ |
| Export / Import profile as JSON | ✅ |
| API key stored securely in local storage | ✅ |

---

## 🏗 Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        PhilAI Extension                            │
│                                                                    │
│  ┌──────────────────────┐    messages    ┌──────────────────────┐  │
│  │  Popup UI            │ ◄────────────► │  Background SW       │  │
│  │  popup/popup.html    │                │  background/         │  │
│  │  popup/popup.js      │                │  service_worker.js   │  │
│  │  popup/popup_        │                │                      │  │
│  │  styles.css          │                │  - Gemini API proxy  │  │
│  │                      │                │  - Prompt builder    │  │
│  │  Tabs:               │                │  - Storage helper    │  │
│  │  • Profile           │                └──────────┬───────────┘  │
│  │  • Links             │                           │ messages     │
│  │  • Resume            │                ┌──────────▼───────────┐  │
│  │  • Settings          │                │  Content Scripts     │  │
│  └──────────────────────┘                │  (injected on page)  │  │
│                                          │                      │  │
│  chrome.storage.local                    │  detector.js         │  │
│  ┌──────────────────┐                    │  → finds all fields  │  │
│  │  profile {}      │                    │                      │  │
│  │  apiKey          │                    │  ui_injector.js      │  │
│  │  aiModel         │                    │  → ✨ buttons        │  │
│  └──────────────────┘                    │                      │  │
│                                          │  modal.js            │  │
│                                          │  → preview & edit    │  │
│                                          │                      │  │
│                                          │  content_main.js     │  │
│                                          │  → orchestrates all  │  │
│                                          └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘

Data Flow:
  1. User fills profile in Popup → saved to chrome.storage.local
  2. User clicks "✨ AI Fill" on a form field
  3. content_main.js sends { fieldContext, profile } to Background SW
  4. Background SW builds prompt → calls OpenAI API
  5. Answer returned → modal.js shows editable preview
  6. User confirms → field filled with native event dispatch
```

---

## 🚀 Setup & Installation

### Prerequisites

- Google Chrome (or Chromium-based browser)
- A **Google Gemini API key** ([get one free at Google AI Studio](https://aistudio.google.com/app/apikey))
- Node.js (only needed if you want to regenerate icons)

### Steps

1. **Download / clone this repository**
   ```
   git clone https://github.com/yourname/philai-extension.git
   cd philai-extension
   ```

2. **Generate icons** (already done – skip if `icons/` folder has PNG files)
   ```
   node scripts/generate_icons_svg.js
   ```

3. **Load the extension in Chrome** → see next section ↓

---

## 🔑 How to Add Your Gemini API Key

1. Click the **PhilAI extension icon** in your Chrome toolbar.
2. Go to the **⚙️ Settings** tab.
3. Paste your Gemini API key into the **"Gemini API Key"** field (starts with `AIza…`).
4. It's saved automatically (only in your browser's local storage).

> Get a **free** Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey) — no credit card required for the free tier.

> Your API key is **never sent to any server other than Google's Gemini API directly**.  
> It is stored in `chrome.storage.local` — not in cookies, not in any database.

---

## 📦 How to Load the Unpacked Extension

1. Open Chrome and navigate to: `chrome://extensions`
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click **"Load unpacked"**.
4. Select the root folder of this project (the folder containing `manifest.json`).
5. The **PhilAI** extension will appear in your extensions list.
6. Pin it to your toolbar by clicking the puzzle icon 🧩 → pin PhilAI.

> **After any code change**, go to `chrome://extensions` and click the 🔄 refresh button on the PhilAI card.

---

## 📖 Usage Guide

### 1. Fill In Your Profile

Click the extension icon → fill in your details across the tabs:

| Tab | What to add |
|---|---|
| 👤 Profile | Name, email, phone, short bio, long bio, skills, experience, education |
| 🔗 Links | LinkedIn, GitHub, portfolio, other links |
| 📄 Resume | Paste your full resume as plain text |
| ⚙️ Settings | OpenAI API key, model preference |

Click **💾 Save Profile** (or it auto-saves as you type).

### 2. Go to a Job Application Form

Navigate to any job application page – Google Forms, Lever, Greenhouse, company careers page, etc.

### 3. Use "✨ AI Fill" on Individual Fields

- Look for the **✨ AI Fill** button next to each form field.
- Click it → the extension reads the field's label and context, generates an AI answer using your profile data.
- A **preview modal** appears with the generated answer.
- Edit it if needed, then click **✓ Insert Answer**.

### 4. Use "⚡ Fill All Fields" for Speed

- Click the extension icon → **⚡ Fill All Fields**.
- The extension automatically fills every detected field on the page.
- Each field gets a short highlight animation when filled.

---

## 🔒 Privacy & Security

- **All profile data** is stored in `chrome.storage.local` — only accessible by the extension, never synced to Google's servers (unlike `chrome.storage.sync`).
- **OpenAI API calls** are made directly from your browser to OpenAI. No proxy, no logging.
- **Form data is never stored** — answers are generated and inserted in real time.
- **No analytics, no telemetry** of any kind.

---

## 📁 File Structure

```
philai-extension/
├── manifest.json                 # Chrome Extension Manifest V3
├── background/
│   └── service_worker.js         # OpenAI API calls, prompt builder
├── content/
│   ├── detector.js               # Form field detection engine
│   ├── ui_injector.js            # ✨ AI Fill button injection
│   ├── modal.js                  # Editable preview modal
│   ├── content_main.js           # Orchestrator / entry point
│   └── content_styles.css        # All injected UI styles
├── popup/
│   ├── popup.html                # Extension popup UI
│   ├── popup.js                  # Popup logic
│   └── popup_styles.css          # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── scripts/
│   └── generate_icons_svg.js     # Icon generator (Node.js, no deps)
└── README.md
```

---

## 🔮 Future Roadmap

These are designed for but not yet implemented:

- **💾 Saved Answers** – Cache past AI answers per domain for reuse.
- **📚 Learn from Edits** – When you manually edit an AI answer, save the correction to improve future prompts.
- **📊 Application Tracker** – Log which jobs you've applied to (URL, date, company, role).
- **📧 Cold Email Generator** – Use your profile + LinkedIn URL to draft outreach emails.
- **🎨 Custom Personas** – Switch between profiles (e.g., "Engineering role" vs. "Product role").

---

## 🤝 Contributing

PRs welcome! Please open an issue first for major changes.

---

## 📄 License

MIT License – free to use, modify, and distribute.
