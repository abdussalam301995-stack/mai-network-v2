# MAI Network v2 — Cinematic UI Update

This package keeps the existing MAI Network backend and Mini App functionality while applying a cinematic gold/cosmic mobile UI inspired by the supplied reference.

## Frontend assets

The frontend now contains the assets it references under `frontend/public/`:
- `logo.svg` — compact MAI coin logo
- `mai-main-logo.png` — MAI cinematic artwork used by the interactive hero coin skin
- `mai-welcome.jpg` — Telegram bot welcome image
- `tonconnect.manifest.json` — TON Connect manifest

## Local frontend build

```bash
cd frontend
npm install
npm run build
```

## Render

Deploy the frontend from the `frontend` directory. The backend does not need changes for the visual update.

Set:

```text
REACT_APP_API_URL=https://mai-network-v2-backend.onrender.com
REACT_APP_TONCONNECT_MANIFEST_URL=https://mai-network-v2-frontend.onrender.com/tonconnect.manifest.json
```

If your existing Render environment already has these values, keep them.

## Security

Do not add `.env` or bot/database secrets to this ZIP or GitHub.
