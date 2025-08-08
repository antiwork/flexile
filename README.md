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

**Step 1: Create a Stripe Account**

1. Go to [stripe.com](https://stripe.com) and click "Start now" or "Sign up"
2. Enter your email address and create a password
3. Complete the account verification process

**Step 2: Access Your Dashboard**

1. Once logged in, you'll be taken to your Stripe Dashboard
2. Make sure you're in **Test mode** (toggle should be ON in the top right)
3. If not in test mode, click the toggle to switch to test mode

**Step 3: Get Your API Keys**

1. In the left sidebar, click on "Developers"
2. Click on "API keys" from the submenu
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_`): Copy this value
   - **Secret key** (starts with `sk_test_`): Click "Reveal" then copy this value

**Step 4: Add to Environment File**

1. Open your `.env` file in the project root
2. Add the following variables:
   ```
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
   STRIPE_SECRET_KEY=sk_test_your_secret_key_here
   ```

</details>

<details>
<summary>Wise</summary>

**Step 1: Create a Wise Sandbox Account**

1. Go to [sandbox.transferwise.tech](https://sandbox.transferwise.tech/)
2. Click "Register" in the top right corner
3. Enter your email address and follow the registration process
4. Complete email verification and set up your account password
5. Fill in your personal details as prompted (use test data for sandbox)

**Step 2: Access Your Profile Information**

1. Once logged in to your sandbox account, click on your profile/avatar in the top right
2. Go to "Settings" or "Profile settings"
3. Find your **Membership number** or **Profile ID**
4. Copy this number (it will be used for `WISE_PROFILE_ID`)

**Step 3: Generate API Token**

1. In your account settings, look for "Integrations and Tools" or "API tokens"
2. Click "Create API token" or "Generate new token"
3. Set the token permissions to **Full Access** (required for transfers)
4. Give your token a descriptive name (e.g., "Flexile Development")
5. Click "Create token"
6. **Important**: Copy the full API token immediately - you won't be able to see it again

**Step 4: Add to Environment File**

1. Open your `.env` file in the project root
2. Add the following variables:
   ```
   WISE_PROFILE_ID=your_membership_number_here
   WISE_API_KEY=your_full_api_token_here
   ```

**Note**: Keep your API credentials secure and never commit them to version control.

</details>

## License

Flexile is licensed under the [MIT License](LICENSE.md).
