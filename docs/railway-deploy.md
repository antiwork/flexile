# Flexile on Railway (Monorepo: Rails + Next.js)

## Services

- **Backend (Rails)**: uses root `railway.json` (runs from `/backend`)
- **Frontend (Next.js)**: uses `frontend/railway.json` (runs from `/frontend`)

## One-time setup (Railway UI)

1. **Create Project → Deploy from GitHub → select this repo**
   - This becomes the **Rails API** service (root `railway.json` is auto-detected).
2. **Add Plugins**: Postgres + Redis. Attach both to the Rails service.
3. **Add second Service**: Project → New Service → Deploy from the same repo.
   - Set **Root Directory** to `/frontend` (it will read `/frontend/railway.json`).

## Environment Variables

### Backend (Rails)

- `SECRET_KEY_BASE` — generate locally:
  ```bash
  ruby -e "require 'securerandom'; puts SecureRandom.hex(64)"
  ```
- `STRIPE_SECRET_KEY=sk_test_...`
- `RESEND_API_KEY=re_...`
- `WISE_API_KEY=...` and `WISE_PROFILE_ID=...` (if using Wise)
- Any other keys from `.env.example`

> Postgres/Redis URLs are auto-injected when you attach the plugins.

### Frontend (Next.js)

- `NEXT_PUBLIC_API_URL=https://<rails-service>.up.railway.app`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...`

## Custom Domains

- Point **frontend** to `app.yourdomain.com`
- (Optional) point **backend** to `api.yourdomain.com` and update `NEXT_PUBLIC_API_URL`

## Troubleshooting

- **“No start command was found”**: Ensure services are using the correct `railway.json` (root for Rails, `/frontend` for Next.js) and correct Root Directory in the UI.
- **`fatal: --local can only be used inside a git repository`**: Fixed by guarded `prepare` script in root `package.json`.
- **“Ignored build scripts: esbuild, puppeteer, sharp”**: Fixed by `pnpm.allowedScripts` in root `package.json`.
- **Chromium/Puppeteer errors at runtime**: Add `/frontend/nixpacks.toml` (see instructions in the repo). If Puppeteer isn’t needed in production, remove the dependency instead.

## Acceptance Check

- Backend service deploys green; logs show Rails boot on `$PORT`.
- Frontend service deploys green; visiting the frontend domain renders the app shell.
- Network calls from frontend hit `NEXT_PUBLIC_API_URL` and succeed.
