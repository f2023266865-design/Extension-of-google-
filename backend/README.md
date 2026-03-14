# Backend Deployment on Netlify

This backend is configured to run on Netlify Functions with `/api/*` routes.

## 1) Netlify Project Settings

Set these in Netlify site settings:

- Base directory: `backend`
- Build command: `npm run check`
- Publish directory: leave empty (functions-only backend)
- Functions directory: handled by `netlify.toml` (`netlify/functions`)

## 2) Required Environment Variables

Add these variables in Netlify:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`
- `ALLOWED_ORIGINS`

Example `ALLOWED_ORIGINS` value:

`https://your-frontend-domain.com,chrome-extension://your-extension-id`

## 3) Deployed API Routes

After deploy, these endpoints are available:

- `GET /api/ping`
- `POST /api/explain`
- `GET /api/subscription?userId=<uuid>`
- `POST /api/subscription`
- `POST /api/stripe-webhook`

## 4) Verify Deployment

Replace `<SITE>` with your Netlify domain.

### Health check

```bash
curl https://<SITE>.netlify.app/api/ping
```

Expected success:

```json
{"ok":true,"supabase":true,"sampleCount":0}
```

### Explain API check

```bash
curl -X POST https://<SITE>.netlify.app/api/explain \
  -H "Content-Type: application/json" \
  -d '{"content":"hello world","userId":"00000000-0000-0000-0000-000000000000"}'
```

Expected behavior:

- `200` with explanation payload if user and config are valid.
- `400` for invalid input.
- `402` when free quota reached.

### Subscription read check

```bash
curl "https://<SITE>.netlify.app/api/subscription?userId=00000000-0000-0000-0000-000000000000"
```

### Stripe webhook check

Set Stripe webhook URL to:

`https://<SITE>.netlify.app/api/stripe-webhook`

## 5) Logs and Debugging

In Netlify dashboard:

- Deploy log: Deploys -> latest deploy -> logs
- Function log: Functions -> select function -> logs

If `/api/ping` fails:

- Recheck `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Confirm `users` table exists in Supabase
- Confirm keys are not expired/rotated

## 6) Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to frontend code.
- Keep all server secrets only in Netlify environment variables.
- Rotate any secret that was pasted publicly.
