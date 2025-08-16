# Flexile

Contractor payments as easy as 1-2-3.

## Setup

You'll need:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (see [`.node-version`](.node-version))
- [Ruby](https://www.ruby-lang.org/en/documentation/installation/)

The easiest way to set up the development environment is to use the [`bin/setup` script](bin/setup), but feel free to run the commands in it yourself:

### Backend

- Set up Ruby (ideally using `rbenv`/`rvm`) and PostgreSQL
- Navigate to backend code and install dependencies: `cd backend && bundle i && gem install foreman`

### Frontend

- Navigate to frontend app and install dependencies `cd frontend && pnpm i`

Finally, set up your environment: `cp .env.example .env`. If you're an Antiwork team member, you can use `vercel env pull .env`.

## Running the App

You can start the local app using the [`bin/dev` script](bin/dev) - or feel free to run the commands contained in it yourself.

Once the local services are up and running, the application will be available at `https://flexile.dev`

**Development shortcuts**:

- If `ENABLE_DEFAULT_OTP=true` is set in your `.env`, you can use `000000` as the OTP for logging in or signing up.
- Use these pre-seeded accounts (password: `password` for all):
  - **Admin**: `hi+sahil@example.com` (Primary Administrator)
  - **Contractor**: `hi+sharang@example.com` (Software Engineer)
  - **Investor**: `hi+chris@example.com` (Investor)
  - **More accounts**: See [the seed data](backend/config/data/seed_templates/gumroad.json) for additional test users (emails are always hi+firstname@example.com)

## Common Issues / Debugging

### 1. Postgres User Creation

**Issue:** When running `bin/dev` (after `bin/setup`) encountered `FATAL: role "username" does not exist`

**Resolution:** Manually create the Postgres user with:

```
psql postgres -c "CREATE USER username WITH LOGIN CREATEDB SUPERUSER PASSWORD 'password';"
```

Likely caused by the `bin/setup` script failing silently due to lack of Postgres superuser permissions (common with Homebrew installations).

### 2. Redis Connection & database seeding

**Issue:** First attempt to run `bin/dev` failed with `Redis::CannotConnectError` on port 6389.

**Resolution:** Re-running `bin/dev` resolved it but data wasn't seeded properly, so had to run `db:reset`

Likely caused by rails attempting to connect before Redis had fully started.

## Testing

```shell
# -----------------------------
# 🧪 Testing (now mock-first)
# -----------------------------
# The entire test-suite now runs **without any external API keys**.
# We spin-up local mocks for Stripe and stub the Wise sandbox via WebMock; the
# front-end uses MSW (Mock Service Worker).
#
# • Faster – no network latency
# • Deterministic – no flakey 3rd-party outages
# • OSS-friendly – contributors can run `rspec` & Playwright out-of-the-box

Run all specs with mocks:
```bash
bin/test-with-mocks
```

Run a single spec:
```bash
bin/test-with-mocks spec/system/roles/show_spec.rb:7
```

E2E tests (Playwright) already start MSW automatically:
```bash
pnpm playwright test
```

Traditional commands still work if you’ve already started `stripe-mock` (see
below):
```bash
# Rails specs
bundle exec rspec
```

### How the mocking works
* **Backend** – `stripe-mock` Docker container on `localhost:12111`,
  Wise HTTP calls intercepted via **WebMock** stubs.
* **Frontend/E2E** – **MSW** intercepts browser & Node fetches.

### Opt-in to real APIs
Occasionally you may wish to hit the real Stripe/Wise sandboxes:
```bash
USE_STRIPE_MOCK=false USE_WISE_MOCK=false \
STRIPE_SECRET_KEY=sk_test_... \
WISE_API_KEY=your_token WISE_PROFILE_ID=12345 \
bundle exec rspec
```
Be mindful of rate-limits & credentials.
```

## Services configuration

<details>
<summary>Stripe</summary>

1. Create account at [stripe.com](https://stripe.com) and complete verification
2. Enable **Test mode** (toggle in top right of dashboard)
3. Navigate to **Developers** → **API keys**
4. Copy **Publishable key** (`pk_test_...`) and **Secret key** (`sk_test_...` - click "Reveal" first)
5. Add to `.env`:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   ```

</details>

<details>
<summary>Wise</summary>

1. Register at [sandbox.transferwise.tech](https://sandbox.transferwise.tech/) and complete email verification
2. Click profile/avatar → **Settings** → copy your **Membership number**
3. Go to **Integrations and Tools** → **API tokens** → **Create API token**
4. Set permissions to **Full Access**, name it (e.g., "Flexile Development"), and copy the token immediately
5. Add to `.env`:
   ```
   WISE_PROFILE_ID=your_membership_number_here
   WISE_API_KEY=your_full_api_token_here
   ```
   </details>

<details> 
<summary>Resend</summary>

1. Create account at [resend.com](https://resend.com) and complete email verification
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**, give it a name (e.g., "Flexile Development")
4. Copy the API key immediately (starts with re\_)
5. Add to `.env`:
   ```
   RESEND_API_KEY=re_your_api_key_here
   ```

</details>

**Note**: Keep credentials secure and never commit to version control.

## License

Flexile is licensed under the [MIT License](LICENSE.md).
