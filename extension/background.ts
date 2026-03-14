import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';

const SESSION_KEY = 'ai-learning-copilot-session';
const THEME_KEY = 'ai-learning-copilot-theme';
const HISTORY_KEY = 'ai-learning-copilot-history';
const REFRESH_ALARM = 'refresh-supabase-session';

type HistoryEntry = {
  id: string;
  title: string;
  url: string;
  explanation: string;
  createdAt: string;
};

type MessageRequest =
  | { type: 'get-session' }
  | { type: 'set-session'; session: Session }
  | { type: 'clear-session' }
  | { type: 'refresh-session' }
  | { type: 'get-theme' }
  | { type: 'set-theme'; theme: 'light' | 'dark' }
  | { type: 'get-history' }
  | { type: 'save-history'; item: HistoryEntry }
  | { type: 'clear-history' };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

async function getStoredSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return (stored[SESSION_KEY] as Session | undefined) ?? null;
}

async function setStoredSession(session: Session | null) {
  if (!session) {
    await chrome.storage.local.remove(SESSION_KEY);
    return null;
  }

  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function refreshSession() {
  if (!supabase) return null;

  const session = await getStoredSession();
  if (!session?.refresh_token) {
    return null;
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: session.refresh_token
  });

  if (error || !data.session) {
    await setStoredSession(null);
    return null;
  }

  await setStoredSession(data.session);
  return data.session;
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.alarms.create(REFRESH_ALARM, { periodInMinutes: 20 });
  const stored = await chrome.storage.local.get([THEME_KEY, HISTORY_KEY]);

  if (!stored[THEME_KEY]) {
    await chrome.storage.local.set({ [THEME_KEY]: 'dark' });
  }

  if (!stored[HISTORY_KEY]) {
    await chrome.storage.local.set({ [HISTORY_KEY]: [] });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    await refreshSession();
  }
});

const ALLOWED_MESSAGE_TYPES = new Set<MessageRequest['type']>([
  'get-session', 'set-session', 'clear-session', 'refresh-session',
  'get-theme', 'set-theme', 'get-history', 'save-history', 'clear-history'
]);

chrome.runtime.onMessage.addListener((message: MessageRequest, sender, sendResponse) => {
  // Only accept messages from this extension
  if (sender.id !== chrome.runtime.id) return;
  if (!message || typeof message.type !== 'string' || !ALLOWED_MESSAGE_TYPES.has(message.type)) return;
  void (async () => {
    switch (message.type) {
      case 'get-session': {
        const session = await getStoredSession();
        sendResponse({ session });
        break;
      }

      case 'set-session': {
        const session = await setStoredSession(message.session);
        sendResponse({ session });
        break;
      }

      case 'clear-session': {
        await setStoredSession(null);
        sendResponse({ ok: true });
        break;
      }

      case 'refresh-session': {
        const session = await refreshSession();
        sendResponse({ session });
        break;
      }

      case 'get-theme': {
        const stored = await chrome.storage.local.get(THEME_KEY);
        sendResponse({ theme: (stored[THEME_KEY] as 'light' | 'dark' | undefined) ?? 'dark' });
        break;
      }

      case 'set-theme': {
        await chrome.storage.local.set({ [THEME_KEY]: message.theme });
        sendResponse({ theme: message.theme });
        break;
      }

      case 'get-history': {
        const stored = await chrome.storage.local.get(HISTORY_KEY);
        sendResponse({ history: (stored[HISTORY_KEY] as HistoryEntry[] | undefined) ?? [] });
        break;
      }

      case 'save-history': {
        const stored = await chrome.storage.local.get(HISTORY_KEY);
        const history = ((stored[HISTORY_KEY] as HistoryEntry[] | undefined) ?? []).slice(0, 24);
        const deduped = history.filter((item) => item.id !== message.item.id);
        deduped.unshift(message.item);
        await chrome.storage.local.set({ [HISTORY_KEY]: deduped.slice(0, 25) });
        sendResponse({ history: deduped.slice(0, 25) });
        break;
      }

      case 'clear-history': {
        await chrome.storage.local.set({ [HISTORY_KEY]: [] });
        sendResponse({ ok: true });
        break;
      }
    }
  })();

  return true;
});