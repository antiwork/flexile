# **Flexile**
> Contractor payments as easy as 1-2-3.

---

## **Table of Contents**
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Setup](#setup)
   - [Backend](#backend)
   - [Frontend](#frontend)
4. [Running the App](#running-the-app)
5. [Common Issues / Debugging](#common-issues--debugging)
6. [Testing](#testing)
7. [Services Configuration](#services-configuration)
   - [Stripe](#stripe)
   - [Wise](#wise)
8. [Contributing](#contributing)
9. [Code of Conduct](#code-of-conduct)
10. [License](#license)

---

## **Overview**
Flexile is a streamlined platform for contractor payments, aiming to make transactions as easy as **1-2-3**.

The project consists of:
- **Backend:** Ruby on Rails + PostgreSQL + Redis
- **Frontend:** Next.js + Node.js + PNPM

---

## **Prerequisites**
Ensure you have the following installed:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (version specified in [`.node-version`](.node-version))
- [Ruby](https://www.ruby-lang.org/en/documentation/installation/)
- [PostgreSQL](https://www.postgresql.org/download/)
- [Redis](https://redis.io/download/)

---

## **Setup**

The easiest way to set up the development environment is using:
```bash
bin/setup
```
Or run the steps manually:

---

### **Backend**
1. Set up Ruby (preferably via `rbenv` or `rvm`) and PostgreSQL.
2. Install dependencies:
   ```bash
   cd backend
   bundle install
   gem install foreman
   ```

---

### **Frontend**
1. Install dependencies:
   ```bash
   cd frontend
   pnpm install
   ```

---

### **Environment Variables**
1. Copy the example `.env` file:
   ```bash
   cp .env.example .env
   ```
2. If you are part of the Antiwork team:
   ```bash
   vercel env pull .env
   ```

---

## **Running the App**
Start the local application using:
```bash
bin/dev
```

Once running, access the app at:
```
https://flexile.dev
```

**Tip:** Default seed data is available in:
```
backend/config/data/seed_templates/gumroad.json
```

---

## **Common Issues / Debugging**

### **1. Postgres User Creation**
**Error:**
```
FATAL: role "username" does not exist
```
**Fix:**
```bash
psql postgres -c "CREATE USER username WITH LOGIN CREATEDB SUPERUSER PASSWORD 'password';"
```
This usually happens if the setup script lacks Postgres superuser permissions.

---

### **2. Redis Connection & Database Seeding**
**Error:**
```
Redis::CannotConnectError on port 6389
```
**Fix:**
- Re-run `bin/dev` after Redis starts fully.
- If data wasn’t seeded, run:
  ```bash
  bin/rails db:reset
  ```

---

## **Testing**

### **Backend (Rails Specs)**
```bash
bundle exec rspec        # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7  # Run a single spec
```

### **Frontend (Playwright E2E)**
```bash
pnpm playwright test
```

---

## **Services Configuration**

### **Stripe**
1. [Create a Stripe account](https://stripe.com) & complete verification.
2. Enable **Test mode**.
3. Get API keys from **Developers → API keys**.
4. Add to `.env`:
   ```env
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   ```

---

### **Wise**
1. [Register at Wise Sandbox](https://sandbox.transferwise.tech/) & verify email.
2. Copy **Membership number** from profile settings.
3. Create an **API token** with **Full Access**.
4. Add to `.env`:
   ```env
   WISE_PROFILE_ID=your_membership_number_here
   WISE_API_KEY=your_full_api_token_here
   ```

**⚠️ Important:** Never commit credentials to version control.

---

## **Contributing**
We welcome contributions from the community! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

---

## **Code of Conduct**
All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md) to maintain a respectful and productive environment.

---

## **License**
Flexile is licensed under the [MIT License](LICENSE.md).
