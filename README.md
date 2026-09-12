# MAI Network – Complete Telegram Mining Mini App

This package rebuilds the supplied MAI Network project around the requested gold/cosmic mobile design and keeps mining/reward logic server-authoritative.

## Included

### Home
- Full-screen Telegram Mini App layout based on the supplied MAI artwork.
- Animated loading screen with 0–100% progress.
- Animated cosmic background layers (cloud drift, water shimmer, stars, golden beam).
- MAI balance, Telegram profile photo/name, LVL 0–1000, referral count.
- UTC daily bonus: 1 MAI once per UTC day.
- Red task indicator while Daily tasks remain incomplete.
- Animated MAI hero coin with tap particle burst.
- Server-authoritative 24-hour farming cycle.
- Free mining: 5 MAI/day.
- Level formula: LVL 1 = 10/day; each level +2/day, plus the 5/day free bonus.
- Holding requirement: LVL N requires N × 1,000 MAI.
- Boost page with 1–1000 levels, pagination, locked/unlocked detail pages.

### Tasks
Daily:
- Rewarded ad sessions, 200/day UTC reset, +1 MAI each, 5-second cooldown.
- Rewards are issued only after a provider completion webhook verifies the ad.
- MAI News, MAI Pay Out, MAI Chat Group membership checks via Telegram `getChatMember`, +2 MAI each/day.

Partner:
- `Add to Promote` workflow for Channel / Group / Bot / Website / Link.
- Promotion quote based on requested completion limit.
- Pay MAI or Pay GRAM.
- MAI campaigns deduct the configured campaign cost server-side.
- GRAM campaigns remain payment-pending until verified/admin approved.

Exclusive:
- Only approved, paid campaigns are displayed.
- Supports official gifts/reward campaigns and Telegram membership verification.
- Per-user duplicate completion protection and campaign capacity tracking.

### Friends / Referral
- Personal Telegram referral link.
- Invite to Telegram / copy link.
- Pending and successful referrals.
- Default successful referral rewards: referrer +10 MAI, invited user +5 MAI.
- Referral only qualifies after the invited user completes a meaningful action (daily bonus, verified task, verified ad or farm claim).
- Milestones: 5/10/25/50/100 referrals with configurable rewards.
- Referral history.

### Profile / Wallet / Withdrawal
- Telegram profile center.
- TON Connect UI and one-wallet-per-account binding.
- MAI holding / level progress.
- Withdrawal center with configurable minimum, max, fee and daily request limit.
- Atomic balance lock so the same balance cannot be withdrawn twice.
- Idempotency protection.
- Wallet-change security lock.
- Risk flags and manual-review threshold.
- Withdrawal history.
- Admin endpoints to approve, reject and mark a withdrawal completed with a blockchain transaction hash.

## Why mining is counted on the server

The browser only displays the countdown/pending estimate. The backend stores the farm start time and the mining rate snapshot. A claim is accepted only when the server says the 24-hour cycle is complete. Editing JavaScript, changing the phone clock, refreshing, or changing visible values cannot mint extra MAI.

This is safer than letting frontend JavaScript be the source of truth.

## Security / multi-account controls

`.env` contains:

- `DEVICE_POLICY=off|observe|soft|hard`
- `MAX_ACCOUNTS_PER_DEVICE`
- `MAX_ACCOUNTS_PER_IP_DAY`
- `BLOCK_WITHDRAW_ON_RISK`

The frontend stores a random first-party device identifier and sends it to the backend. The backend stores only a hash and correlates it with Telegram accounts. IP and user-agent data are also stored as hashes in security logs.

Important: browser/device IDs are an anti-abuse signal, not proof of a physical device. A determined attacker can reset or spoof them. Telegram signed initData, server-side reward rules, rate limits, wallet uniqueness, idempotency, and manual review are the stronger controls. Start with `DEVICE_POLICY=observe`, inspect false positives, then use `soft` or `hard` only when you are comfortable with the impact on legitimate users.

## Rewarded ads – production requirement

The backend never trusts a frontend timer as proof that an ad was watched. Configure an ad provider that supports a server callback/postback:

- `AD_PROVIDER_MODE=external`
- `AD_PROVIDER_URL=...`
- `AD_WEBHOOK_SECRET=...`

The provider must call:

`POST /webhooks/ads`

with JSON:

```json
{
  "sessionId": "UUID_FROM_MAI",
  "status": "completed",
  "providerRef": "provider-transaction-id"
}
```

and header `x-ad-signature`, where the signature is HMAC-SHA256 of:

`sessionId:status:providerRef`

using `AD_WEBHOOK_SECRET`.

Without a real provider completion callback, no production-quality system can prove that a user watched an external ad to the end.

## Wallet security note

TON Connect is integrated for wallet connection and the backend enforces wallet uniqueness + change cooldown. For very high-value automatic on-chain payouts, add TON `ton_proof` verification before enabling automatic payouts. The supplied withdrawal system intentionally defaults to an admin-approved payout queue rather than exposing a hot-wallet private key inside the web server.

## Setup

1. Install PostgreSQL and create a database.
2. Copy `backend/.env.example` to `backend/.env` and fill in:
   - `DATABASE_URL`
   - `BOT_TOKEN`
   - `BOT_USERNAME`
   - Telegram channel/group IDs and links
   - `ADMIN_KEY`
3. Copy `frontend/.env.example` to `frontend/.env` and set the backend URL.
4. Update `frontend/public/tonconnect.manifest.json` with your deployed frontend domain.
5. Install dependencies:

```bash
npm run install:all
```

6. Start backend:

```bash
npm run dev:backend
```

7. In another terminal start frontend:

```bash
npm run dev:frontend
```

For local browser testing only, set `ALLOW_DEV_AUTH=true` in the backend and set `REACT_APP_DEV_USER_ID` in the frontend. Turn development authentication OFF in production.

## Telegram requirements

- Configure the Mini App/Web App URL in BotFather.
- Bot must have permission to inspect membership in the three configured Telegram channels/groups. For channels, make the bot an admin where required by Telegram.
- Use the deployed HTTPS frontend URL.

## Admin withdrawal examples

All admin calls require `X-Admin-Key`.

- `GET /admin/withdrawals`
- `POST /admin/withdrawals/:id/approve`
- `POST /admin/withdrawals/:id/reject`
- `POST /admin/withdrawals/:id/complete` with `{ "txHash": "..." }`

This keeps payout private keys outside this starter web server. A separate payout worker can later call the approved queue if you decide to automate blockchain transfers.

## Formula summary

- Required holding for level `N`: `N × 1000 MAI`
- Level speed: `10 + ((N - 1) × 2)` MAI/day
- Total speed: `5 + level speed` MAI/day
- Level 3 therefore gives `14 + 5 = 19 MAI/day`.

All values are configurable through backend environment variables.

## v3.1 Telegram Android stability fix

This build separates the static background image from animated visual effects and removes `backdrop-filter` from high-frequency UI surfaces. This avoids a known class of Android WebView compositor flicker. The central MAI coin image is pinned to its own stacking/compositor layer and never animates opacity, visibility, filter, or blend mode. Only the surrounding halo/orbits move.

If a Telegram bot still shows an older UI (for example an old "TAP TO MINE" screen or an ad limit different from `.env`), the bot is still pointing to an older deployed Web App URL. Build/deploy this version and update the BotFather Mini App/Web App URL to the new deployment.
