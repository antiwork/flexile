# Flexile

[![CI](https://github.com/antiwork/flexile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/antiwork/flexile/actions/workflows/ci.yml?query=branch%3Amain)
[![License: Flexile Community License](https://img.shields.io/badge/License-Flexile%20Community-blue.svg)](https://github.com/antiwork/flexile/blob/main/LICENSE.md)

Payroll & equity for everyone.

## Features

- Onboard contractors and employees with custom docs
- Manage regular and one-off invoices
- Process payments globally
- Offer and distribute equity as part of compensation
- Track team performance, updates and absences
- Handle tax compliance
- Integrate with other tools like QuickBooks Online
- Manage your cap table and send company updates to investors

## Table of Contents

- [Setup](#setup)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Setup

### Prerequisites

- [Docker for Desktop](https://docs.docker.com/engine/install/)
- Ruby (version specified in `.ruby-version`)
- Node.js (version specified in `.node-version`)

### Installation

The easiest way to set up the development environment is to use the provided setup script:

```shell
bin/setup
```

This script will:

1. Install Homebrew (if not already installed)
2. Install RVM and the correct Ruby version
3. Install PostgreSQL and create the development database
4. Enable corepack and install pnpm dependencies
5. Install Ruby gems with Bundler
6. Install Foreman for process management
7. Link your Vercel environment and pull environment variables

### Setup custom credentials

Copy `.env.example` to `.env` and fill in the values:

```shell
cp .env.example .env
```

Then edit `.env` with your custom values.

## Running the App

Start the Docker services for local development:

```shell
# In one terminal tab
make local

# Use LOCAL_DETACHED=false make local if you prefer to run Docker services in the foreground
```

Set up the database (if running for the first time) and start the development server:

```shell
# In another terminal tab
rails db:setup # if running for the first time
bin/dev
```

The application will be available at [https://flexile.dev](https://flexile.dev)

### Domain configuration

By default, Flexile uses hardcoded domains:
- Production: app.flexile.com, flexile.com
- Staging: demo.flexile.com
- Development: flexile.dev

You can override these values by setting environment variables in your `.env` file:

```
# Domain Configuration
ROOT_DOMAIN=your-domain.com
APP_DOMAIN=app.your-domain.com
API_DOMAIN=api.your-domain.com
ALLOWED_ORIGINS=app.your-domain.com,your-domain.com
```

For development mode, you can set `DEV_ROOT_DOMAIN`, `DEV_APP_DOMAIN`, etc.

Use the credentials generated during `db:setup` to log in.

### Helper widget

To run the [Helper](https://github.com/antiwork/helper) widget locally, you'll also need to run the Helper app locally. By default, the development environment expects the Helper Next.js server to run on `localhost:3010`. Currently, the Helper host is set to port 3000. You can update the port by modifying `bin/dev` and `apps/nextjs/webpack.sdk.cjs` inside the Helper project to use a different port, such as 3010.

You can update the `HELPER_WIDGET_HOST` in your `.env` file to point to a different host if needed.
The widget performs HMAC validation on the email to confirm it's coming from Gumroad. Update the `helper_widget_secret` in the credentials to match the one used by Helper.

## Testing

```shell
# Run Rails specs
bundle exec rspec # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7 # Run a single spec

# Run Playwright end-to-end tests
pnpm playwright test
```

## Contributing

We welcome contributions to Flexile! Please read our [Contributing Guide](CONTRIBUTING.md) for information on how to get started, coding standards, and more.

Please note that this project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## License

Flexile is licensed under the [Flexile Community License](LICENSE.md).
