# Setting Up Test/Staging Environment

This guide covers setting up a test/staging environment in Railway before deploying to production.

## Railway Staging Environment Setup

Railway supports multiple environments within a single project, allowing you to test changes before pushing to production.

### 1. Create a Staging Environment

You can create a staging environment in two ways:

#### Option A: Via Railway CLI

```bash
# Make sure you're in your project directory
cd /path/to/flexile

# Link to your Railway project (if not already linked)
railway link

# Create a new staging environment
railway environment create staging

# Switch to the staging environment
railway environment use staging
```

#### Option B: Via Railway Dashboard

1. Go to your Railway project dashboard
2. Click on "Environments" in the sidebar
3. Click "New Environment"
4. Name it "staging" or "test"
5. Choose whether to copy variables from production (recommended)

### 2. Configure Staging Environment Variables

After creating the staging environment, set environment-specific variables:

```bash
# Switch to staging environment
railway environment use staging

# Set staging-specific domain
railway env set DOMAIN=flexile-staging.railway.app
railway env set APP_DOMAIN=flexile-staging.railway.app
railway env set NEXTAUTH_URL=https://flexile-staging.railway.app

# Use test/sandbox credentials for external services
railway env set STRIPE_SECRET_KEY=sk_test_...
railway env set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
railway env set STRIPE_ENDPOINT_SECRET=whsec_test_...

# You may want to use different S3 buckets for staging
railway env set S3_PRIVATE_BUCKET=flexile-staging-private
railway env set S3_PUBLIC_BUCKET=flexile-staging-public

# Optional: Use a different database/redis for complete isolation
# (Railway will create new instances if you add them to staging environment)
```

### 3. Add Services to Staging Environment

```bash
# Add PostgreSQL for staging
railway add postgresql --environment staging

# Add Redis for staging
railway add redis --environment staging
```

### 4. Deploy to Staging

```bash
# Deploy current branch to staging
railway deploy --environment staging

# Or set up automatic deployments from a specific branch (e.g., develop)
# This is done in Railway dashboard > Settings > Deployments
```

### 5. Set Up Automatic PR Preview Deployments

Railway can automatically create preview deployments for each Pull Request:

1. Go to Railway dashboard > Settings > Deployments
2. Enable "PR Deploys" or "Preview Deployments"
3. Configure which branches trigger preview deployments
4. Each PR will get its own temporary environment with a unique URL

#### Configure in your repository:

Add a `.github/workflows/railway-preview.yml` (optional, Railway does this automatically):

```yaml
name: Railway Preview
on:
  pull_request:
    branches: [main]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        run: echo "Railway automatically handles PR previews"
```

### 6. Testing Workflow

**Before pushing to main:**

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. **Make your changes and commit:**
   ```bash
   git add .
   git commit -m "Add new feature"
   ```

3. **Push to your branch:**
   ```bash
   git push origin feature/my-new-feature
   ```

4. **Create a Pull Request on GitHub:**
   - Railway will automatically create a preview deployment
   - You'll get a unique URL to test your changes
   - Or manually deploy to staging:
     ```bash
     railway deploy --environment staging
     ```

5. **Test thoroughly on staging/preview:**
   - Verify all functionality works
   - Run your e2e tests against the staging URL
   - Check integrations (Stripe, S3, etc.)

6. **Once testing passes, merge to main:**
   - The main branch will automatically deploy to production

### 7. Run E2E Tests Against Staging

Update your test configuration to run against staging:

```bash
# In your e2e tests, use environment variable for base URL
PLAYWRIGHT_BASE_URL=https://flexile-staging.railway.app pnpm test:e2e
```

Or create a script in `package.json`:

```json
{
  "scripts": {
    "test:e2e:staging": "PLAYWRIGHT_BASE_URL=https://flexile-staging.railway.app playwright test",
    "test:e2e:production": "PLAYWRIGHT_BASE_URL=https://your-production-domain.com playwright test"
  }
}
```

### 8. Environment Management Best Practices

**Use these environment naming conventions:**

- `production` - Live production environment
- `staging` - Pre-production testing environment
- `preview-*` - Automatic PR preview environments (managed by Railway)
- `development` - Optional dedicated development environment

**Database considerations:**

- **Isolated databases**: Each environment has its own PostgreSQL/Redis instance (recommended)
- **Shared database**: Use different database names within same instance (cost-effective but riskier)

**Secrets management:**

- Use test/sandbox API keys in staging
- Never use production API keys in non-production environments
- Store secrets securely in Railway's environment variables

### 9. Monitoring and Debugging

**View staging logs:**
```bash
railway logs --environment staging --follow
```

**Access staging Rails console:**
```bash
railway run --environment staging cd backend && bundle exec rails console
```

**Check staging deployment status:**
```bash
railway status --environment staging
```

### 10. Cost Optimization

- Railway charges per environment, so consider:
  - Use PR previews for quick testing (they auto-cleanup)
  - Keep staging running only when needed
  - Use smaller database instances for staging
  - Consider pausing staging environment when not in use

## Vercel Alternative (Frontend Only)

If you want to test only the Next.js frontend on Vercel:

### 1. Connect Repository to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login and link project
vercel login
vercel link
```

### 2. Configure Vercel Environments

Vercel automatically creates:
- **Production**: Deploys from `main` branch
- **Preview**: Deploys from all other branches and PRs
- **Development**: Local development

### 3. Set Environment Variables

In Vercel dashboard:
1. Go to Settings > Environment Variables
2. Add variables for each environment (Production, Preview, Development)
3. Set your backend API URL for each environment

**Note:** Vercel is best for frontend-only testing. For full-stack testing (Rails backend + frontend), use Railway environments.

## Recommended Workflow

1. **Local development** → Test locally with `bin/dev`
2. **Create PR** → Railway auto-creates preview deployment
3. **Test on preview** → Verify functionality on preview URL
4. **Merge to staging branch** (optional) → Deploy to staging environment
5. **Final verification on staging** → Run full e2e test suite
6. **Merge to main** → Automatic deploy to production

## Troubleshooting

**Issue: Preview deployments not creating**
- Check Railway dashboard > Settings > Deployments
- Ensure PR Deploys are enabled
- Verify GitHub integration is connected

**Issue: Environment variables missing**
- Use `railway env list --environment staging` to check
- Copy from production: Create environment with "Copy variables from production" option

**Issue: Database not accessible in staging**
- Ensure PostgreSQL service is added to staging environment
- Check DATABASE_URL is set correctly
- Verify migrations ran: `railway run --environment staging cd backend && bundle exec rails db:migrate`

## Further Reading

- [Railway Environments Documentation](https://docs.railway.app/deploy/environments)
- [Railway PR Deployments](https://docs.railway.app/deploy/deployments#pull-request-deployments)
- [Vercel Preview Deployments](https://vercel.com/docs/concepts/deployments/preview-deployments)

