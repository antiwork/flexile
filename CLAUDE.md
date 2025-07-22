# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flexile is an equity management platform with the tagline "Equity for everyone." It handles contractor payments, invoice management, equity grants, contract management, and compliance for companies and their workers.

**Tech Stack:**
- **Backend**: Ruby on Rails 8.0.2, PostgreSQL, Redis, Sidekiq
- **Frontend**: Next.js 15 with App Router, TypeScript, Tailwind CSS 4.0
- **Authentication**: Clerk
- **APIs**: tRPC for type-safe client-server communication
- **Database**: PostgreSQL with Drizzle ORM on frontend
- **Background Jobs**: Sidekiq + Inngest workflow engine
- **External Services**: Stripe, Wise, QuickBooks, AWS S3, DocuSeal

## Architecture

### Backend (Rails API)
- **Models**: Core business logic in `backend/app/models/`
- **Controllers**: API endpoints in `backend/app/controllers/`
- **Services**: Business logic in `backend/app/services/`
- **Background Jobs**: Sidekiq jobs in `backend/app/sidekiq/`
- **Policies**: Authorization with Pundit in `backend/app/policies/`
- **Mailers**: Email handling in `backend/app/mailers/`

### Frontend (Next.js)
- **Pages**: App Router pages in `frontend/app/**/page.tsx`
- **Components**: Reusable UI in `frontend/components/**/*.tsx`
- **tRPC Routes**: API routes in `frontend/trpc/routes/**/index.ts`
- **Database**: Schema in `frontend/db/schema.ts`
- **Utils**: Helper functions in `frontend/utils/`

## Development Commands

### Setup
```bash
# Initial setup
./bin/setup

# Start all services
./bin/dev

# Generate TypeScript routes from Rails
pnpm run setup
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- **Required**: Clerk keys, Stripe keys, Wise API credentials
- **Optional**: AWS S3, DocuSeal, Resend, QuickBooks integrations
- **Defaults provided**: Database URLs, Redis URLs, encryption keys

### Backend (Rails)
```bash
cd backend

# Database
./bin/rails db:migrate
./bin/rails db:seed
./bin/rails db:reset

# Testing
bundle exec rspec
bundle exec rspec spec/path/to/specific_spec.rb

# Server
./bin/rails server -p 3000

# Console
./bin/rails console

# Background jobs
bundle exec sidekiq -q default -q mailers

# Code quality
bundle exec rubocop -a
bundle exec erb_lint --lint-all --format compact -a
```

### Frontend (Next.js)
```bash
# Development server
pnpm next dev frontend -H flexile.dev -p 3001

# Type checking
pnpm run typecheck
pnpm run typecheck:watch

# Building
pnpm run build-next

# Linting
pnpm run lint-fast
pnpm eslint --fix --max-warnings 0

# E2E testing
pnpm playwright test
pnpm playwright test path/to/spec.ts
pnpm playwright test --ui  # Interactive UI mode
```

### Test Environment
```bash
# Run full test environment (ports 3100/3101)
./bin/test_server

