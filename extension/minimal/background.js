// Minimal background worker: simple message handlers for history
const ALLOWED_TYPES = new Set(['get-history', 'clear-history']);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Only accept messages from this extension
  if (sender.id !== chrome.runtime.id) return;
  if (!msg || typeof msg.type !== 'string' || !ALLOWED_TYPES.has(msg.type)) return;

  if (msg.type === 'get-history') {
    chrome.storage.local.get('minimal_history', (res) => sendResponse({ history: res.minimal_history || [] }));
    return true;
  }
  if (msg.type === 'clear-history') {
    chrome.storage.local.set({ minimal_history: [] }, () => sendResponse({ ok: true }));
    return true;
  }
});
