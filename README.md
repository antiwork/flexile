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

1. Go to your `Developers` dashboard at [stripe.com](https://stripe.com).
2. Turn on `Test mode`.
3. Go to the `API Keys` tab and copy the Publishable Key into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and Secret Key into `STRIPE_SECRET_KEY` in the .env file.
   ![Stripe Secret Key](https://github.com/user-attachments/assets/0830b226-f2c2-4b92-a28f-f4682ad03ec0)

</details>

<details>
<summary>Wise</summary>

1. Go to [sandbox.transferwise.tech](https://sandbox.transferwise.tech/) and make a brand new Wise account using the register option and following Wise instructions.
2. Once you got your account set up click on your profile.
   ![Wise Sandbox Page](https://github.com/user-attachments/assets/bb8da9f7-a2cc-4c92-906c-a01c62df9870)
3. Copy your Membership number and paste it into `WISE_PROFILE_ID` in the .env file.
   ![Wise Sandbox Profile Settings](https://github.com/user-attachments/assets/790a43be-e41f-47ef-8ef9-05b6c8117cfc)
4. Go to Integrations and Tools and then to API tokens.
5. Create a new API token making sure it is set to Full Access.
6. Reveal the full API key and copy it into `WISE_API_KEY` in the .env file.
   ![Wise Sandbox API Settings](https://github.com/user-attachments/assets/f20be40f-0790-4435-abe6-8077a6c86fc3)

</details>

## License

Flexile is licensed under the [MIT License](LICENSE.md).