# Docker services management
make local         # Start local Docker services
make stop_local    # Stop Docker services
```

## Development Guidelines

### Code Style
- Use latest TypeScript, React, and Next.js
- Sentence case for headers/buttons (not title case)
- Newlines at end of files
- No explanatory comments
- Don't use `React.FC` syntax
- Use `TODO (techdebt)` for refactoring notes

### Feature Development
1. **Pages**: Add to `frontend/app/**/page.tsx`
2. **Components**: Add to `frontend/components/**/*.tsx`
3. **API Routes**: Add tRPC routes to `frontend/trpc/routes/**/index.ts` and register in `frontend/trpc/server.ts`
4. **Forms**: Should inherit values from last object added to database
5. **Database**: Schema changes require both Rails migration and Drizzle schema updates

### Testing Requirements
After functional changes:
- **Rails**: Add/update tests in `backend/spec/models/`, `backend/spec/controllers/`, `backend/spec/system/`
- **Frontend**: Add/update e2e tests in `e2e/tests/` using Playwright
- **Coverage**: Happy path, edge cases, error handling
- **Commands**: `bundle exec rspec <path>` for Rails, `pnpm playwright test <path>` for e2e

### Database
- **Rails**: Uses ActiveRecord with PostgreSQL
- **Frontend**: Uses Drizzle ORM with same PostgreSQL database
- **Migrations**: Rails migrations in `backend/db/migrate/`
- **Schema**: Frontend schema in `frontend/db/schema.ts`

## Application Structure

### Core Business Models
- **Companies**: Main tenant with administrators, contractors, investors
- **Invoices**: Contractor billing with approval workflow
- **Payments**: Wise integration for international payments
- **Equity**: Stock options, grants, exercises, buybacks
- **Dividends**: Investor dividend calculations and distributions
- **Contracts**: Legal agreements with DocuSeal integration
- **Compliance**: Tax forms, KYC, regulatory requirements

### Key Services
- **Payment Processing**: Stripe for card payments, Wise for international transfers
- **Document Management**: AWS S3 storage, DocuSeal for signatures
- **Accounting**: QuickBooks integration
- **Email**: Resend for transactional emails
- **Background Processing**: Sidekiq for jobs, Inngest for workflows

## Environment & Tools

### Development Environment
- **HTTPS**: Local development uses `flexile.dev` with SSL certificates
- **Docker**: Services in `docker-compose-local.yml`
- **Process Management**: Foreman with `Procfile.dev`
- **Package Manager**: pnpm (required)
- **Ruby Version**: 3.4.3
- **Node Version**: 22.14.0

### Testing
- **Rails**: RSpec with Factory Bot, Capybara for system tests
- **Frontend**: Playwright for e2e tests
- **Parallel Testing**: Knapsack Pro for Rails specs
- **Test Data**: Factories in `backend/spec/factories/` and `e2e/factories/`
- **CI Environment**: GitHub Actions with PostgreSQL 16.3 and Redis 7.4.2

### Code Quality
- **Ruby**: Rubocop, ERB Lint with auto-fix
- **TypeScript**: ESLint, Prettier with Tailwind plugin
- **Git Hooks**: lint-staged for pre-commit checks
- **Type Safety**: Strict TypeScript, tRPC for API contracts

## Common Patterns

### API Development
- Use tRPC for type-safe APIs between frontend and backend
- Rails provides JSON API endpoints
- Frontend uses TanStack Query for data fetching
- Background jobs for heavy operations

### Error Handling
- Use proper HTTP status codes
- Provide user-friendly error messages
- Log errors with context for debugging
- Handle payment failures gracefully with retry mechanisms

### Security
- Never commit secrets (use environment variables)
- Use Clerk for authentication
- Implement proper authorization with Pundit policies
- Validate all inputs with Zod schemas
- Use HTTPS everywhere

## Debugging

### Common Issues
1. **Postgres User**: May need manual creation if setup fails
2. **Redis Connection**: Re-run `./bin/dev` if Redis fails to start
3. **Type Errors**: Run `pnpm run typecheck` to verify
4. **Payment Failures**: Check Wise credentials and bank account status
5. **Background Jobs**: Monitor Sidekiq queue and retry failed jobs

### Useful Commands
```bash
# Check logs
tail -f backend/log/development.log

# Rails console for debugging
cd backend && ./bin/rails console

# Reset database when corrupted
cd backend && ./bin/rails db:drop db:create db:migrate db:seed

# Check background job status
cd backend && ./bin/rails console
> Sidekiq::Queue.new.size

# Create pull request
make ghpr
```

## Additional Resources

### Seed Data
- Sample company data: `backend/config/data/seed_templates/gumroad.json`
- Run `./bin/rails db:seed` to populate development database

### License
This project is licensed under the MIT License.