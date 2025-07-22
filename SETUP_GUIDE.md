# Flexile Project Setup Guide

## Overview
Flexile is an equity management platform with the tagline "Equity for everyone". It's a full-stack application combining:
- **Backend**: Ruby on Rails 8.0.2 with PostgreSQL
- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Authentication**: Clerk
- **Payments**: Stripe integration
- **Background Jobs**: Sidekiq with Redis
- **API**: tRPC for type-safe API communication

## Core Features
- Contractor payment management
- Invoice processing and approval workflows
- Equity grants and stock options
- Contract management with digital signing
- Investment tracking and management

## Prerequisites Installation

### 1. Install Homebrew (macOS)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Required Services
```bash
# Install PostgreSQL, Redis, and rbenv
brew install postgresql@16 redis rbenv ruby-build

# Start services
brew services start redis
brew services start postgresql@16
```

**Failure Mode**: PostgreSQL fails to start with "Bootstrap failed: 5: Input/output error"
**Solution**: This is often due to existing PostgreSQL processes. Check with `ps aux | grep postgres` - if PostgreSQL is already running, proceed to database setup.

### 3. Install Ruby
```bash
# Install Ruby 3.4.3
rbenv install 3.4.3
rbenv global 3.4.3

# Add to shell profile
echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(rbenv init -)"' >> ~/.zshrc
source ~/.zshrc

# Verify installation
ruby --version  # Should show 3.4.3
```

**Failure Mode**: rbenv not found or Ruby version incorrect
**Solution**: Restart terminal and run `rbenv rehash`, then verify with `which ruby`

### 4. Install Node.js and pnpm
```bash
# Install Node.js (via nvm recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install 22
nvm use 22

# Install pnpm
npm install -g pnpm
```

## Database Setup

### 1. Create PostgreSQL User
```bash
# Connect to PostgreSQL
psql postgres

# Create user and database
CREATE USER username WITH PASSWORD 'password' SUPERUSER CREATEDB;
CREATE DATABASE flexile_development OWNER username;
\q
```

**Failure Mode**: "psql: FATAL: database 'postgres' does not exist"
**Solution**: Try `psql -d template1` or create the postgres database first

### 2. Test Database Connection
```bash
psql -U username -d flexile_development -h localhost
```

## Project Setup

### 1. Navigate to Project Directory
```bash
cd /path/to/flexile
```

### 2. Environment Configuration
```bash
# Copy environment file
cp .env.example .env

# Edit .env file with these minimum required values:
DATABASE_URL="postgresql://username:password@localhost:5432/flexile_development"
REDIS_URL="redis://localhost:6379/0"
CLERK_PUBLISHABLE_KEY="pk_test_dHJ1c3RpbmctcHVnLTM4LmNsZXJrLmFjY291bnRzLmRldiQ"
CLERK_SECRET_KEY="sk_test_[your_clerk_secret_key]"
STRIPE_PUBLISHABLE_KEY="pk_test_51IePpsSIatPzFeaNubQO9Rk09TBhtUKKm7j9fJc06mbM184SyNSepktTxh6HW89DzRwQBoDgSWp62Dh6QPNOjZu400KLO6zZzv"
STRIPE_SECRET_KEY="sk_test_[your_stripe_secret_key]"
BUGSNAG_API_KEY="dummy_key_for_local_development"
```

**Failure Mode**: Invalid API keys causing authentication errors
**Solution**: Ensure Clerk and Stripe keys are valid test keys. Use dummy values for development if needed.

### 3. Install Dependencies
```bash
# Install frontend dependencies
pnpm install

# Install backend dependencies
cd backend
bundle install
cd ..
```

**Failure Mode**: Bundle install fails with gem compilation errors
**Solution**: Install build tools: `brew install autoconf automake libtool pkg-config`

### 4. Database Migration
```bash
cd backend
bin/rails db:create db:migrate
```

**Failure Mode**: Migration fails with connection errors
**Solution**: Verify PostgreSQL is running and DATABASE_URL is correct

### 5. Seed Database (Optional)
```bash
bin/rails db:seed
```

**Note**: This may fail due to missing API keys, which is expected in development.

## Running the Application

### 1. Start All Services
```bash
# From project root
./bin/dev
```

