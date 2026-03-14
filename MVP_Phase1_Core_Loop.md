# AI Learning Copilot — Phase 1 MVP: Core Loop

## Overview
This document captures the Phase 1 core loop and implementation checklist for the Chrome extension MVP.

## Components
- Chrome Popup (React + TypeScript + Tailwind)
- Content script: extract visible page text, headings, and code blocks
- Vercel backend (Node/Express) with an API endpoint for summarization
- OpenAI: `gpt-4o-mini` for page explanations
- Supabase: users, subscriptions, usage counters
- Stripe: Checkout and webhook to update Supabase

## User Flow
1. Install extension → click toolbar icon
2. Popup shows an `Explain Page` button
3. Click → content script extracts text and sends to backend
4. Backend calls OpenAI, returns an explanation
5. Free users: limit to 5 explanations/day; show upgrade banner when near/over limit
6. Premium users: unlimited explanations + history stored in Supabase

## Minimal UI Behavior
- Popup: `Explain Page`, usage counter, short settings link, upgrade CTA
- Result: concise explanation (3–6 bullet points) + “Show more” to expand

## API contract (minimal)
- POST /api/explain
  - body: { url, extractedText, userId (optional) }
  - response: { explanation, tokensUsed, cached:boolean }

## Supabase responsibilities
- Users table: id, email, created_at
- Usage table: user_id, date, count
- Subscriptions table: user_id, stripe_status, plan

## Stripe responsibilities
- Checkout session for upgrade -> webhook to update `subscriptions` row

## Implementation Checklist (Phase 1)
1. Create popup UI (React/TS/Tailwind) with `Explain Page` button
2. Add content script that extracts visible text and code blocks (debounced)
3. Create Vercel/Express endpoint that forwards prompt to OpenAI and returns structured explanation
4. Integrate Supabase auth (magic link) and usage counters (increment on request)
5. Enforce free-tier limit (5/day) in backend; return 402 or flag when limit reached
6. Add Stripe Checkout and webhook to flip subscription status in Supabase
7. Add a simple history view for premium users (optional after upgrade)

## Minimal file structure suggestion
- extension/
  - popup/
    - src/ (React + TS)
  - content/
    - contentScript.ts
- api/
  - explain/ (serverless function)
  - stripeWebhook/

## Security & Cost Notes
- Strip or redact PII before sending text to OpenAI where possible
- Add server-side caching for repeated URLs to reduce token costs
- Monitor token usage and add fallback shorter-summary mode if costs spike

## Next Steps (concrete)
- Build popup + content script skeleton and wire `POST /api/explain` (week 1)
- I can scaffold the extension starter files if you want — say `yes` to scaffold.
