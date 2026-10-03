# Daymark Watch-to-Earn

Daymark is a Next.js App Router application for rewarded sponsored views, advertiser campaigns, and manual platform operations. Rewards are recorded only by the server after the signed viewing session, eligibility checks, CAPTCHA, and database transaction all succeed.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS, Lucide, Framer Motion
- PostgreSQL and Prisma; fixed-point `Decimal` fields for balances and campaign budgets
- Auth.js credentials sessions with bcrypt password hashes and role claims
- Upstash Redis rate limiting, ProxyCheck screening, hCaptcha verification, and FingerprintJS signals

## Local Setup

Requirements: Node.js 20+, npm, PostgreSQL, and an Upstash Redis REST database. ProxyCheck and hCaptcha credentials are required before ad viewing and reward claims can run.

In development only, Auth.js uses a local fallback secret and rate/timer checks use in-memory limits when Redis is not configured. These fallbacks are not suitable for production. Account registration and login still require a reachable PostgreSQL database; without `DATABASE_URL`, signup returns a setup error instead of a generic failure.

1. Copy `.env.example` to `.env` and provide distinct random values for `AUTH_SECRET`, `CLAIM_TOKEN_SECRET`, `AUDIT_HASH_SECRET`, and `BANK_DETAILS_ENCRYPTION_SECRET` (at least 32 bytes each).
2. Set `DATABASE_URL` to a PostgreSQL database. Upstash REST credentials are required in production; development uses process-local limits if they are absent.
3. Set `PROXYCHECK_API_KEY`, `HCAPTCHA_SECRET`, and `NEXT_PUBLIC_HCAPTCHA_SITE_KEY`. Paid viewing stays paused unless proxy screening and CAPTCHA verification are configured.
4. Set `MIN_WITHDRAWAL_USD` if the default $1.00 payout threshold should differ.
5. Optionally set publisher destinations in `AD_NETWORK_ADSTERRA_URL`, `AD_NETWORK_MONETAG_URL`, and `AD_NETWORK_PROPELLERADS_URL`.
6. Run `npm install`, `npm run db:generate`, and `npm run db:migrate`.
7. Run `npm run dev` and open the printed local URL.

The earner queue shows only funded, admin-approved campaigns. A fresh database has no campaigns until an advertiser deposits funds, submits a campaign, and an admin approves it. `AD_NETWORK_FALLBACK_URL` and the optional provider URLs are outbound links only; network eligibility and payments are controlled by those providers and are not credited as Daymark rewards.

## Account Roles And Review

Public registration supports earner and advertiser accounts. Admin is never selectable during signup. To provision an admin, register the intended account and elevate it from a trusted database console:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'admin@example.com';
```

Advertiser deposits are manual review requests. Campaign budgets are reserved from the advertiser balance when submitted; approval activates the campaign and rejection refunds the reservation. Withdrawal requests reserve earner funds immediately; rejecting a request returns the reserved balance.

## Games And App Offers

Advertisers can submit funded game, app-install/use, survey, and task offers from their workspace. An admin must approve an offer before it appears in the earner marketplace. Earners start an offer, complete its stated requirements, and submit a note plus an HTTPS evidence link when required. An admin reviews that proof; only approval atomically deducts the reserved offer budget and credits the earner transaction. Starting or clicking an offer never credits a reward.

Offerwall provider APIs and automated server-to-server callbacks are not connected yet. `providerName` and click references are stored to support that integration later. Until then, offers use direct advertiser destinations and manual proof review. Use external game/app networks only if their terms explicitly allow incentivized traffic; their payout is not automatically a Daymark balance reward.

## Security Notes

- Claim tokens are signed, bound to user/campaign/session IDs, and expire shortly after the required viewing duration.
- Reward, advertiser spend, view history, and session consumption are committed atomically. A daily unique constraint and a rolling 24-hour eligibility check both prevent repeat rewards.
- IP and browser fingerprint signals are HMAC-hashed before storage. Treat reverse-proxy IP headers as trusted only when the deployment proxy overwrites them.
- New manual-bank payout details are AES-256-GCM encrypted with `BANK_DETAILS_ENCRYPTION_SECRET`; only the admin payout endpoint decrypts them. Keep this key stable and backed up, because changing it without re-encrypting existing payout rows makes those bank details unreadable.
- Upstash, ProxyCheck, hCaptcha, and payment credentials are external prerequisites, not mocked successes. Payment execution is intentionally manual; FaucetPay/Payeer settlement APIs are not wired in this starter.
- The in-browser timer pauses when the tab is hidden. The server independently enforces elapsed time; client-side focus signals are not treated as cryptographic proof of attention.

## Operations

- `npm run db:generate` regenerates Prisma Client.
- `npm run db:migrate` applies local database migrations.
- `npm run db:studio` opens Prisma Studio.
- `npm run lint` runs ESLint.
- `npm run build` creates a production build.
