# AI Learning Copilot — PRD v1.0

## Product Vision
Instant AI explanations for complex web learning content — make technical pages, tutorials, papers, and videos immediately understandable with a single click.

## Target Users
- Developers (documentation, code examples)
- Students (tutorials, research papers)
- YouTubers / learners (video notes & transcripts)

## MVP (Phase 1)
1. Popup UI: an "Explain this page" button that summons a concise explanation of the current web page.
2. Text extraction pipeline that grabs the article/body, code blocks, and headings.
3. Backend call to OpenAI for summarization and contextual explanation.
4. Freemium usage model: 5 free explanations per day; $9/month unlimited.
5. User and subscription storage on Supabase; payments via Stripe.

## Success Metrics (Initial Goals)
- 1,000 installs in Month 1
- 5% paid conversion → ~$450 MRR
- <10% monthly churn

## Priority Features
- Basic page explain: complete (MVP)
- Usage limits & freemium flow: complete (MVP)
- YouTube transcript support: planned for Phase 2
- Side-panel persistent UI: planned for Phase 2

## Technical Architecture (MVP)
- Frontend: small browser extension popup + content script to extract page text.
- Backend: serverless API (e.g., Vercel / Supabase Edge Function) that calls OpenAI.
- Database: Supabase for users, usage counters, and subscription status.
- Payments: Stripe for subscription handling and webhooks to update Supabase.

## Data & Privacy
- Only send extracted page text necessary for explanation; strip PII where possible.
- Store usage counters and payment metadata in Supabase; do not persist full page content unless user opts in.
- Provide a privacy policy link during onboarding explaining data flows.

## Milestones & Timeline (suggested)
1. Week 1: Content extraction + simple popup UI
2. Week 2: Backend summarization + OpenAI integration
3. Week 3: Supabase user accounts + usage limits enforcement
4. Week 4: Stripe subscription flow + publish alpha

## Open Questions / Risks
- Rate limits & cost on OpenAI calls — consider caching and batching.
- Abuse / spam detection for the free tier.
- UX for multi-part pages and dynamic content (videos, infinite scroll).

## Next Steps
- Validate copy and pricing with 5 potential users.
- Build alpha and instrument analytics for install → upgrade funnel.

---
*Created: PRD v1.0 — initial MVP scoping and goals*
