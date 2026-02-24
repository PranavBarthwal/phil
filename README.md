# ✨ PhilAI – AI Job Form Filler (Chrome Extension)

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
