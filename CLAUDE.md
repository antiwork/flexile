# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- **Start development server**: `bin/dev` (requires `bin/setup` first)
- **Setup development environment**: `bin/setup` (installs dependencies, creates .env)
- **Stop local services**: `make stop_local`

### Testing
- **Run Rails specs**: `bundle exec rspec --tag '~skip' --tag '~type:system'`
- **Run single Rails spec**: `bundle exec rspec spec/path/to/spec.rb:line_number`
- **Run Playwright e2e tests**: `pnpm playwright test`
- **Start test server**: `bin/test_server` (for Playwright tests)

### Build & Quality
- **Type checking**: `pnpm run typecheck` (requires Rails JS routes generation first)
- **Type checking (watch mode)**: `pnpm run typecheck:watch`
- **Linting**: `pnpm run lint-fast` (ESLint with type checking disabled)
- **Build Next.js**: `pnpm run build-next`
- **Setup JS routes**: `pnpm run setup` (generates TypeScript routes from Rails)

### Database
- **Prepare database**: `cd backend && bin/rails db:prepare`
- **Database reset**: `cd backend && bin/rails db:reset`
- **Create migration**: `cd backend && bin/rails generate migration`

## Architecture

### Monorepo Structure
Flexile is a full-stack application with clear separation between frontend and backend:

- **Backend** (`/backend`): Ruby on Rails API with PostgreSQL, Redis, Sidekiq
- **Frontend** (`/frontend`): Next.js React application with TypeScript
- **E2E Tests** (`/e2e`): Playwright test suite
- **Docker** (`/docker`): Local development containers

### Frontend Architecture
- **Next.js 15**: App router with React Server Components
- **TypeScript**: Strict typing with Drizzle ORM schema mirroring Rails models
- **tRPC**: API client (being migrated away from - avoid new tRPC code)
- **UI Components**: Radix UI primitives with Tailwind CSS styling
- **State Management**: Zustand for client state, React Query for server state

### Backend Architecture
- **Rails 7**: API-only mode with standard MVC patterns
- **Database**: PostgreSQL with extensive migrations
- **Background Jobs**: Sidekiq with Redis
- **Authentication**: Devise with NextAuth.js integration
- **External APIs**: Stripe (payments), Wise (transfers), QuickBooks (accounting)

### Key Domain Models
- **Companies**: Multi-tenant core entity
- **Users**: Authentication with role-based access (administrators, contractors, investors, lawyers)
- **Invoices**: Payment processing with consolidated billing
- **Equity Management**: Stock options, grants, vesting schedules, cap table
- **Dividends**: Distribution calculations and payments
- **Integrations**: QuickBooks sync, external ID mapping

### Development Patterns
- **Database Schema Sync**: Rails migrations must be reflected in `frontend/db/schema.ts`
- **External IDs**: All major entities have `external_id` for API integration
- **Feature Flags**: Boolean flags on Company model control feature availability
- **Multi-currency**: Pay rates stored with currency codes, USD normalization
- **Audit Trail**: PaperTrail versioning on critical models

## Environment Setup

### Requirements
- Node.js 22.14.0 (see package.json engines)
- Ruby (see .ruby-version)
- PostgreSQL (localhost:5432)
- Redis (localhost:6379)

### Local Development
1. Run `bin/setup` to install dependencies and create .env
2. Ensure PostgreSQL and Redis are running locally (default ports 5432 and 6379)
3. Run `bin/dev` to start all services
4. Access app at `http://localhost:3001`
5. Use pre-seeded accounts (password: `password`):
   - Admin: `hi+sahil@example.com`
   - Contractor: `hi+sharang@example.com`
   - Investor: `hi+chris@example.com`

### Testing Configuration
- **Test database**: Separate from development
- **Test server**: Runs on port 3101 (HTTP)
- **Factory data**: E2E factories in `/e2e/factories/`
- **Stripe testing**: Requires valid test customer IDs in factories

## Development Guidelines

### Database Changes
Any Rails migration in `backend/db/migrate/` must update `frontend/db/schema.ts` for type safety.

### API Migration
Moving from tRPC to direct Rails API calls. Avoid writing new tRPC procedures.

### Testing Requirements
Write end-to-end tests for all new functionality. Edit existing tests when possible rather than creating new ones.

### Code Quality
The project uses lint-staged with ESLint, Prettier, RuboCop, and ERB Lint. All commits must pass quality checks.