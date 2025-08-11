# Contributing to Flexile

## Pull Requests

1. Update documentation if you're changing behavior
2. Add or update tests for your changes
3. Include screenshots of your test suite passing locally
4. Use native-sounding English in all communication with no excessive capitalization (e.g HOW IS THIS GOING), multiple question marks (how's this going???), grammatical errors (how's dis going), or typos (thnx fr update).
   - ❌ Before: "is this still open ?? I am happy to work on it ??"
   - ✅ After: "Is this actively being worked on? I've started work on it here…"
5. Make sure all tests pass
6. Request a review from maintainers
7. After reviews begin, avoid force-pushing to your branch
   - Force-pushing rewrites history and makes review threads hard to follow
   - Don't worry about messy commits - we squash everything when merging to main
8. Self-review your PR with explanatory comments for any non-intuitive or non-obvious changes to help reviewers understand your reasoning
9. The PR will be merged once you have the sign-off of at least one other developer

## Style Guide

- Follow the existing code patterns
- Use clear, descriptive variable names
- Write TypeScript for frontend code
- Follow Ruby conventions for backend code

## Development Guidelines

### Code Standards

- Always use the latest version of TypeScript, React, and Next.js
- Sentence case headers and buttons and stuff, not title case
- Always write ALL of the code
- Don't apologize for errors, fix them
- Newlines at end of files, always
- No explanatory comments please

### Feature Development

- Add page to `frontend/app/**/page.tsx`
- Add any components to `frontend/components/**/*.tsx`
- Add tRPC API routes to `frontend/trpc/routes/**/index.ts` and then add those to `frontend/trpc/server.ts`
- Create API handlers using tRPC API routes that follow REST principles
- Forms for adding new objects to the database should inherit values from the last object added to the table (e.g., contractor forms should default to the last contractor's values like contractSignedElsewhere, payRateInSubunits, role, etc.)

### Testing Guidelines

**All functional changes require comprehensive test coverage.** Tests are mandatory for models, controllers, services, and user-facing features.

#### Model Specs (Required for all model changes)

- **Location**: `backend/spec/models/`
- **Required coverage**:
  - All associations using `it { is_expected.to have_many(:association) }`
  - All validations using `it { is_expected.to validate_presence_of(:field) }`
  - All callbacks with behavior verification
  - All public methods with various input scenarios
  - Edge cases and error conditions
- **Pattern**: Follow the structure in `backend/spec/models/user_spec.rb`
- **Factories**: Use FactoryBot with traits from `backend/spec/factories/`
- **Run tests**: `bundle exec rspec backend/spec/models/<model_name>_spec.rb`

#### Controller Specs (Required for all controller changes)

- **Location**: `backend/spec/controllers/`
- **Required coverage**:
  - All HTTP endpoints with valid parameters
  - Parameter validation and error responses
  - Authentication and authorization checks
  - Rate limiting and security measures
  - JSON response structure verification
  - HTTP status codes for all scenarios
- **Pattern**: Follow the structure in `backend/spec/controllers/internal/login_controller_spec.rb`
- **Run tests**: `bundle exec rspec backend/spec/controllers/<controller_name>_spec.rb`

#### Service Specs (Required for all service changes)

- **Location**: `backend/spec/services/`
- **Required coverage**:
  - Main business logic with success scenarios
  - Failure scenarios and error handling
  - Side effects (emails, background jobs, database changes)
  - External API interactions (mocked)
  - Edge cases and boundary conditions
- **Pattern**: Follow the structure in `backend/spec/services/approve_invoice_spec.rb`
- **Shared examples**: Use `shared_examples` for common behaviors (see `backend/spec/shared_examples/`)
- **Run tests**: `bundle exec rspec backend/spec/services/<service_name>_spec.rb`

#### E2E Specs (Required for all user-facing changes)

- **Location**: `e2e/tests/`
- **Required coverage**:
  - Critical user flows and navigation
  - Form submissions and validations
  - Authentication flows
  - Error states and user feedback
  - Mobile and desktop responsive behavior
- **Pattern**: Follow the structure in `e2e/tests/login.spec.ts`
- **Factories**: Use TypeScript factories from `e2e/factories/`
- **Best practices**:
  - Avoid `page.waitForTimeout()` - use `waitFor()`, `toBeVisible()`, `toPass()` instead
  - Use the Playwright extension to record tests or pick locators for broken assertions
  - Test both happy path and error scenarios
- **Run tests**: `pnpm playwright test e2e/tests/<test_name>.spec.ts`

#### Testing Conventions

- **Factory usage**: Use `create(:factory_name)` with traits like `create(:user, :contractor)`
- **Shared examples**: Leverage `shared_examples` for common test patterns (see `backend/spec/shared_examples/policy_examples.rb`)
- **RSpec structure**: Organize with `describe` for methods/features and `context` for different scenarios
- **Assertions**: Use specific matchers like `have_enqueued_mail`, `change { Model.count }`, `be_valid`
- **Mocking**: Mock external services and APIs, but test real database interactions

#### Legacy Test Migration

- If migrating from RSpec system tests, delete the old RSpec tests after creating equivalent Playwright tests
- Factories can be created using the RSpec factories in `spec/factories` as reference for `/e2e/factories` folder

#### Test Execution

- **Ruby/Rails**: `bundle exec rspec <path_to_spec>` to verify backend tests
- **TypeScript/Next.js**: `pnpm playwright test <path_to_spec>` to verify e2e tests
- **All tests**: Use `bin/test` to run the full test suite

#### Coverage Requirements

Tests must cover:

- **Happy path**: Expected behavior with valid inputs
- **Edge cases**: Boundary conditions and unusual but valid scenarios
- **Error handling**: Invalid inputs, network failures, authorization errors
- **Regressions**: Any bugs that were previously fixed
- **Side effects**: Database changes, emails sent, jobs enqueued

### Frontend Development

- Do not use `React.FC`. Use the following syntax: `const Component = ({ prop1, prop2 }: { prop1: string; prop2: number }) => { ... }`
- When building UI, use existing components from `frontend/components/` when available: `Button`, `Input`, `DataTable`, `Placeholder`, `ComboBox`, `NumberInput`, `MutationButton`, `Dialog`, `Form` components, etc.

### Database Schema

- Any changes to the database schema via Rails migrations in `backend/db/migrate/` must be reflected in `frontend/db/schema.ts`
- The frontend schema file should be updated to match the Rails schema structure for type safety

### Tech Debt

- Add a `TODO (techdebt)` comment to document refactors that should be made in the future

## Writing Bug Reports

A great bug report includes:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Help

- Check existing discussions/issues/PRs before creating new ones
- Start a discussion for questions or ideas
- Open an [issue](https://github.com/antiwork/flexile/issues) for bugs or problems
- We don't assign issues to contributors until they have a history of contributions to the project

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE.md).
