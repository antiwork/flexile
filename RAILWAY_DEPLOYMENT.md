# Railway Deployment Guide for Flexile

This guide covers deploying Flexile (Rails backend + Next.js frontend) to Railway.

## Prerequisites

1. Railway account: [railway.app](https://railway.app)
2. Railway CLI installed: `npm install -g @railway/cli`
3. Project connected to GitHub repository

## Deployment Architecture

Flexile deploys as a monorepo with:

- **Web Service**: Rails API backend (port 3001 in dev, $PORT in production)
- **Worker Service**: Sidekiq background job processor
- **PostgreSQL Database**: Managed by Railway
- **Redis**: For Sidekiq job queue and caching

## Required Environment Variables

### Core Application

```bash
# Rails Configuration
RAILS_ENV=production
RACK_ENV=production
RAILS_MASTER_KEY=<your-rails-master-key>
SECRET_KEY_BASE=<generate-with-rails-secret>
RAILS_SERVE_STATIC_FILES=true
RAILS_LOG_TO_STDOUT=true

# Database
DATABASE_URL=<provided-by-railway-postgres>

# Redis (for Sidekiq)
REDIS_URL=<provided-by-railway-redis>

# Domain Configuration
DOMAIN=<your-production-domain>
PROTOCOL=https
APP_DOMAIN=<your-production-domain>
```

### Authentication & Security

```bash
# NextAuth
NEXTAUTH_SECRET=<generate-secure-random-string>
NEXTAUTH_URL=https://<your-domain>

# Google OAuth
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# Active Record Encryption
ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=<generate-32-char-key>
ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=<generate-32-char-key>
ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=<generate-32-char-salt>

# API Security
API_SECRET_TOKEN=<generate-secure-token>
```

### Third-Party Services

```bash
# AWS S3 Storage
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
AWS_REGION=<your-aws-region>
S3_PRIVATE_BUCKET=<your-private-s3-bucket>
S3_PUBLIC_BUCKET=<your-public-s3-bucket>

# Stripe Payments
STRIPE_SECRET_KEY=sk_live_<your-stripe-secret-key>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<your-stripe-publishable-key>
STRIPE_ENDPOINT_SECRET=<your-stripe-webhook-secret>

# Email (Resend)
RESEND_API_KEY=<your-resend-api-key>

# Wise Payments
WISE_API_KEY=<your-wise-api-key>
WISE_PROFILE_ID=<your-wise-profile-id>

# Slack Notifications
SLACK_WEBHOOK_URL=<your-slack-webhook-url>
SLACK_WEBHOOK_CHANNEL=<your-slack-channel>
SLACK_TOKEN=<your-slack-bot-token>
SLACK_CHANNEL_ID=<your-slack-channel-id>

# Error Tracking
BUGSNAG_API_KEY=<your-bugsnag-api-key>

# AI Integration
OPENAI_API_KEY=<your-openai-api-key>
HELPER_HMAC_SECRET=<your-helper-hmac-secret>

# Sidekiq Pro (optional)
BUNDLE_GEMS__CONTRIBSYS__COM=<your-sidekiq-pro-token>
```

### Performance & Optimization

```bash
# Node.js
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=2048

# Rails
WEB_CONCURRENCY=2
RAILS_MAX_THREADS=5

# Language/Locale
LANG=en_US.UTF-8
```

## Deployment Steps

### 1. Initial Setup

```bash
# Login to Railway
railway login

# Create new project
railway create flexile-production

# Link to existing repository
railway link
```

### 2. Add Services

```bash
# Add PostgreSQL database
railway add postgresql

# Add Redis
railway add redis

# The main service (web + worker) will be created automatically from your repository
```

### 3. Configure Environment Variables

Set all required environment variables in Railway dashboard or via CLI:

```bash
# Example: Set domain
railway env set DOMAIN=your-app.railway.app

# Set all other variables from the list above
```

### 4. Deploy

```bash
# Deploy from main branch
railway deploy

# Or set up automatic deployments from GitHub
```

## Service Configuration

### Web Process (Rails API)

- **Start Command**: `cd backend && bundle exec rails server -p $PORT -e $RAILS_ENV`
- **Health Check**: `/up` endpoint
- **Port**: Uses Railway's `$PORT` environment variable

### Worker Process (Sidekiq)

- **Start Command**: `cd backend && bundle exec sidekiq -q default -q mailers`
- **Scaling**: Can be scaled independently

### Database Migrations

- Runs automatically on deploy via `release` process in Procfile
- **Command**: `cd backend && bundle exec rails db:migrate`

## Build Process

Railway uses Nixpacks to build the application:

1. **Setup Phase**: Installs Node.js 22, Ruby 3.4, PostgreSQL
2. **Install Phase**: Runs `bundle install` and `pnpm install`
3. **Build Phase**: Generates TypeScript routes and builds Next.js frontend
4. **Start Phase**: Launches Rails server

## Post-Deployment

### 1. Database Setup

```bash
# Run migrations and seed data (if needed)
railway run cd backend && bundle exec rails db:migrate db:seed
```

### 2. Verify Services

- Check web service is responding at your domain
- Verify Sidekiq worker is processing jobs
- Test database connectivity
- Confirm Redis is working for caching

### 3. Domain Configuration

```bash
# Add custom domain
railway domain add your-domain.com

# Update environment variables to match
railway env set DOMAIN=your-domain.com
railway env set NEXTAUTH_URL=https://your-domain.com
```

## Monitoring & Maintenance

### Logs

```bash
# View application logs
railway logs

# Follow logs in real-time
railway logs --follow
```

### Scaling

```bash
# Scale web service
railway scale --service web --replicas 2

# Scale worker service
railway scale --service worker --replicas 1
```

### Environment Management

```bash
# List all environment variables
railway env list

# Update environment variable
railway env set VARIABLE_NAME=new_value
```

## Security Considerations

1. **Secrets**: Never commit secrets to version control
2. **SSL/TLS**: Railway provides automatic HTTPS
3. **Database**: PostgreSQL is managed and secured by Railway
4. **API Keys**: Rotate keys regularly
5. **CORS**: Configure allowed origins in Rails

## Troubleshooting

### Common Issues

1. **Build Failures**: Check nixpacks.toml configuration
2. **Database Connection**: Verify DATABASE_URL is set correctly
3. **Asset Loading**: Ensure RAILS_SERVE_STATIC_FILES=true
4. **Worker Not Processing**: Check Redis connection and Sidekiq logs

### Debug Commands

```bash
# Check service status
railway status

# Access Rails console
railway run cd backend && bundle exec rails console

# Check database
railway run cd backend && bundle exec rails db:version
```

## Cost Optimization

- Use appropriate service sizing
- Monitor resource usage in Railway dashboard
- Consider scaling down non-production environments
- Use database connection pooling (already configured)

## Backup Strategy

- Railway automatically backs up PostgreSQL
- Consider additional S3 backups for critical data
- Export environment variables configuration

---

For more Railway-specific documentation, visit: [docs.railway.app](https://docs.railway.app)
