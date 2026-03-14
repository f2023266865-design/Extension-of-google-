# AI Learning Copilot MVP

Launch-ready Chrome Extension MVP for AI explanations of technical pages.

## Project layout
- `extension/`: Chrome Extension (Manifest V3, React, TypeScript, Tailwind)
- `backend/`: Vercel API endpoints for explanations, subscription checks, and Stripe webhooks
- `PRD_AI_Learning_Copilot_v1.0.md`: product requirements
- `MVP_Phase1_Core_Loop.md`: core-loop scope

## Quick start
```powershell
./setup.ps1
```

## Manual setup

### 1. Supabase
Create a new Supabase project and run this SQL exactly in the SQL Editor:

```sql
-- Run in Supabase SQL Editor
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  feature_used TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
```

Important: the backend writes through the Supabase service role key so it can work with RLS enabled.

### 2. Stripe
Create a `$9/month` recurring product in Stripe and copy the generated `price_...` ID.

### 3. Backend env
Copy `backend/.env.example` to `backend/.env` and fill all values.

Required variables from the product brief:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Required for a production backend even though not listed in the brief:
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_PRICE_ID`
- `APP_URL`

### 4. Extension env
Copy `extension/.env.example` to `extension/.env` and set:
- `VITE_API_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 5. Install and validate
```powershell
Set-Location .\backend
npm install
npm run check

Set-Location ..\extension
npm install
npm run check
npm run build
```

### 6. Deploy backend to Vercel
```powershell
Set-Location .\backend
npm install
npx vercel deploy
```

### 7. Load the extension in Chrome
1. Open `chrome://extensions`
2. Enable Developer mode
3. Click Load unpacked
4. Select `extension/dist`
5. Test on GitHub, Stack Overflow, and MDN

## API summary
- `POST /api/explain`: checks free-tier cap, calls OpenAI, logs usage
- `GET /api/subscription?userId=...`: returns premium status and uses today
- `POST /api/subscription`: creates a Stripe Checkout session
- `POST /api/stripe-webhook`: updates subscription rows from Stripe events

## Post-deploy checklist
- [ ] Supabase schema created
- [ ] Backend env configured in Vercel
- [ ] Stripe webhook points to `/api/stripe-webhook`
- [ ] Extension `.env` points at deployed backend `/api`
- [ ] `npm run build` succeeds in `extension/`
- [ ] Chrome loads `extension/dist` without manifest errors
- [ ] Free users stop at 5 explanations/day
- [ ] Premium checkout returns a live Stripe Checkout URL

## Limits of local validation here
- Real Supabase queries were scaffolded but not executed because this workspace has no project credentials.
- Real Stripe Checkout and webhook verification were scaffolded but not exercised for the same reason.
- OpenAI calls are wired but not run without `OPENAI_API_KEY`.