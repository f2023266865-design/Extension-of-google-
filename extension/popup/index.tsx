import '../popup/tailwind.css';
import '../popup/styles.css';

import { createClient, type Session } from '@supabase/supabase-js';
import { Sparkles } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

// ─── Types ─────────────────────────────────────────────────────────────────────
type AppScreen = 'welcome' | 'main' | 'history' | 'settings' | 'upgrade' | 'explaining';
type NavTab = 'home' | 'history' | 'tools' | 'profile';
type Provider = 'openai' | 'gemini' | 'anthropic' | 'openrouter';
type ThemeMode = 'light' | 'dark';

type SubscriptionResponse = {
  isPremium: boolean;
  plan: string;
  usesToday: number;
};

type ExtractionResponse = {
  content: string;
  title: string;
  url: string;
};

type HistoryEntry = {
  id: string;
  title: string;
  url: string;
  explanation: string;
  createdAt: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────
const apiBaseUrl = import.meta.env.VITE_API_URL;

const supabase = (() => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  // Supabase not configured in this build — silently disable popup auth.
  const stub = {
    auth: {
      signInWithOtp: async (_: any) => ({ data: null, error: new Error('Supabase not configured') }),
      verifyOtp: async (_: any) => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: new Error('Supabase not configured') }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  } as unknown as ReturnType<typeof createClient>;

  return stub;
})();

const sendRuntimeMessage = <T,>(message: unknown) =>
  chrome.runtime.sendMessage(message) as Promise<T>;

// ─── API Key Encryption (Web Crypto AES-GCM) ──────────────────────────────────
const CRYPTO_KEY_NAME = 'ai-copilot-crypto-key';

async function getCryptoKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local.get(CRYPTO_KEY_NAME);
  if (stored[CRYPTO_KEY_NAME]) {
    return crypto.subtle.importKey(
      'jwk',
      stored[CRYPTO_KEY_NAME] as JsonWebKey,
      { name: 'AES-GCM' },
      true,
      ['encrypt', 'decrypt']
    );
  }
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exported = await crypto.subtle.exportKey('jwk', key);
  await chrome.storage.local.set({ [CRYPTO_KEY_NAME]: exported });
  return key;
}

