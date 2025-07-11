# Flexile

[![CI](https://github.com/antiwork/flexile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/antiwork/flexile/actions/workflows/ci.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/antiwork/flexile/blob/main/LICENSE.md)

Equity for everyone.

## Setup

### Prerequisites

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) 22.14.0 (see [`.node-version`](.node-version))
- [Ruby](https://www.ruby-lang.org/en/downloads/) 3.4.3 (see [`.ruby-version`](.ruby-version))
- [pnpm](https://pnpm.io/installation) 10.8.0

### Quick Setup with Makefile

The easiest way to set up the development environment is using the Makefile:

```bash
# Check all system requirements
make check-all

# Install everything and set up the project
make install

# Start development servers
make dev
```

### Manual Setup

Alternatively, you can use the [`bin/setup` script](bin/setup) or run the commands manually:

- Set up Ruby (ideally using `rbenv`/`rvm`) and PostgreSQL
- Install dependencies using `pnpm i` and `cd backend && bundle i`
- Set up your environment by either using `pnpx vercel env pull .env` or `cp .env.example .env` and filling in missing values and your own keys
- Run `cd backend && gem install foreman`

## Running the App

### Using Makefile (Recommended)

```bash
# Start all development servers
make dev

# Start only Docker services (database, redis, nginx)
make local

# Stop all services
make stop_local
```

### Using Scripts

You can also start the local app using the [`bin/dev` script](bin/dev).

Once the local services are up and running, the application will be available at `https://flexile.dev`

Check [the seeds](backend/config/data/seed_templates/gumroad.json) for default data created during setup.

## Makefile Commands

Here are the most important commands available:

### Development
- `make dev` - 🚀 Start all development servers
- `make local` - 🏠 Start local development environment (Docker only)
- `make stop_local` - 🛑 Stop local development environment

### Setup & Installation
- `make install` - 🚀 Complete installation process
- `make check-all` - 🔍 Run all system checks
- `make install-deps` - 📥 Install Node.js and Ruby dependencies

### Code Quality
- `make lint` - 🧹 Run all linters
- `make lint-js` - 📝 Run JavaScript/TypeScript linters
- `make lint-ruby` - 💎 Run Ruby linters
- `make typecheck` - 🔍 Run TypeScript type checking
- `make format` - Format all code with Prettier

### Testing
- `make test` - 🧪 Run all tests
- `make test-backend` - 🧪 Run Rails tests
- `make test-e2e` - 🎭 Run Playwright E2E tests

### Database
- `make db-migrate` - 🔄 Run database migrations
- `make db-seed` - Seed the database
- `make db-reset` - Reset the database
- `make db-console` - Open database console

### Docker
- `make docker-up` - 🐳 Start Docker services
- `make docker-down` - 🛑 Stop Docker services
- `make docker-logs` - 📋 Show Docker service logs
- `make docker-shell-postgres` - 🐘 Open PostgreSQL shell
- `make docker-shell-redis` - 🔴 Open Redis CLI

### Build & Deploy
- `make build` - 🏗️ Build production assets
- `make ghpr` - 🔀 Create a GitHub pull request

### Utilities
- `make clean` - 🧹 Clean all generated files
- `make logs` - Tail development logs
- `make security-check` - 🔐 Run security checks

Run `make help` to see all available commands with descriptions.

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
