<p align="center">
  <picture>
    <img src="https://github.com/antiwork/flexile/blob/main/frontend/public/icon-192.png" alt="Flexile Logo">
  </picture>
</p>

# Flexile

[![CI](https://github.com/antiwork/flexile/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/antiwork/flexile/actions/workflows/ci.yml?query=branch%3Amain)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/antiwork/flexile/blob/main/LICENSE.md)

Contractor payments as easy as 1-2-3.

## Setup

> **⚠️ Warning:**  
> We highly recommend using either a MacOS system or a Linux distribution for setting up Flexile on your machine. Using Windows and WSL is known to cause a lot of issues that are hard to debugg. If you are using Windows, consider setting up an instance of Linux distro via tools like [VirtualBox](https://Virtualbox.org).

### Before installation you'll need:

- [Docker](https://docs.docker.com/engine/install/)
- [Node.js](https://nodejs.org/en/download) (set Node.js version from [`.node-version`](.node-version) using [nvm](https://github.com/nvm-sh/nvm))

### Installation

We are working on a [`bin/setup`](bin/setup) script. For now, please follow the list of things you need to do in order to create your own local setup:

<details>
<summary>Homebrew</summary>

Follow official [Homebrew documentation](https://brew.sh/) for installation.

</details>

<details>
<summary>Ruby</summary>

Set up [rbenv](https://github.com/rbenv/rbenv) using Homebrew and set the version to the one in [.ruby-version](https://github.com/antiwork/flexile/blob/main/.ruby-version) file.

```shell
rbenv install $(cat .ruby-version)
rbenv local $(cat .ruby-version)
rbenv rehash
```

</details>

<details>
<summary>Bundler and Foreman</summary>

Run `cd backend && gem install bundler foreman`

</details>

<details>
<summary>Mkcert</summary>

Next.js automatically downloads binaries of mkcert.js when running the app, but you need additional libraries if you are on Linux. 

If you encounter issues related to SSL it is a good idea to install Mkcert locally to debug further.

Refer to [mkcert documentation](https://github.com/FiloSottile/mkcert) for more information.

</details>

<details>
<summary>Dependencies</summary>

Install dependencies using `pnpm i` and then `cd backend && bundle i`

</details>

<details>
<summary>Environment variables</summary>

#### Antiwork Team member

If you are an Antiwork team member you can pull .env file by using `pnpx vercel env pull .env`

#### Other contributors

`cp .env.example .env` then fill in missing values and your own keys. A guide on how to set the nescessary ones is in [Services Configuration](#services-configuration).

</details>

### Issues during setup

If you encounter any issues during your setup check out [Common Issues and Debugging](#common-issues-and-debugging) for additional help.

## Running the App

You can start the local app using the [`bin/dev`](bin/dev) script or feel free to run the commands contained in it yourself.

Once the local services are up and running, the application will be available at `https://flexile.dev`

Check [the seeds](backend/config/data/seed_templates/gumroad.json) for default data created during setup.

## Common Issues and Debugging

Running `make local` before running `bin/dev` helps with a lot of issues.

<details>
<summary>Postgres User Creation</summary>

**Issue:** When running `bin/dev` (after `bin/setup`) encountered `FATAL: role "username" does not exist`

**Resolution:** The PostgreSQL user should be created automatically in the Docker container. If you still encounter this issue, manually create the user in the Docker PostgreSQL instance:

```
docker exec flexile-db-1 psql -U username -d postgres -c "CREATE USER username WITH LOGIN CREATEDB SUPERUSER PASSWORD 'password';"
```

This targets the Docker PostgreSQL instance rather than any local installation.

</details>

<details>
<summary>Redis Connection & database seeding</summary>

**Issue:** First attempt to run `bin/dev` failed with `Redis::CannotConnectError` on port 6389.

**Resolution:** Run `make local` first then re-run `bin/dev`. If the data is not seeded properly, run `db:reset` and then re-run.

</details>

## Testing

```shell
# Run Rails specs
bundle exec rspec # Run all specs
bundle exec rspec spec/system/roles/show_spec.rb:7 # Run a single spec

# Run Playwright end-to-end tests
pnpm playwright test
```

### Services configuration

<details>
<summary>Clerk</summary>

1. Go to [clerk.com](https://clerk.com) and create a new app.
2. Name it whatever you like and **disable all login methods except Email Addres and Google**.
   ![Clerk Sanbox Creation](https://github.com/user-attachments/assets/8d69def9-b55e-4103-9ae9-324549a2e2b5)
3. Once created, copy the Publishable Key into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and Secret Key into `CLERK_SECRET_KEY` in the .env file.
   ![Clerk Env Variables](https://github.com/user-attachments/assets/df3381e6-017a-4e01-8bd3-5793e5f5d31e)

</details>

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
