# Quick Start: Deploy Flexile to Railway

This guide gets you up and running on Railway in under 10 minutes.

## Prerequisites

- Railway account: [railway.app](https://railway.app)
- Railway CLI: `npm install -g @railway/cli`

## 1. Automated Setup

Run the setup script to create your Railway project and configure basic settings:

```bash
./bin/railway-setup
```

This script will:

- Create a new Railway project
- Add PostgreSQL and Redis services
- Set up basic environment variables
- Generate secure secrets automatically

## 2. Manual Configuration

After running the setup script, configure these environment variables in the Railway dashboard:

### Required for Basic Functionality

```bash
# Google OAuth (for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_PRIVATE_BUCKET=your-private-bucket
S3_PUBLIC_BUCKET=your-public-bucket

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable
STRIPE_ENDPOINT_SECRET=whsec_your_webhook_secret

# Email
RESEND_API_KEY=re_your_resend_api_key
```

### Optional but Recommended

```bash
# Error tracking
BUGSNAG_API_KEY=your_bugsnag_key

# AI features
OPENAI_API_KEY=sk-your_openai_key
HELPER_HMAC_SECRET=your_helper_secret

# Wise payments
WISE_API_KEY=your_wise_api_key
WISE_PROFILE_ID=your_wise_profile_id

# Slack notifications
SLACK_WEBHOOK_URL=your_slack_webhook
SLACK_TOKEN=xoxb-your_slack_token
SLACK_CHANNEL_ID=your_channel_id
```

## 3. Deploy

```bash
railway deploy
```

## 4. Post-Deployment

1. **Set up database**: Railway will run migrations automatically
2. **Configure domain**: Add your custom domain in Railway dashboard
3. **Test services**: Verify web, worker, and database are running

## Architecture

Your Railway deployment includes:

- **Web Service**: Rails API + Next.js frontend (single service)
- **Worker Service**: Sidekiq background jobs
- **PostgreSQL**: Database
- **Redis**: Job queue and caching

## Troubleshooting

### Common Issues

1. **Build fails**: Check nixpacks.toml and ensure all dependencies are available
2. **Database connection**: Verify DATABASE_URL is automatically set by Railway
3. **Assets not loading**: Ensure RAILS_SERVE_STATIC_FILES=true
4. **Worker not processing**: Check Redis connection and REDIS_URL

### Debug Commands

```bash
# Check deployment status
railway status

# View logs
railway logs --follow

# Access Rails console
railway run cd backend && bundle exec rails console

# Run database migrations manually
railway run cd backend && bundle exec rails db:migrate
```

## Next Steps

- Set up monitoring and alerts
- Configure automatic deployments from GitHub
- Set up staging environment
- Review security settings

For detailed configuration options, see [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md).

## Support

- Railway Docs: [docs.railway.app](https://docs.railway.app)
- Railway Discord: [discord.gg/railway](https://discord.gg/railway)
- Flexile Issues: [GitHub Issues](https://github.com/gumroad/flexile/issues)