This starts:
- Rails server on port 3000
- Next.js frontend on port 3001
- Sidekiq background worker
- TypeScript compiler in watch mode
- Inngest background jobs

### 2. Alternative: Manual Start
If `./bin/dev` fails, start services manually:

```bash
# Terminal 1: Rails
cd backend && ./bin/rails s -p 3000

# Terminal 2: Next.js
pnpm next dev frontend -H localhost -p 3001

# Terminal 3: Sidekiq (optional)
cd backend && bundle exec sidekiq
```

## Verification

### 1. Test Backend
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
# Should return: 200
```

### 2. Test Frontend
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
# Should return: 200
```

### 3. Browser Access
- Frontend: http://localhost:3001
- Backend: http://localhost:3000

## Common Failure Modes & Solutions

### Redis Connection Issues
**Error**: "Redis connection failed"
**Solution**: 
1. Check Redis is running: `brew services list | grep redis`
2. Verify Redis port: Redis should be on port 6379, not 6389
3. Update REDIS_URL in .env if needed

### Port Conflicts
**Error**: "Port already in use"
**Solution**:
```bash
# Kill processes on specific ports
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### Rails Asset Compilation Issues
**Error**: Rails assets failing to compile
**Solution**: 
```bash
cd backend
bin/rails assets:precompile
```

### PostgreSQL Connection Issues
**Error**: "could not connect to server"
**Solution**:
1. Check if PostgreSQL is running: `ps aux | grep postgres`
2. If not running, try: `brew services restart postgresql@16`
3. Verify user permissions: User must have SUPERUSER and CREATEDB privileges

### Environment Variable Issues
**Error**: "Missing required environment variable"
**Solution**: Ensure all required variables are set in .env:
- DATABASE_URL
- REDIS_URL  
- CLERK_PUBLISHABLE_KEY
- STRIPE_PUBLISHABLE_KEY

### TypeScript Compilation Errors
**Error**: TypeScript compilation failures
**Solution**:
```bash
# Clear Next.js cache
rm -rf frontend/.next
pnpm run typecheck
```

### Browser Shows Empty Page
**Error**: Frontend loads but shows blank page
**Solution**:
1. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Try incognito/private browsing mode
3. Check browser console for errors
4. Verify API keys are properly set

## Project Structure Overview

```
flexile/
├── backend/          # Rails 8.0.2 application
│   ├── app/         # Rails app structure
│   ├── config/      # Configuration files
│   ├── db/          # Database migrations and schema
│   └── spec/        # RSpec tests
├── frontend/        # Next.js 15 application
│   ├── app/         # App router pages
│   ├── components/  # React components
│   ├── trpc/        # tRPC API routes
│   └── utils/       # Utility functions
├── e2e/            # Playwright end-to-end tests
└── bin/dev         # Development startup script
```

## Development Workflow

1. **Adding Features**: 
   - Frontend pages: `frontend/app/**/page.tsx`
   - Components: `frontend/components/**/*.tsx`
   - API routes: `frontend/trpc/routes/**/index.ts`

2. **Database Changes**:
   ```bash
   cd backend
   bin/rails generate migration YourMigrationName
   bin/rails db:migrate
   ```

3. **Running Tests**:
   ```bash
   # Backend tests
   cd backend && bundle exec rspec
   
   # Frontend tests
   pnpm playwright test
   ```

## Troubleshooting Commands

```bash
# Check all services status
brew services list
ps aux | grep -E "(rails|node|sidekiq|postgres|redis)"

# View logs
tail -f backend/log/development.log
tail -f ~/.pnpm-state.log

# Reset everything
brew services restart postgresql@16
brew services restart redis
killall -9 foreman ruby node
./bin/dev
```

## Success Indicators

When everything is working correctly, you should see:
1. Rails server responding on http://localhost:3000 (returns Rails welcome page)
2. Next.js frontend on http://localhost:3001 showing Flexile landing page with:
   - Navigation bar with Login/Signup buttons
   - Hero section: "Contractor payments"
   - Features: Invoice Management, Pay Contractors, Equity Options, Contract Management
   - Pricing: "1.5% + $0.50, capped at $15/payment"
   - Footer with Privacy/Terms links
3. No console errors in browser developer tools
4. Clerk authentication system loading properly

The application is now ready for development and testing. 