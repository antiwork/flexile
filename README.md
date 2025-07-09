# Flexile

[![CI](https://github.com/antiwork/flexile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/antiwork/flexile/actions/workflows/ci.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/antiwork/flexile/blob/main/LICENSE.md)

Equity for everyone.

## Setup

You'll need:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (see [`.node-version`](.node-version))

The easiest way to set up the development environment is to use the [`bin/setup` script](bin/setup), but feel free to run the commands in it yourself to:

- Set up Ruby (ideally using `rbenv`/`rvm`) and PostgreSQL
- Install dependencies using `pnpm i` and `cd backend && bundle i`
- Set up your environment by either using `pnpx vercel env pull .env` or `cp .env.example .env` and filling in missing values and your own keys
- Run `cd backend && gem install foreman`

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

## License

Flexile is licensed under the [MIT License](LICENSE.md).
