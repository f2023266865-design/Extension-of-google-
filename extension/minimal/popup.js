// Minimal popup script: requests content extraction from the active tab
const API_URL = ''; // optional: set to https://your-vercel-app.vercel.app/api to call /explain

const el = id => document.getElementById(id);
const status = el('status');
const output = el('output');
const explainBtn = el('explainBtn');
const historyBtn = el('historyBtn');

function setStatus(t){ status.textContent = t; }

/** Inject content script on-demand before messaging */
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (_) {
    // Already injected or restricted page — proceed anyway
  }
}

explainBtn.addEventListener('click', async () => {
  setStatus('Requesting page content...');
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      setStatus('Error');
      output.textContent = 'No active tab found.';
      return;
    }

    // Inject content script on demand (since manifest no longer auto-injects)
    await ensureContentScript(tab.id);

    const extracted = await chrome.tabs.sendMessage(tab.id, { type: 'extract_content' });
    if (!extracted?.content) {
      output.textContent = 'No readable content found on this page.';
      setStatus('Done');
      return;
    }

    // show preview immediately
    output.textContent = `Title: ${extracted.title}\nURL: ${extracted.url}\n\nPreview:\n${extracted.content.slice(0,800)}...`;

    // Save to history
    chrome.storage.local.get('minimal_history', (res) => {
      const history = res.minimal_history || [];
      history.unshift({
        title: extracted.title,
        url: extracted.url,
        explanation: extracted.content,
        createdAt: new Date().toISOString()
      });
      chrome.storage.local.set({ minimal_history: history.slice(0, 25) });
    });

    if (API_URL) {
      setStatus('Calling explain API...');
      const resp = await fetch(`${API_URL}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: extracted.content.slice(0, 8000) })
      });

      if (!resp.ok) {
        output.textContent = 'Could not get explanation. Please try again later.';
      } else {
        const json = await resp.json();
        output.textContent = json.explanation || 'No explanation returned.';
      }
      setStatus('Done');
    } else {
      setStatus('No API configured — local preview shown');
    }
  } catch (err) {
    setStatus('Error');
    output.textContent = 'Something went wrong. Please try again.';
  }
});

historyBtn.addEventListener('click', async () => {
  try {
    const data = await chrome.storage.local.get('minimal_history');
    const list = data.minimal_history || [];
    if (!list.length) {
      output.textContent = 'No history saved.';
      return;
    }
    output.textContent = list.map((h) => {
      const title = (h.title || 'Untitled').slice(0, 100);
      const url = (h.url || '').slice(0, 200);
      const preview = (h.explanation || '').slice(0, 200);
      return `${title} — ${url}\n${preview}...`;
    }).join('\n\n');
  } catch (_) {
    output.textContent = 'Could not load history.';
  }
});
