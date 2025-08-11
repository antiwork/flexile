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

Check [the seeds](backend/config/data/seed_templates/gumroad.json) for default data created during setup.

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
# Run Rails specs
bundle exec rspec # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7 # Run a single spec

# Run Playwright end-to-end tests
pnpm playwright test
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
