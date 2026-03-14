# Minimal AI Learning Copilot (no-build)

This minimal folder contains a 5-file Chrome extension you can load immediately without building or Node.js. It demonstrates page extraction and a simple local history.

Files:

- `manifest.json` — extension manifest (MV3)
- `popup.html` — popup UI
- `popup.js` — popup logic (requests extraction, optionally calls API)
- `content.js` — content script that extracts page text, headings, and code
- `background.js` — minimal service worker for history

How to load:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select this folder: `extension/minimal`
4. Open a web page (GitHub, StackOverflow) and click the extension icon

API integration (optional):

- To call your backend explain endpoint, edit `popup.js` and set `API_URL` to your deployed backend base (no `/api` suffix). The popup sends a POST to `${API_URL}/explain` with `{ content, userId }`.

Testing notes:

- The minimal extension uses only browser APIs and `chrome.storage.local` for history. It does not require npm or any build step.
- This is ideal for quickly verifying content extraction and the popup flow before wiring the full React/Tailwind build.
