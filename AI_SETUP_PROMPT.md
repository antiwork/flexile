# AI Prompt: Set up Flexile Project

You are tasked with setting up the Flexile project, a full-stack equity management platform with Ruby on Rails 8.0.2 backend and Next.js 15 frontend.

## Quick Setup Steps:

1. **Install Prerequisites**:
```bash
# Install services via Homebrew
brew install postgresql@16 redis rbenv ruby-build
brew services start redis postgresql@16

# Install Ruby 3.4.3
rbenv install 3.4.3 && rbenv global 3.4.3

# Install Node.js and pnpm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc && nvm install 22 && nvm use 22
npm install -g pnpm
```

2. **Database Setup**:
```bash
# Create PostgreSQL user and database
psql postgres -c "CREATE USER username WITH PASSWORD 'password' SUPERUSER CREATEDB;"
psql postgres -c "CREATE DATABASE flexile_development OWNER username;"
```

3. **Project Configuration**:
```bash
# Copy and configure environment
cp .env.example .env

# Edit .env with these essential values:
DATABASE_URL="postgresql://username:password@localhost:5432/flexile_development"
REDIS_URL="redis://localhost:6379/0"
CLERK_PUBLISHABLE_KEY="pk_test_dHJ1c3RpbmctcHVnLTM4LmNsZXJrLmFjY291bnRzLmRldiQ"
STRIPE_PUBLISHABLE_KEY="pk_test_51IePpsSIatPzFeaNubQO9Rk09TBhtUKKm7j9fJc06mbM184SyNSepktTxh6HW89DzRwQBoDgSWp62Dh6QPNOjZu400KLO6zZzv"
BUGSNAG_API_KEY="dummy_key_for_local_development"
```

4. **Install Dependencies & Migrate**:
```bash
pnpm install
cd backend && bundle install && bin/rails db:migrate && cd ..
```

5. **Start Application**:
```bash
./bin/dev
```

**If ./bin/dev fails, start manually**:
```bash
# Terminal 1: cd backend && ./bin/rails s -p 3000
# Terminal 2: pnpm next dev frontend -H localhost -p 3001
```

## Verification:
- Backend: `curl localhost:3000` should return 200
- Frontend: `curl localhost:3001` should return 200
- Browser: http://localhost:3001 shows Flexile landing page

## Common Issues & Fixes:

**PostgreSQL Bootstrap Error**: Usually PostgreSQL is already running. Check with `ps aux | grep postgres`

**Port Conflicts**: `lsof -ti:3000 | xargs kill -9 && lsof -ti:3001 | xargs kill -9`

**Redis Connection Failed**: Verify Redis port is 6379, not 6389 in REDIS_URL

**Bundle Install Fails**: `brew install autoconf automake libtool pkg-config`

**Empty Browser Page**: Hard refresh (Cmd+Shift+R) or try incognito mode

**Environment Variables**: Ensure DATABASE_URL, REDIS_URL, CLERK_PUBLISHABLE_KEY are set

## Success Indicators:
- Rails welcome page on localhost:3000
- Flexile landing page on localhost:3001 with "Contractor payments" hero, features (Invoice Management, Pay Contractors, Equity Options, Contract Management), and pricing "1.5% + $0.50, capped at $15/payment"
- No console errors
- Clerk auth loading properly

The application serves an equity management platform with contractor payments, invoice processing, equity grants, and contract management features. 