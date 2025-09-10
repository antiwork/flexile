# Flexile

**Contractor payments made simple.**
Flexile is a modern platform for managing and streamlining contractor payments, built with a Rails API backend and a Next.js frontend.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (see [`.node-version`](.node-version) for the exact version)
- [Ruby](https://www.ruby-lang.org/en/documentation/installation/)

### Setup

The easiest way to set up the project is to run the [`bin/setup`](bin/setup) script.
Alternatively, you can follow the steps below manually:

#### Backend

1. Install Ruby (recommended: `rbenv` or `rvm`) and PostgreSQL
2. Install dependencies:
   ```bash
   cd backend
   bundle install
   gem install foreman
   ```

#### Frontend

1. Install dependencies:
   ```bash
   cd frontend
   pnpm install
   ```

#### Environment

Copy the example env file:

```bash
cp .env.example .env
```

> 🔑 If you’re part of the Antiwork team, you can use:
> `vercel env pull .env`

---

## 🏃 Running the App

Start everything locally:

```bash
bin/dev
```

By default:

- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend (Rails API): [http://localhost:3001](http://localhost:3001)

### Development Shortcuts

- Set `ENABLE_DEFAULT_OTP=true` in `.env` to use `000000` as OTP.
- Pre-seeded accounts (password: `password`):
  - **Admin** → `hi+sahil@example.com`
  - **Contractor** → `hi+sharang@example.com`
  - **Investor** → `hi+chris@example.com`
- See full seed data in [`backend/config/data/seed_templates/gumroad.json`](backend/config/data/seed_templates/gumroad.json).

---

## 🛠️ Common Issues & Fixes

### 1. Postgres Role Missing

**Error:**
`FATAL: role "username" does not exist`

**Fix:**

```bash
psql postgres -c "CREATE USER username WITH LOGIN CREATEDB SUPERUSER PASSWORD 'password';"
```

---

### 2. Redis Not Connecting

**Error:**
`Redis::CannotConnectError` on port `6389`

**Fix:**
Restart `bin/dev`. If seeding failed, run:

```bash
bin/rails db:reset
```

---

### 3. Stripe Tests Failing

**Cause:** Missing/invalid customer IDs.
**Fix:** Create a customer with Stripe CLI:

```bash
stripe customers create   --name "Customer Name"   --email "customer@example.com"   --api-key "sk_test_mock"
```

Update factories with this new customer ID.

---

## ✅ Testing

Run Rails specs:

```bash
bundle exec rspec
```

Run a specific test:

```bash
bundle exec rspec spec/system/roles/show_spec.rb:7
```

Run Playwright end-to-end tests:

```bash
pnpm playwright test
```

---

## 🔌 Service Configuration

### Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Enable **Test Mode**
3. Get your API keys from **Developers → API keys**
4. Add to `.env`:
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_SECRET_KEY=sk_test_...
   ```

---

### Wise

1. Sign up at [sandbox.transferwise.tech](https://sandbox.transferwise.tech/)
2. Copy your **Membership number** (Profile → Settings)
3. Create an **API token** (full access)
4. Add to `.env`:
   ```env
   WISE_PROFILE_ID=12345678
   WISE_API_KEY=your_api_token
   ```

---

### Resend

1. Register at [resend.com](https://resend.com)
2. Create an API key under **API Keys**
3. Add to `.env`:
   ```env
   RESEND_API_KEY=re_...
   ```

---

> ⚠️ **Important:** Never commit credentials to version control.

---

## 📜 License

This project is licensed under the [MIT License](LICENSE.md).

---

✨ That’s it! You’re ready to start contributing to **Flexile**.
