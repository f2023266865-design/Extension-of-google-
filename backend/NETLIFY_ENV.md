# Netlify environment variables (backend)

Set these environment variables in Netlify Site → Site settings → Build & deploy → Environment.

Server-only secrets (keep private):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Non-secret / app config:

- `STRIPE_PRICE_ID`
- `APP_URL` (e.g., https://your-extension-or-app.example)
- `ALLOWED_ORIGINS` (comma-separated list of origins allowed to call the API)

GitHub Actions secrets (for automated deploy using the workflow):

- `NETLIFY_AUTH_TOKEN` — a Netlify personal access token with deploy rights
- `NETLIFY_SITE_ID` — the Netlify site ID to deploy to

Example copy-paste lines to set in Netlify UI or GitHub secrets (replace values):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...replace_with_service_role
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
APP_URL=https://your-extension.example
ALLOWED_ORIGINS=https://your-extension.example
```

How to use the GitHub Action:

1. Add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` to your repository's Secrets.
2. Push to `main` or run the workflow manually from GitHub → Actions → Netlify Backend Deploy.
