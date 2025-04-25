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

You'll need:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (see [`.node-version`](.node-version))

The easiest way to set up the development environment is to use the [`bin/setup` script](bin/setup), but feel free to run the commands in it yourself to:

- Set up Ruby (ideally using `rbenv`/`rvm`) and PostgreSQL
- Install dependencies using `pnpm i` and `cd apps/rails && bundle i`
- Set up your environment by either using `pnpx vercel env pull` or `cp .env.example .env` and filling in missing values and your own keys
- Run `cd apps/rails && gem install foreman && bin/rails db:setup`

## Running the App

You can start the local app using [the `bin/dev` script](bin/dev) - or feel free to run the commands contained in it yourself.

Once the local services are up and running, the application will be available at `https://flexile.dev`

Check [the seeds](apps/rails/config/data/seed_templates/gumroad.json) for default data created during setup.

### Adding shadcn/ui Components

When adding new UI components from [shadcn/ui](https://ui.shadcn.com/) to the `apps/next` workspace, follow these steps due to the use of React 19 and the structure of the monorepo:

1.  Navigate to the Next.js app directory:
    ```shell
    cd apps/next
    ```
2.  The shadcn/ui CLI requires a `package.json` to exist in the directory it runs from. Create a temporary, empty one:
    ```shell
    touch package.json
    ```
    Alternatively: `echo "{}" > package.json`
3.  Run the shadcn/ui CLI using `pnpm dlx` (to avoid global installation), specifying the `@canary` tag for React 19 compatibility:
    ```shell
    pnpm dlx shadcn-ui@canary add <component_name>
    ```
    Replace `<component_name>` with the component you want to add (e.g., `button`, `dialog`).
4.  Clean up the temporary files in apps/next:
    ```shell
    rm package.json
    rm -rf node_modules # Remove if created by the CLI
    ```
    The component files will be added to the appropriate directory (usually `apps/next/components/ui`).

## Testing

```shell
# Run Rails specs
bundle exec rspec # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7 # Run a single spec

# Run Playwright end-to-end tests
pnpm playwright test
```

**Note:** The Playwright tests (`pnpm playwright test`) interact with the running application. If you are currently running the development server using `bin/dev`, you must stop it before executing the Playwright tests. They cannot be run concurrently.

## Contributing

We welcome contributions to Flexile! Please read our [Contributing Guide](CONTRIBUTING.md) for information on how to get started, coding standards, and more.

Please note that this project adheres to a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## License

Flexile is licensed under the [Flexile Community License](LICENSE.md).