async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptApiKey(encrypted: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

// ─── API Key Format Validation ─────────────────────────────────────────────────
const KEY_PATTERNS: Record<Provider, RegExp> = {
  openai: /^sk-[a-zA-Z0-9_-]{20,}$/,
  gemini: /^AIzaSy[a-zA-Z0-9_-]{30,}$/,
  anthropic: /^sk-ant-[a-zA-Z0-9_-]{20,}$/,
  openrouter: /^sk-or-[a-zA-Z0-9_-]{20,}$/,
};

function validateKeyFormat(provider: Provider, key: string): string | null {
  if (!key.trim()) return 'Please enter an API key first.';
  if (!KEY_PATTERNS[provider].test(key.trim()))
    return `Invalid ${provider} key format. Check the key and try again.`;
  return null;
}

// ─── Provider Logo SVG Components ─────────────────────────────────────────────
function OpenAILogo() {
  return (
    <svg viewBox="0 0 41 41" className="w-10 h-10" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="OpenAI">
      <path d="M37.532 16.87a9.963 9.963 0 00-.856-8.184 10.078 10.078 0 00-10.855-4.835 9.964 9.964 0 00-7.505-3.348 10.079 10.079 0 00-9.612 6.977 9.967 9.967 0 00-6.664 4.834 10.08 10.08 0 001.24 11.817 9.965 9.965 0 00.856 8.185 10.079 10.079 0 0010.855 4.835 9.965 9.965 0 007.504 3.347 10.078 10.078 0 009.613-6.976 9.967 9.967 0 006.664-4.834 10.079 10.079 0 00-1.24-11.818zM22.498 37.886a7.474 7.474 0 01-4.799-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 00.655-1.134V19.054l3.366 1.944a.12.12 0 01.066.092v9.299a7.505 7.505 0 01-7.49 7.496zM6.392 31.006a7.471 7.471 0 01-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 001.308 0l9.724-5.614v3.888a.12.12 0 01-.048.103L16.35 33.569a7.505 7.505 0 01-9.958-2.563zM4.297 13.62A7.469 7.469 0 018.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 00.654 1.132l9.723 5.614-3.366 1.944a.12.12 0 01-.114.012L7.044 23.86a7.504 7.504 0 01-2.747-10.24zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 01.114-.012l8.048 4.648a7.498 7.498 0 01-1.158 13.528v-9.476a1.293 1.293 0 00-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 00-1.308 0l-9.723 5.614v-3.888a.12.12 0 01.048-.103l8.034-4.637a7.498 7.498 0 0111.15 7.755zm-21.063 6.929l-3.367-1.944a.12.12 0 01-.065-.092v-9.299a7.497 7.497 0 0112.293-5.756 6.94 6.94 0 00-.236.134l-7.965 4.6a1.294 1.294 0 00-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.5v4.993l-4.331 2.5-4.331-2.5V18z" />
    </svg>
  );
}

function GeminiLogo() {
  return (
    <svg viewBox="0 0 32 32" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" aria-label="Google Gemini">
      <defs>
        <linearGradient id="gem-g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="40%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
      </defs>
      <path d="M16 2C8.268 2 2 8.268 2 16s6.268 14 14 14 14-6.268 14-14S23.732 2 16 2zm0 5l5.5 9.5h-11L16 7zm0 17a8 8 0 01-6.928-4h13.856A8 8 0 0116 24z" fill="url(#gem-g)" />
    </svg>
  );
}

function AnthropicLogo() {
  return (
    <svg viewBox="0 0 120 88" className="w-9 h-7" xmlns="http://www.w3.org/2000/svg" aria-label="Anthropic">
      <path d="M83.27 0H62.1l31.63 88h21.18L83.27 0zM22.9 0 0 88h21.14l4.47-13.24h40.55L70.63 88H91.8L68.87 0H22.9zm9.84 58.43L46.6 18.77l13.59 39.66H32.74z" fill="#D4A574" />
    </svg>
  );
}

function OpenRouterLogo() {
  return (
    <svg viewBox="0 0 24 24" className="w-10 h-10" xmlns="http://www.w3.org/2000/svg" fill="none" aria-label="OpenRouter">
      <circle cx="5" cy="12" r="2.5" fill="#a78bfa" />
      <circle cx="19" cy="6" r="2.5" fill="#7c3aed" />
      <circle cx="19" cy="18" r="2.5" fill="#7c3aed" />
      <path d="M7.5 12h5M14 6h-4a2 2 0 00-2 2v2.5M14 18h-4a2 2 0 01-2-2V13.5" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Provider Config ───────────────────────────────────────────────────────────
interface ProviderConfig {
  id: Provider;
  name: string;
  line1: string;
  line2: string;
  accentOnActive: boolean;
  logoBg: string;
  logo: React.ReactNode;
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    line1: 'GPT-4o mini',
    line2: '$0.15/1M',
    accentOnActive: true,
    logoBg: 'bg-black/70',
    logo: <OpenAILogo />,
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    line1: 'Free tier',
    line2: 'Rate limited',
    accentOnActive: false,
    logoBg: 'bg-slate-800',
    logo: <GeminiLogo />,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    line1: 'Claude',
    line2: '$0.25/1M',
    accentOnActive: false,
    logoBg: 'bg-[#1c2a2a]',
    logo: <AnthropicLogo />,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    line1: 'Multi-model',
    line2: 'Aggregator',
    accentOnActive: false,
    logoBg: 'bg-[#160d2e]',
    logo: <OpenRouterLogo />,
  },
];

// ─── Screen 1: Welcome / Connect Provider ─────────────────────────────────────
function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>('openai');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testMessage, setTestMessage] = useState('');

  const placeholder =
    selectedProvider === 'openai'
      ? 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
      : selectedProvider === 'gemini'
        ? 'AIzaSy...'
        : selectedProvider === 'anthropic'
          ? 'sk-ant-...'
          : 'sk-or-...';

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      setApiKey(text.trim());
      setTestResult(null);
    } catch {
      // Clipboard access unavailable — user can type manually
    }
  }

  async function handleTestConnection() {
    const formatError = validateKeyFormat(selectedProvider, apiKey);
    if (formatError) {
      setTestResult('error');
      setTestMessage(formatError);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      let ok = false;
      if (selectedProvider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        ok = res.ok;
      } else if (selectedProvider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hi' }],
          }),
        });
        ok = res.status !== 401 && res.status !== 403;
      } else if (selectedProvider === 'gemini') {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
        );
        ok = res.ok;
      } else {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        ok = res.ok;
      }
      setTestResult(ok ? 'success' : 'error');
      setTestMessage(ok ? 'Connection successful! ✓' : 'Invalid key — please check and try again.');
    } catch {
      setTestResult('error');
      setTestMessage('Connection failed. Check your internet connection.');
    } finally {
      setTesting(false);
    }
  }

  async function handleContinue() {
    const formatError = validateKeyFormat(selectedProvider, apiKey);
    if (formatError) {
      setTestResult('error');
      setTestMessage(formatError);
      return;
    }
    const encrypted = await encryptApiKey(apiKey.trim());
    await chrome.storage.local.set({
      'ai-copilot-api-key': encrypted,
      'ai-copilot-provider': selectedProvider,
    });
    onContinue();
  }

  return (
    <div className="relative flex flex-col w-full h-full bg-[#101122] overflow-hidden select-none">
      {/* Ambient background glows */}
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(91,93,241,0.22)', filter: 'blur(80px)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(120,40,200,0.13)', filter: 'blur(80px)' }}
      />

      {/* Header */}
      <div className="flex items-center px-4 pt-4 pb-0 relative z-10">
        <button
          type="button"
          className="text-slate-400 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <p
          className="flex-1 text-center text-[15px] font-bold"
          style={{
            background: 'linear-gradient(90deg, #5b5df1, #a78bfa)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          AI Learning Copilot
        </p>
        <div className="w-8" aria-hidden="true" />
      </div>

      {/* Welcome heading */}
      <div className="px-6 pt-5 pb-0 text-center relative z-10">
        <h2 className="text-white text-[2rem] font-bold leading-tight tracking-tight">Welcome!</h2>
        <p className="text-slate-400 text-sm mt-1">Connect your AI provider.</p>
      </div>

      {/* Provider cards — horizontal scroll */}
      <div
        className="no-scrollbar flex py-4 px-4 gap-3 snap-x overflow-x-auto relative z-10"
      >
        {PROVIDERS.map((prov) => {
          const active = selectedProvider === prov.id;
          return (
            <button
              key={prov.id}
              type="button"
              onClick={() => {
                setSelectedProvider(prov.id);
                setTestResult(null);
              }}
              className="flex shrink-0 w-[138px] flex-col gap-2.5 p-3 rounded-2xl snap-start cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5df1]"
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                background: active ? 'rgba(91,93,241,0.15)' : 'rgba(25,26,51,0.6)',
                border: active ? '2px solid #5b5df1' : '1px solid rgba(91,93,241,0.2)',
                transition: 'border 0.15s, background 0.15s',
              }}
            >
              <div className={`w-full aspect-square rounded-xl flex items-center justify-center overflow-hidden ${prov.logoBg}`}>
                {prov.logo}
              </div>
              <div className="text-left">
                <p className="text-slate-100 text-sm font-semibold">{prov.name}</p>
                <p
                  className={`text-[10px] font-medium leading-tight mt-0.5 ${
                    active && prov.accentOnActive ? 'text-[#5b5df1]' : 'text-slate-400'
                  }`}
                >
                  {prov.line1}
                  <br />
                  {prov.line2}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* API Key section */}
      <div className="flex flex-col gap-3 px-6 py-2 relative z-10">
        <label className="flex flex-col gap-2">
          <span className="text-slate-300 text-sm font-medium flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] shrink-0" fill="#5b5df1">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
            </svg>
            Secure API Key
          </span>
          <div
            className="flex w-full items-stretch rounded-xl overflow-hidden transition-all focus-within:ring-2 focus-within:ring-[#5b5df1]/40"
            style={{
              background: 'rgba(25,26,51,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(91,93,241,0.2)',
            }}
          >
            <input
              className="flex-1 bg-transparent border-none text-slate-100 placeholder:text-slate-500 text-sm px-4 py-3 focus:outline-none min-w-0"
              placeholder={placeholder}
              type="password"
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setTestResult(null);
              }}
            />
            <button
              type="button"
              onClick={handlePaste}
              className="shrink-0 px-4 flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{
                background: 'rgba(91,93,241,0.2)',
                borderLeft: '1px solid rgba(91,93,241,0.2)',
                color: '#5b5df1',
              }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
                <path d="M19 2h-4.18C14.4.84 13.3 0 12 0c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm7 18H5V4h2v3h10V4h2v16z" />
              </svg>
              <span className="text-xs font-semibold">Paste</span>
            </button>
          </div>
        </label>

        {testResult && (
          <p
            className={`text-xs px-3 py-2 rounded-lg ${
              testResult === 'success'
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-rose-500/15 text-rose-400'
            }`}
          >
            {testMessage}
          </p>
        )}
      </div>

      <div className="flex-grow" />

      {/* Footer actions */}
      <div className="flex flex-col gap-3 px-6 pb-6 relative z-10">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="flex-1 py-3 px-4 rounded-xl text-slate-200 text-sm font-semibold transition-all hover:text-white active:scale-95 disabled:opacity-60"
            style={{
              background: 'rgba(25,26,51,0.6)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(91,93,241,0.2)',
            }}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            className="flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold active:scale-95 transition-all"
            style={{
              background: '#5b5df1',
              boxShadow: '0 8px 24px rgba(91,93,241,0.3)',
            }}
          >
            Continue
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 py-1">
          <svg viewBox="0 0 24 24" className="w-[14px] h-[14px] shrink-0" fill="#10b981">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
          </svg>
          <p className="text-slate-500 text-[11px] font-medium">
            Your key stays{' '}
            <span className="text-slate-300 font-semibold">LOCAL</span> — never sent to servers
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Circular Progress ────────────────────────────────────────────────────────
const CircularProgress = React.memo(function CircularProgress({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex h-20 w-20 items-center justify-center shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="transparent" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="transparent"
          stroke="#5b5df1"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold text-slate-100">{pct}%</span>
    </div>
  );
});

// ─── Screen 2: Main Dashboard ─────────────────────────────────────────────────
function MainScreen({
  session,
  subscription,
  loading,
  error,
  explanation,
  history,
  onExplain,
  onUpgrade,
  onSignOut,
  email,
  setEmail,
  otpCode,
  setOtpCode,
  otpSent,
  authLoading,
  onSendOtp,
  onVerifyOtp,
}: {
  session: import('@supabase/supabase-js').Session | null;
  subscription: SubscriptionResponse;
  loading: boolean;
  error: string | null;
  explanation: string;
  history: HistoryEntry[];
  onExplain: () => void;
  onUpgrade: () => void;
  onSignOut: () => void;
  onNavigate: (screen: AppScreen) => void;
  email: string;
  setEmail: (v: string) => void;
  otpCode: string;
  setOtpCode: (v: string) => void;
  otpSent: boolean;
  authLoading: boolean;
  onSendOtp: () => void;
  onVerifyOtp: () => void;
}) {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const usesLeft = Math.max(0, 5 - subscription.usesToday);
  const usedCount = subscription.isPremium ? subscription.usesToday : subscription.usesToday;
  const maxCount = subscription.isPremium ? Math.max(subscription.usesToday, 1) : 5;

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const userName = session?.user?.email?.split('@')[0] ?? 'there';
  const displayName = userName.charAt(0).toUpperCase() + userName.slice(1);

  return (
    <div className="relative flex h-[600px] w-[400px] flex-col overflow-hidden bg-[#101122]">
      {/* Gradient overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(91,93,241,0.08) 0%, transparent 50%, rgba(91,93,241,0.04) 100%)' }}
      />

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-5 pb-3 relative z-10">
        <div>
          <h1 className="text-[17px] font-bold tracking-tight text-slate-100">
            👋 {greeting}, {displayName}!
          </h1>
          <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-[0.2em] font-semibold">
            AI Learning Copilot
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:text-white transition-colors"
          style={{
            background: 'rgba(16,17,34,0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(91,93,241,0.2)',
          }}
          aria-label="Settings"
          onClick={() => onNavigate('settings')}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
          </svg>
        </button>
      </header>

      {/* Scrollable body */}
      <main className="flex-1 overflow-y-auto px-5 pb-24 relative z-10 no-scrollbar">

        {/* Daily Usage Card */}
        <div
          className="rounded-2xl p-5 mb-5 flex items-center justify-between"
          style={{
            background: 'rgba(16,17,34,0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(91,93,241,0.2)',
          }}
        >
          <div className="flex flex-col">
            <span className="text-sm font-medium text-slate-400">Daily Usage</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-bold text-slate-100">{usedCount}</span>
              <span className="text-lg text-slate-500">/ {subscription.isPremium ? '∞' : maxCount}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="flex h-2 w-2 rounded-full"
                style={{ background: '#5b5df1', boxShadow: '0 0 6px #5b5df1' }}
              />
              <span
                className="text-[10px] font-bold uppercase tracking-tighter px-2 py-0.5 rounded-full"
                style={{
                  color: '#5b5df1',
                  background: 'rgba(91,93,241,0.1)',
                  border: '1px solid rgba(91,93,241,0.2)',
                }}
              >
                {subscription.isPremium ? 'Premium' : 'Free'} Badge
              </span>
            </div>
          </div>
          <CircularProgress value={usedCount} max={subscription.isPremium ? Math.max(usedCount, 1) : 5} />
        </div>

        {/* Auth prompt if not signed in */}
        {!session && (
          <div
            className="rounded-2xl p-4 mb-5 space-y-3"
            style={{
              background: 'rgba(16,17,34,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(91,93,241,0.2)',
            }}
          >
            <div className="flex items-center gap-2 text-slate-300">
              <Sparkles size={15} className="text-[#5b5df1]" />
              <span className="text-sm font-medium">Sign in to track usage</span>
            </div>
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5b5df1]/40"
              placeholder="you@example.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {otpSent && (
              <input
                className="w-full rounded-xl bg-white/5 border border-white/10 text-slate-100 placeholder:text-slate-500 text-sm px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#5b5df1]/40"
                placeholder="6-digit email code"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            )}
            <button
              type="button"
              disabled={authLoading || !email || (otpSent && otpCode.length < 6)}
              onClick={otpSent ? onVerifyOtp : onSendOtp}
              className="w-full py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-60 transition-all active:scale-95"
              style={{ background: '#5b5df1' }}
            >
              {authLoading ? 'Working...' : otpSent ? 'Verify code' : 'Send login code'}
            </button>
          </div>
        )}

        {/* Explain This Page Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={onExplain}
            disabled={loading}
            className="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl p-8 text-white transition-all active:scale-[0.98] disabled:opacity-70"
            style={{
              background: '#5b5df1',
              boxShadow: '0 8px 32px rgba(91,93,241,0.4)',
            }}
          >
            {/* Animated shimmer */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0) 70%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.5s linear infinite',
              }}
            />
            <div className="relative z-10 flex flex-col items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
              >
                {loading ? (
                  <div className="loading-dots">
                    <span style={{ background: 'white' }} />
                    <span style={{ background: 'white' }} />
                    <span style={{ background: 'white' }} />
                  </div>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
                    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 3l1.5 4.5L18 11l-4.5 1.5L12 17l-1.5-4.5L6 11l4.5-1.5L12 5zm-4.5 7.5l1 3 3-1-3 1-1-3z" />
                    <path d="M12 2l2.09 6.26L20 12l-5.91 3.74L12 22l-2.09-6.26L4 12l5.91-3.74L12 2z" />
                  </svg>
                )}
              </div>
              <span className="text-xl font-black tracking-wider uppercase">
                {loading ? 'Explaining...' : 'Explain This Page'}
              </span>
            </div>
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.07] transition-colors" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 rounded-xl bg-rose-500/15 border border-rose-500/20 px-3 py-2 text-xs text-rose-400">
            {error}
          </p>
        )}

        {/* Latest explanation result */}
        {explanation && (
          <div
            className="rounded-2xl p-4 mb-5"
            style={{
              background: 'rgba(16,17,34,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(91,93,241,0.2)',
            }}
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">Latest Explanation</p>
            <article className="text-sm leading-6 text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto no-scrollbar">
              {explanation}
            </article>
          </div>
        )}

        {/* Quick Actions */}
        <div className="mb-6">
          <h2 className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Quick Actions</h2>
          <div className="grid grid-cols-3 gap-3">
            {([
              {
                label: 'Code',
                icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="#5b5df1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                ),
              },
              {
                label: 'Docs',
                icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#5b5df1">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                  </svg>
                ),
              },
              {
                label: 'YT',
                icon: (
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#5b5df1">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                ),
              },
            ] as { label: string; icon: React.ReactNode }[]).map(({ label, icon }) => (
              <button
                key={label}
                type="button"
                className="flex flex-col items-center justify-center rounded-2xl py-5 gap-2 transition-all hover:bg-[#5b5df1]/10 active:scale-95"
                style={{
                  background: 'rgba(16,17,34,0.6)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(91,93,241,0.2)',
                }}
              >
                {icon}
                <span className="text-xs font-semibold text-slate-300">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Upgrade Banner */}
        {!subscription.isPremium && (
          <div
            className="rounded-2xl p-5 mb-2"
            style={{
              background: 'linear-gradient(135deg, rgba(91,93,241,0.25) 0%, rgba(91,93,241,0.05) 100%)',
              border: '1px solid rgba(91,93,241,0.3)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-100 text-sm">Unlimited + History</h3>
                <p className="text-xs text-slate-400 mt-0.5">Unlock the full power for $9/mo</p>
              </div>
              <button
                type="button"
                onClick={onUpgrade}
                disabled={loading}
                className="shrink-0 rounded-xl px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95 disabled:opacity-60"
                style={{ background: '#5b5df1', boxShadow: '0 4px 16px rgba(91,93,241,0.3)' }}
              >
                Upgrade Now
              </button>
            </div>
          </div>
        )}

        {/* History (premium) */}
        {subscription.isPremium && session && history.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-2"
            style={{
              background: 'rgba(16,17,34,0.6)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(91,93,241,0.2)',
            }}
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-semibold">History</p>
            <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left rounded-xl px-3 py-2 hover:bg-white/5 transition-colors"
                >
                  <p className="text-sm font-medium text-slate-200 truncate">{item.title}</p>
                  <p className="text-[11px] text-slate-500">{new URL(item.url).hostname}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        className="absolute bottom-0 left-0 right-0 z-20 flex h-[68px] items-center justify-around border-t px-2"
        style={{
          background: 'rgba(16,17,34,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.07)',
        }}
      >
        {([
          {
            tab: 'home' as NavTab,
            label: 'Home',
            icon: (
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
            ),
          },
          {
            tab: 'history' as NavTab,
            label: 'History',
            icon: (
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            ),
          },
          {
            tab: 'tools' as NavTab,
            label: 'Tools',
            icon: (
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            ),
          },
          {
            tab: 'profile' as NavTab,
            label: 'Profile',
            icon: (
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            ),
          },
        ]).map(({ tab, label, icon }) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                if (tab === 'history') { onNavigate('history'); return; }
                setActiveTab(tab);
              }}
              className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors"
              style={{ color: active ? '#5b5df1' : 'rgba(148,163,184,0.6)' }}
            >
              {icon}
              <span
                className="text-[9px] font-bold uppercase tracking-[0.08em]"
                style={{ color: active ? '#5b5df1' : 'rgba(148,163,184,0.5)' }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Screen 3: Learning History ─────────────────────────────────────────────
function HistoryScreen({
  history,
  subscription,
  onNavigate,
  onUpgrade,
  onClearHistory,
}: {
  history: HistoryEntry[];
  subscription: SubscriptionResponse;
  onNavigate: (screen: AppScreen) => void;
  onUpgrade: () => void;
  onClearHistory: () => void;
}) {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  function formatAge(createdAt: string): string {
    const diffMs = Date.now() - new Date(createdAt).getTime();
    const diffH = Math.floor(diffMs / 3_600_000);
    const diffD = Math.floor(diffMs / 86_400_000);
    if (diffH < 1) return 'Just now';
    if (diffH < 24) return `${diffH} hour${diffH > 1 ? 's' : ''} ago`;
    if (diffD === 1) return 'Yesterday';
    return `${diffD} days ago`;
  }

  function isLocked(item: HistoryEntry): boolean {
    if (subscription.isPremium) return false;
    return Date.now() - new Date(item.createdAt).getTime() > 86_400_000;
  }

  function isCodePage(url: string): boolean {
    return /github\.com|stackoverflow\.com|codepen\.io|codesandbox\.io|replit\.com/.test(url);
  }

  async function handleCopy(item: HistoryEntry) {
    try {
      await navigator.clipboard.writeText(item.explanation);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch { /* silent */ }
  }

  function handleDelete(id: string) {
    setDeletedIds((prev) => new Set(prev).add(id));
  }

  function handleExportAll() {
    const text = history
      .map((h) => `URL: ${h.url}\nTitle: ${h.title}\nDate: ${h.createdAt}\n\n${h.explanation}`)
      .join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'learning-history.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  const visible = history.filter(
    (item) =>
      !deletedIds.has(item.id) &&
      (search === '' ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.url.toLowerCase().includes(search.toLowerCase()) ||
        item.explanation.toLowerCase().includes(search.toLowerCase()))
  );

  // For free users show all unlocked items + up to 2 locked teasers
  const unlocked = visible.filter((i) => !isLocked(i));
  const locked = visible.filter((i) => isLocked(i));
  const displayed = subscription.isPremium ? visible : [...unlocked, ...locked.slice(0, 2)];
  const showPremiumOverlay = !subscription.isPremium && locked.length > 0;

  const glassCard: React.CSSProperties = {
    background: 'rgba(91,93,241,0.05)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(91,93,241,0.15)',
  };

  return (
    <div className="relative flex flex-col h-[600px] w-[400px] bg-[#101122] overflow-hidden">

      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: 'rgba(255,255,255,0.03)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* History / clock-rotate icon */}
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#5b5df1" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 3C8.03 3 4 7.03 4 12H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
          </svg>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">Learning History</h1>
        </div>
        <button
          type="button"
          className="p-2 hover:bg-[#5b5df1]/10 rounded-full transition-colors text-slate-300"
          aria-label="More options"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </header>

      {/* Search */}
      <div
        className="px-4 py-3 flex-shrink-0"
        style={{ background: 'rgba(16,17,34,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
      >
        <div
          className="flex items-center gap-2 rounded-xl h-11 px-4"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className="flex-1 bg-transparent border-none text-slate-100 placeholder:text-slate-500 text-sm focus:outline-none"
            placeholder="Search explanations..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Scrollable list */}
      <main className="flex-1 overflow-y-auto px-4 py-2 space-y-3 no-scrollbar">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-slate-500">
            <svg viewBox="0 0 24 24" className="w-8 h-8 opacity-30" fill="currentColor">
              <path d="M13 3C8.03 3 4 7.03 4 12H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
            </svg>
            <p className="text-xs">No history yet</p>
          </div>
        ) : (
          displayed.map((item) => {
            const itemLocked = isLocked(item);
            const code = isCodePage(item.url);
            let hostname = item.url;
            let pathname = '';
            try {
              const u = new URL(item.url);
              hostname = u.hostname;
              pathname = u.pathname;
            } catch { /* use raw url */ }
            return (
              <div
                key={item.id}
                className={`rounded-xl p-4 flex flex-col gap-3 ${itemLocked ? 'opacity-50' : ''}`}
                style={glassCard}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: itemLocked ? 'rgba(100,116,139,0.8)' : 'rgba(91,93,241,0.8)' }}
                    >
                      {formatAge(item.createdAt)}
                    </span>
                    <h3 className="text-sm font-bold text-slate-100 truncate">
                      {hostname}{pathname !== '/' ? pathname : ''}
                    </h3>
                  </div>
                  {itemLocked ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" fill="currentColor">
                      <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                    </svg>
                  ) : (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(item)}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 transition-colors"
                        title={copiedId === item.id ? 'Copied!' : 'Copy explanation'}
                      >
                        {copiedId === item.id ? (
                          <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <p className={`text-xs line-clamp-2 leading-relaxed ${itemLocked ? 'text-slate-500' : 'text-slate-400'}`}>
                  {item.explanation.slice(0, 120)}{item.explanation.length > 120 ? '...' : ''}
                </p>

                {!itemLocked && (
                  <div className="flex items-center justify-between mt-1">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(91,93,241,0.2)', border: '1px solid #101122' }}
                    >
                      {code ? (
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="#5b5df1" strokeWidth="2" strokeLinecap="round">
                          <polyline points="16 18 22 12 16 6" />
                          <polyline points="8 6 2 12 8 18" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="w-3 h-3" fill="#5b5df1">
                          <path d="M6.5 18H4c-.55 0-1-.45-1-1v-3c0-.55.45-1 1-1h2.5v-2H4c-1.66 0-3 1.34-3 3v3c0 1.66 1.34 3 3 3h2.5v-2zM21 14v3c0 .55-.45 1-1 1h-2.5v2H20c1.66 0 3-1.34 3-3v-3c0-1.66-1.34-3-3-3h-2.5v2H20c.55 0 1 .45 1 1zm-7-8h-2v13h2V6z" />
                        </svg>
                      )}
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:brightness-110 active:scale-95"
                      style={{ background: '#5b5df1' }}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 102.13-5.36L1 10" />
                      </svg>
                      Re-run
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        {/* Spacer so last card isn't hidden behind overlay */}
        {showPremiumOverlay && <div className="h-40" />}
      </main>

      {/* Premium overlay */}
      {showPremiumOverlay && (
        <div className="absolute left-4 right-4 z-30" style={{ bottom: '132px' }}>
          <div
            className="rounded-xl p-5 flex flex-col items-center text-center"
            style={{
              background: 'rgba(16,17,34,0.92)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(91,93,241,0.3)',
              boxShadow: '0 25px 50px rgba(91,93,241,0.2)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: 'rgba(91,93,241,0.2)' }}
            >
              {/* crown / workspace_premium */}
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#5b5df1">
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
              </svg>
            </div>
            <h4 className="text-sm font-bold text-slate-100 mb-1">Premium History</h4>
            <p className="text-[11px] text-slate-400 mb-4 px-2">
              Free users can only see the last 24 hours of history. Unlock unlimited access.
            </p>
            <button
              type="button"
              onClick={onUpgrade}
              className="w-full py-2.5 rounded-lg text-white text-xs font-bold transition-all active:scale-95"
              style={{ background: '#5b5df1', boxShadow: '0 4px 16px rgba(91,93,241,0.4)' }}
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}

      {/* Bottom: Export / Clear + Nav */}
      <div className="flex-shrink-0 relative z-40">
        <div
          className="flex gap-2 px-4 py-3"
          style={{ background: 'rgba(16,17,34,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <button
            type="button"
            onClick={handleExportAll}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-slate-200 transition-colors hover:brightness-110"
            style={{ background: 'rgba(30,41,59,0.8)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export All
          </button>
          <button
            type="button"
            onClick={onClearHistory}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium text-red-400 transition-colors hover:brightness-110"
            style={{ background: 'rgba(239,68,68,0.1)' }}
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm13-15h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
            Clear All
          </button>
        </div>

        <nav
          className="flex justify-around items-center px-4 pb-4 pt-2"
          style={{ background: '#101122', borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* AI Copilot */}
          <button
            type="button"
            onClick={() => onNavigate('main')}
            className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#5b5df1] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <p className="text-[10px] font-medium leading-none">AI Copilot</p>
          </button>
          {/* History (active) */}
          <button type="button" className="flex flex-col items-center gap-1" style={{ color: '#5b5df1' }}>
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M13 3C8.03 3 4 7.03 4 12H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.95-2.05L6.64 18.36C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z" />
            </svg>
            <p className="text-[10px] font-medium leading-none">History</p>
          </button>
          {/* Settings */}
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-slate-500 hover:text-[#5b5df1] transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
            <p className="text-[10px] font-medium leading-none">Settings</p>
          </button>
        </nav>
      </div>
    </div>
  );
}

// ─── Screen 4: Settings ───────────────────────────────────────────────────────
function SettingsScreen({
  onNavigate,
  onClearAll,
}: {
  onNavigate: (screen: AppScreen) => void;
  onClearAll: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleResetProvider() {
    await chrome.storage.local.remove(['ai-copilot-api-key', 'ai-copilot-provider']);
    onNavigate('welcome');
  }

  function handleClearAll() {
    onClearAll();
    setShowConfirm(false);
  }

  const glassCard: React.CSSProperties = {
    background: 'rgba(16,17,34,0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(91,93,241,0.2)',
  };

  return (
    <div className="relative flex flex-col h-[600px] w-[400px] bg-[#101122] overflow-hidden select-none">
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(91,93,241,0.15)', filter: 'blur(80px)' }}
      />

      <header className="flex items-center gap-3 px-5 pt-5 pb-4 relative z-10">
        <button
          type="button"
          onClick={() => onNavigate('main')}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:text-white transition-colors hover:bg-white/5"
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">Settings</h1>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-6 space-y-4 relative z-10 no-scrollbar">
        {/* AI Provider */}
        <div className="rounded-2xl p-4" style={glassCard}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold">AI Provider</p>
          <button
            type="button"
            onClick={handleResetProvider}
            className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors"
          >
            <span>Change AI Provider</span>
            <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Data */}
        <div className="rounded-2xl p-4" style={glassCard}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold">Data</p>
          {!showConfirm ? (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <span>Clear All Data</span>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm13-15h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-slate-400 px-1">Are you sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-white bg-red-500 active:scale-95 transition-all"
                >
                  Yes, Clear
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 transition-all active:scale-95"
                  style={glassCard}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* About */}
        <div className="rounded-2xl p-4" style={glassCard}>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-semibold">About</p>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between">
              <span>Version</span>
              <span className="text-slate-300 font-medium">1.0.0</span>
            </div>
            <button
              type="button"
              onClick={() => chrome.tabs.create({ url: chrome.runtime.getURL('privacy-policy.html') })}
              className="w-full flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors mt-2"
            >
              <span>Privacy Policy</span>
              <svg viewBox="0 0 24 24" className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
              </svg>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Screen 5: Upgrade Plan ───────────────────────────────────────────────────
function UpgradeScreen({
  onClose,
  onCheckout,
  loading,
}: {
  onClose: () => void;
  onCheckout: () => void;
  loading: boolean;
}) {
  const features = [
    { label: 'Unlimited explanations', icon: '✦' },
    { label: 'Full history access', icon: '↻' },
    { label: 'Priority support', icon: '⚡' },
  ];

  return (
    <div className="relative flex flex-col h-[600px] w-[400px] bg-[#101122] overflow-hidden select-none">
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(91,93,241,0.22)', filter: 'blur(80px)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(120,40,200,0.13)', filter: 'blur(80px)' }}
      />

      <header className="flex items-center gap-3 px-5 pt-5 pb-4 relative z-10">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:text-white transition-colors hover:bg-white/5"
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold text-slate-100 tracking-tight">Upgrade Plan</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'rgba(91,93,241,0.2)' }}
        >
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="#5b5df1">
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Go Premium</h2>
        <p className="text-slate-400 text-sm mb-6">$9/month</p>

        <div className="w-full space-y-3 mb-8">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: 'rgba(16,17,34,0.6)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(91,93,241,0.2)',
              }}
            >
              <span className="text-[#5b5df1] text-lg">{f.icon}</span>
              <span className="text-sm font-medium text-slate-200">{f.label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onCheckout}
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60"
          style={{ background: '#5b5df1', boxShadow: '0 8px 24px rgba(91,93,241,0.3)' }}
        >
          {loading ? 'Processing...' : 'Upgrade Now'}
        </button>
      </main>
    </div>
  );
}

// ─── Screen 6: Explaining (AI Loading) ────────────────────────────────────────
function ExplainingScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative flex flex-col h-[600px] w-[400px] items-center justify-center bg-[#101122] overflow-hidden select-none">
      <div
        aria-hidden="true"
        className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(91,93,241,0.22)', filter: 'blur(80px)' }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full pointer-events-none"
        style={{ background: 'rgba(120,40,200,0.13)', filter: 'blur(80px)' }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(91,93,241,0.2)' }}
        >
          <Sparkles size={36} className="text-[#5b5df1]" style={{ animation: 'explainBounce 1.5s ease-in-out infinite' }} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-2">Analyzing Page...</h2>
          <p className="text-sm text-slate-400">AI is reading and summarizing the content for you.</p>
        </div>

        <div className="loading-dots mt-2">
          <span />
          <span />
          <span />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-6 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white transition-colors"
          style={{
            background: 'rgba(16,17,34,0.6)',
            border: '1px solid rgba(91,93,241,0.2)',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Circuit Breaker ───────────────────────────────────────────────────────────
const CIRCUIT_BREAKER_KEY = 'ai-copilot-circuit';
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000; // 1 minute cooldown

async function getCircuitState(): Promise<{ failures: number; openedAt: number | null }> {
  const stored = await chrome.storage.local.get(CIRCUIT_BREAKER_KEY);
  return (stored[CIRCUIT_BREAKER_KEY] as { failures: number; openedAt: number | null }) ?? { failures: 0, openedAt: null };
}

async function recordCircuitFailure() {
  const state = await getCircuitState();
  state.failures += 1;
  if (state.failures >= CIRCUIT_THRESHOLD) {
    state.openedAt = Date.now();
  }
  await chrome.storage.local.set({ [CIRCUIT_BREAKER_KEY]: state });
}

async function recordCircuitSuccess() {
  await chrome.storage.local.set({ [CIRCUIT_BREAKER_KEY]: { failures: 0, openedAt: null } });
}

async function isCircuitOpen(): Promise<boolean> {
  const state = await getCircuitState();
  if (!state.openedAt) return false;
  if (Date.now() - state.openedAt > CIRCUIT_RESET_MS) {
    // Half-open: allow retry
    await chrome.storage.local.set({ [CIRCUIT_BREAKER_KEY]: { failures: 0, openedAt: null } });
    return false;
  }
  return true;
}

// ─── Main App ──────────────────────────────────────────────────────────────────
function App() {
  const [appScreen, setAppScreen] = useState<AppScreen>('welcome');
  const [bootstrapped, setBootstrapped] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionResponse>({
    isPremium: false,
    plan: 'free',
    usesToday: 0,
  });
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClearHistory = useCallback(async () => {
    await sendRuntimeMessage({ type: 'clear-history' });
    setHistory([]);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    void (async () => {
      // If provider API key already stored, skip welcome screen
      const providerData = await chrome.storage.local.get('ai-copilot-api-key');
      if (providerData['ai-copilot-api-key']) {
        setAppScreen('main');
      }

      const [{ theme: storedTheme }, { session: storedSession }, { history: storedHistory }] =
        await Promise.all([
          sendRuntimeMessage<{ theme: ThemeMode }>({ type: 'get-theme' }),
          sendRuntimeMessage<{ session: Session | null }>({ type: 'refresh-session' }),
          sendRuntimeMessage<{ history: HistoryEntry[] }>({ type: 'get-history' }),
        ]);

      setTheme(storedTheme);
      setSession(storedSession);
      setHistory(storedHistory);

      if (storedSession?.user?.id) {
        await loadSubscription(storedSession.user.id);
      }
      setBootstrapped(true);
    })().catch((unknownError) => {
      setError(unknownError instanceof Error ? unknownError.message : 'Failed to bootstrap extension');
      setBootstrapped(true);
    });
  }, []);

  const usesLeft = useMemo(() => Math.max(0, 5 - subscription.usesToday), [subscription.usesToday]);

  async function loadSubscription(userId: string) {
    const response = await fetch(`${apiBaseUrl}/subscription?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error('Unable to load subscription state');
    const data = (await response.json()) as SubscriptionResponse;
    setSubscription(data);
  }

  async function handleSendOtp() {
    setAuthLoading(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
      });
      if (signInError) throw signInError;
      setOtpSent(true);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unable to send login code');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setAuthLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });
      if (verifyError || !data.session) throw verifyError || new Error('Missing authenticated session');
      await sendRuntimeMessage({ type: 'set-session', session: data.session });
      setSession(data.session);
      setOtpSent(false);
      setOtpCode('');
      await loadSubscription(data.session.user.id);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unable to verify login code');
    } finally {
      setAuthLoading(false);
    }
  }

  const handleSignOut = useCallback(async () => {
    await sendRuntimeMessage({ type: 'clear-session' });
    setSession(null);
    setSubscription({ isPremium: false, plan: 'free', usesToday: 0 });
    setExplanation('');
  }, []);

  const handleThemeToggle = useCallback(async () => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    await sendRuntimeMessage({ type: 'set-theme', theme: nextTheme });
  }, [theme]);

  async function handleExplain() {
    if (!session?.user?.id) {
      setError('Sign in first to start tracking usage and unlock premium.');
      return;
    }

    // Circuit breaker check
    if (await isCircuitOpen()) {
      setError('Service temporarily unavailable. Please try again in a minute.');
      return;
    }

    // Offline check
    if (!navigator.onLine) {
      setError('You are offline. Connect to the internet and try again.');
      return;
    }

    setLoading(true);
    setError(null);
    setAppScreen('explaining');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab detected');

      // Inject content script on-demand (no auto-injection via manifest)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });

      const extracted = (await chrome.tabs.sendMessage(tab.id, {
        type: 'extract_content',
      })) as ExtractionResponse;
      if (!extracted?.content) throw new Error('No readable text found on this page');
      const response = await fetch(`${apiBaseUrl}/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: extracted.content,
          userId: session.user.id,
          email: session.user.email,
          url: extracted.url,
          title: extracted.title,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Explain request failed');

      await recordCircuitSuccess();

      setExplanation(payload.explanation);
      setSubscription((current) => ({
        ...current,
        usesToday: payload.usesToday ?? current.usesToday,
      }));
      const historyItem: HistoryEntry = {
        id: `${Date.now()}`,
        title: extracted.title,
        url: extracted.url,
        explanation: payload.explanation,
        createdAt: new Date().toISOString(),
      };
      const saved = await sendRuntimeMessage<{ history: HistoryEntry[] }>({
        type: 'save-history',
        item: historyItem,
      });
      setHistory(saved.history);
    } catch (unknownError) {
      await recordCircuitFailure();
      setError(unknownError instanceof Error ? unknownError.message : 'Explain request failed');
    } finally {
      setLoading(false);
      setAppScreen('main');
    }
  }

  async function handleUpgrade() {
    if (!session?.user?.id || !session.user.email) {
      setError('Sign in before upgrading.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session.user.id, email: session.user.email }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.checkoutUrl)
        throw new Error(payload.error || 'Unable to create checkout session');
      await chrome.tabs.create({ url: payload.checkoutUrl });
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : 'Unable to open checkout');
    } finally {
      setLoading(false);
    }
  }

  // Loading state while bootstrapping
  if (!bootstrapped) {
    return (
      <div className="w-[400px] h-[600px] flex items-center justify-center bg-[#101122]">
        <div className="loading-dots" aria-label="Loading">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  }

  // Screen 1: Welcome / Connect Provider
  if (appScreen === 'welcome') {
    return (
      <div className="w-[400px] h-[600px]">
        <WelcomeScreen onContinue={() => setAppScreen('main')} />
      </div>
    );
  }

  // Screen 6: Explaining (AI loading)
  if (appScreen === 'explaining') {
    return (
      <div className="w-[400px] h-[600px]">
        <ExplainingScreen onClose={() => { setLoading(false); setAppScreen('main'); }} />
      </div>
    );
  }

  // Screen 5: Upgrade
  if (appScreen === 'upgrade') {
    return (
      <div className="w-[400px] h-[600px]">
        <UpgradeScreen
          onClose={() => setAppScreen('main')}
          onCheckout={handleUpgrade}
          loading={loading}
        />
      </div>
    );
  }

  // Screen 4: Settings
  if (appScreen === 'settings') {
    return (
      <div className="w-[400px] h-[600px]">
        <SettingsScreen
          onNavigate={setAppScreen}
          onClearAll={handleClearHistory}
        />
      </div>
    );
  }

  // Screen 3: History
  if (appScreen === 'history') {
    return (
      <div className="w-[400px] h-[600px]">
        <HistoryScreen
          history={history}
          subscription={subscription}
          onNavigate={setAppScreen}
          onUpgrade={() => setAppScreen('upgrade')}
          onClearHistory={handleClearHistory}
        />
      </div>
    );
  }

  // Screen 2: Main Dashboard
  return (
    <div className="w-[400px] h-[600px]">
      <MainScreen
        session={session}
        subscription={subscription}
        loading={loading}
        error={error}
        explanation={explanation}
        history={history}
        onExplain={handleExplain}
        onUpgrade={() => setAppScreen('upgrade')}
        onSignOut={handleSignOut}
        onNavigate={setAppScreen}
        email={email}
        setEmail={setEmail}
        otpCode={otpCode}
        setOtpCode={setOtpCode}
        otpSent={otpSent}
        authLoading={authLoading}
        onSendOtp={handleSendOtp}
        onVerifyOtp={handleVerifyOtp}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);