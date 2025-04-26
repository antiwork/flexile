# Flexile

[![CI](https://github.com/antiwork/flexile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/antiwork/flexile/actions/workflows/ci.yml?query=branch%3Amain)
[![License: Flexile Community License](https://img.shields.io/badge/License-Flexile%20Community-blue.svg)](https://github.com/antiwork/flexile/blob/main/LICENSE.md)

Equity for everyone.

## Setup

You'll need:

- [Docker](https://docs.docker.com/desktop/)
- [Node.js](https://nodejs.org/en/download) (see [`.node-version`](.node-version))

The easiest way to set up the development environment is to use the [`bin/setup` script](bin/setup), but feel free to run the commands in it yourself to:

- Set up Ruby (ideally using `rbenv`/`rvm`) and PostgreSQL
- Install dependencies using `pnpm i` and `cd apps/rails && bundle i`
- Set up your environment by either using `pnpx vercel env pull` or `cp .env.example .env` and filling in missing values and your own keys
- Run `cd apps/rails && gem install foreman && bin/rails db:setup`

## Running the App

You can start the local app using [the `bin/dev` script](bin/dev) - or feel free to run the commands contained in it yourself.

Once the local services are up and running, the application will be available at `https://flexile.dev`

Note: If you have Clerk setup, you can login with hi@example.com / password. Check [the seeds](apps/rails/config/data/seed_templates/gumroad.json) for all the default data created during setup.

Note #2: If you don't see demo data, please run `cd apps/rails && bin/rails db:reset` to seed the data. If this command fails, it's likely due to a flakey part of the code and you can retry it.

## Migrations

Make sure to do this from the `apps/rails` folder:

```
bundle exec rails generate migration AddSlackBotUserIdToCompanies slack_bot_user_id:string
rails db:migrate
```

Then add this to the `apps/next/db/schema.ts` for the Next app to understand:

```
export const companies = pgTable(
  "companies",
  {
    ...
    slackBotUserId: varchar("slack_bot_user_id"),
    ...
  }
```

You can access this in this way:

```
type Company = typeof companies.$inferSelect;
...
export async function handleMessage(event: GenericMessageEvent | AppMentionEvent, company: Company) {
...
company.slackBotUserId
```

## Testing

```shell
# Run Rails specs
bundle exec rspec # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7 # Run a single spec

# Run Playwright end-to-end tests
pnpm playwright test
pnpm playwright test e2e/tests/signup.spec.ts:9 # Run a single test
```

### Slack integration

To test Slack, use (ngrok)[https://ngrok.com] (`brew install ngrok`):

```
ngrok http https://flexile.dev
```

## License

Flexile is licensed under the [Flexile Community License](LICENSE.md).
