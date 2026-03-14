# AI Learning Copilot Extension

Production-ready Chrome Extension MVP for explaining technical pages with an AI summary workflow.

## What ships here
- React 18 + TypeScript popup with glass morphism UI
- Manifest V3 content script using Readability-based extraction
- Background service worker for Supabase session refresh and local premium history
- Vite build pipeline for popup, content script, and background worker

## Screenshots
- Add your popup screenshot after the first local build test.
- Suggested captures:
  - Signed-out auth screen
  - Free-tier usage card + upgrade banner
  - Premium history panel

## Local setup
1. Copy `.env.example` to `.env`.
2. Fill in `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`.
3. Install dependencies and build.

```bash
npm install
npm run check
npm run build
```

## Load in Chrome
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select the generated `dist` folder inside `extension`

## Recommended test pages
- GitHub repository README pages
- Stack Overflow question pages
- MDN documentation pages
- Long technical blog posts

## Deployment dependency
The popup depends on the backend endpoints under the sibling `backend` folder. Deploy that folder to Vercel first, then set `VITE_API_URL` to its `/api` base URL.