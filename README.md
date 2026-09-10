# MAI Network v2 — Telegram Mini App + Bot

## What was fixed
- Added a built-in Telegram bot runner to `backend/server.js`.
- `/start`, `/app`, `/mine`, and `/help` commands are supported.
- `/start r_<telegram_id>` creates a Mini App URL using `startapp`, so the existing referral logic can receive the referral parameter.
- Bot uses Telegram long polling; no extra Telegram SDK is required.
- Added `WEBAPP_URL` to backend configuration.
- The existing backend remains the source of truth for balances and Telegram authentication.

## Run backend
```bash
cd backend
cp .env.example .env
npm install
npm start
```

Required `.env` values:
- `BOT_TOKEN`
- `BOT_USERNAME`
- `WEBAPP_URL`
- `DATABASE_URL`
- `CLIENT_ORIGIN`

The bot and API start together.

## Run frontend
```bash
cd frontend
npm install
npm start
```

For Telegram Mini Apps, the frontend must be deployed to a public HTTPS URL. Set:
- `REACT_APP_API_URL=https://YOUR-BACKEND-URL`
- `REACT_APP_BOT_USERNAME=YOUR_BOT_USERNAME`
- `REACT_APP_TONCONNECT_MANIFEST_URL=https://YOUR-FRONTEND-URL/tonconnect.manifest.json`

## Important
The uploaded ZIP did not contain the referenced image assets. I replaced the missing logo dependency with a self-contained `public/logo.svg`; the decorative background image was not actually used by the React code.

Never commit `.env` or your Telegram bot token.
