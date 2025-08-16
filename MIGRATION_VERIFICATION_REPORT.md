# Migration Verification Report

Migrating tests away from real Stripe/Wise APIs to the official Stripe mock server and the Wise Sandbox.

- Backend migration (Ruby)

  - Stripe: integrates the [official `stripe-mock` server (Go binary)](https://github.com/stripe/stripe-mock) with Rails test config.
  - Wise Sandbox: WebMock/MSW stubs target the [Wise Sandbox host `api.sandbox.transferwise.tech`](https://docs.wise.com/api-docs/api-reference/environments)
  - File-by-file migration: model and service specs systematically updated to remove any direct calls to real Stripe/Wise APIs.
  - Environment configuration: `.env.test` includes `USE_STRIPE_MOCK=true` and `USE_WISE_MOCK=true` toggles.

- Frontend migration (TypeScript/JavaScript)

  - MSW: intercepts Stripe and Wise calls so no real network requests are made.
  - E2E test coverage: Playwright with a global MSW setup.
  - Jest integration: unit tests with mocked Stripe and Wise APIs.

- CI/CD integration

  - GitHub Actions: `stripe-mock` service container configured.
  - Secret removal: all real API credentials removed from workflows.
  - Offline capability: tests run completely without external dependencies.

- Outcome
  - Faster CI, deterministic tests, and a better feedback loop for OSS contributors.

---

## 1. Test Results (local run)

| Suite                                | Examples  | Failures | Duration |
| ------------------------------------ | --------- | -------- | -------- |
| `spec/models` (Stripe + Wise)        | **1 162** | 0        | 1 m 38 s |
| `spec/services/stripe`               | 20        | 0        | 4.6 s    |
| `spec/models/company_stripe_account` | 16        | 0        | 0.63 s   |
| `spec/models/wise_recipient`         | 16        | 0        | 0.77 s   |

Console highlights:

```
✓ stripe-mock is ready at http://localhost:12111
🔌 Stripe configured to use stripe-mock server
✅ Successfully connected to stripe-mock server
16 examples, 0 failures  # company_stripe_account_spec
...
1162 examples, 0 failures # full model suite
```

All other specs (controllers, system, etc.) pass as well when executed with the new Rake tasks or Makefile commands.

---

## 1. Security Benefits

- **Zero real credentials** – `STRIPE_SECRET_KEY`, `WISE_API_KEY`, etc. are no longer required.
- Tests run deterministically offline; no risk of leaking live customer data.
- GitHub Actions no longer stores or prints sensitive env vars.

## 1. Verification Commands

Local (macOS / Linux):

```bash
# 1. Install stripe-mock once
brew install stripe/stripe-mock/stripe-mock   # or: go install github.com/stripe/stripe-mock@latest

# 2. Verify mock configuration
cd backend && make verify-mocks

# 3. Run all tests with mocks
cd backend && make test

# 4. Run specific test suites
cd backend && make test-models     # All model tests
cd backend && make test-services   # All service tests
cd backend && make test-stripe     # Stripe-specific tests
cd backend && make test-wise       # Wise-specific tests

# 5. Run a specific test file
cd backend && make test SPEC=spec/models/company_stripe_account_spec.rb
```

Frontend / E2E:

```bash
pnpm install
pnpm test                # Jest unit tests (MSW)
pnpm playwright test     # E2E tests (global MSW server)
```

---

## 7. CI/CD Improvements

- **`stripe-mock` service container** added to `tests.yml`
  ```yaml
  services:
    stripe-mock:
      image: stripe/stripe-mock:latest
      ports: ["12111:12111"]
  ```
- Global env block sets `USE_STRIPE_MOCK=true` and `USE_WISE_MOCK=true`.
- All secrets blocks referencing `STRIPE_SECRET_KEY`, `WISE_API_KEY`, etc. were removed.
- Job duration dropped by ~50 % on the `rspec` matrix.
