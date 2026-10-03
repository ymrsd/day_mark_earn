# Provider Integration And Hosting Guide

## Current State

Daymark currently supports advertiser-funded direct campaigns and direct game/app/survey/task offers. Offers are funded in advance, manually reviewed, and credited only after an admin approves completion proof. Country targets default to worldwide and can optionally be restricted by ISO alpha-2 codes.

The project does **not** currently fetch external offer catalogs or process provider callbacks. The `AD_NETWORK_*_URL` values are outbound links only. Adding a URL is not a provider integration and does not create inventory, verify a task, or credit a Daymark balance.

## Provider Categories

### Rewarded offerwalls

These are candidates to contact, not connected providers and not a guarantee of Sri Lanka inventory:

- [Lootably](https://lootably.com/) - ask about offerwall publisher approval, rewarded game/app offers, postbacks, and Sri Lanka availability.
- [AdGate Media](https://adgatemedia.com/) - ask about publisher approval, incentivized placements, API/postback access, and Sri Lanka inventory.
- [Torox](https://torox.io/) - ask about rewarded offers, publisher/API access, and country-level game inventory.
- [BitLabs](https://bitlabs.ai/) and [CPX Research](https://www.cpx-research.com/) - survey-focused options; ask whether their current publisher product accepts this rewards model and Sri Lankan users.

Provider products, acceptance rules, and country inventory change. Confirm current terms directly with each provider before adding it. Obtain written confirmation that a PTC/rewards site and incentivized game/app traffic are allowed. Some providers prohibit incentivized installs or require explicit placement approval.

### Publisher ad networks

[Adsterra](https://adsterra.com/), [Monetag](https://monetag.com/), and [PropellerAds](https://propellerads.com/) may offer publisher ad products, subject to their approval and terms. These are for monetizing publisher traffic; they do not automatically fund earner rewards. Do not place them inside a paid-view task unless that network explicitly permits incentivized traffic and the placement has been approved.

### Direct advertiser offers

This path is already present. An advertiser deposits funds, creates a game/app/task offer, and an admin reviews it. Earners submit proof; approval pays the stored reward from the reserved advertiser budget. This is the current working offer path while external providers are not connected.

## Required Work For Each Provider

1. Create a publisher account and submit the real website URL, traffic sources, audience countries, and reward model.
2. Get explicit approval for Sri Lanka and incentivized game/app traffic. Check country availability in the live dashboard; a global site setting does not mean a provider has Sri Lankan campaigns.
3. Obtain the provider's current integration docs, publisher/placement IDs, test offer, postback signature format, event ID, click/sub-ID rules, conversion states, and reversal/chargeback rules.
4. Implement that provider's adapter. Map provider offer IDs and click IDs to `RewardOffer` / `OfferCompletion`; never accept reward amounts supplied by the browser.
5. Add provider-specific signature verification, timestamp/replay checks, idempotent conversion handling, and reversal handling on the server. Keep all provider secrets in the deployment secret manager, never in browser code or GitHub.
6. Test approved, rejected, duplicated, delayed, reversed, and wrong-user callbacks using the provider's test mode before enabling production placements.
7. Agree and configure the revenue split, minimum payout, payout schedule, and support process. Do not promise earner rewards until provider funding and settlement rules cover them.

Because provider postbacks differ, there is intentionally no generic unsigned callback endpoint. A provider must be selected and its current signature specification obtained before its callback can be implemented safely.

## Country And Edge Headers

Offer targeting uses `CF-IPCountry` when deployed behind Cloudflare or `x-vercel-ip-country` on Vercel. Unknown country information returns worldwide offers only. These headers are for market targeting, not identity or payment verification. Verify that the production proxy overwrites them; do not trust client-supplied country values on a deployment that does not control its edge proxy.

## Hosting

- [Vercel Hobby terms](https://vercel.com/docs/plans/hobby) restrict Hobby use to non-commercial personal projects, so do not use it for a monetized production rewards site.
- [Cloudflare Workers pricing and limits](https://developers.cloudflare.com/workers/platform/pricing/) list a free request tier, but this Next.js + Prisma Node application is not configured for Cloudflare's runtime yet. It requires a compatible Next.js adapter, database connectivity configuration, and a fresh production test; free limits also apply.
- A conventional Node.js host with PostgreSQL connectivity is the current supported deployment shape. Check that the selected provider permits the site's commercial/rewards business model and budget for usage, database, and email/abuse monitoring costs.

## Manual Launch Checklist

- [ ] Rotate any database credential previously shared in chat; update `.env` locally and the host's secret settings.
- [ ] Choose one provider, obtain approval, and confirm Sri Lanka/incentivized inventory.
- [ ] Provide the provider's docs and test credentials through a private, approved secret/configuration workflow. Never commit secrets or paste them into chat.
- [ ] Configure production `DATABASE_URL`, `AUTH_SECRET`, `CLAIM_TOKEN_SECRET`, `AUDIT_HASH_SECRET`, `BANK_DETAILS_ENCRYPTION_SECRET`, Upstash, ProxyCheck, and hCaptcha settings.
- [ ] Create an admin account and test deposit, offer approval, proof review, reward credit, withdrawal, and rejection/refund flows.
- [ ] Deploy to a commercial-permitted host, attach a domain with HTTPS, then verify provider callbacks and country targeting from the provider dashboard.
- [ ] Start with the provider's test mode and a small capped offer budget; enable live rewards only after reconciliation passes.