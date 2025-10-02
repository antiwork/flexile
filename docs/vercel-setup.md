# Vercel Setup Guide

This guide covers deploying the Flexile frontend to Vercel while keeping the Rails backend on Railway.

## Architecture

- **Frontend (Next.js)**: Deployed to Vercel
- **Backend (Rails API)**: Deployed to Railway
- **Database & Redis**: Railway
- **Worker (Sidekiq)**: Railway

## Prerequisites

1. Vercel account: [vercel.com](https://vercel.com)
2. Vercel CLI: `pnpm add -g vercel`
3. Railway backend already deployed

## Setup Steps

### 1. Install Vercel CLI

```bash
pnpm add -g vercel
```

### 2. Login to Vercel

```bash
vercel login
```

### 3. Link Your Repository

```bash
# From project root
vercel link
```

When prompted:
- **Set up and deploy**: Y
- **Which scope**: Select your account
- **Link to existing project**: N (first time)
- **Project name**: flexile
- **In which directory is your code located**: `./frontend`

### 4. Configure Environment Variables

#### Via Vercel Dashboard

Go to your project settings: `https://vercel.com/[your-username]/flexile/settings/environment-variables`

**Production Environment Variables:**

```bash
# Backend API URL (your Railway backend)
NEXT_PUBLIC_API_URL=https://flexile-production.up.railway.app

# NextAuth
NEXTAUTH_URL=https://flexile.vercel.app
NEXTAUTH_SECRET=your_nextauth_secret

# Google OAuth (same as Railway)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Stripe (production)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_SECRET_KEY=sk_live_your_key

# Database (Railway Postgres URL)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Other configs
NODE_ENV=production
DOMAIN=flexile.vercel.app
APP_DOMAIN=flexile.vercel.app
PROTOCOL=https
```

**Preview Environment Variables (for PR previews):**

Same as above but with:
```bash
# Use Railway staging backend for previews
NEXT_PUBLIC_API_URL=https://flexile-staging.up.railway.app

# Use Stripe test keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
```

#### Via CLI

```bash
# Set production variable
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://flexile-production.up.railway.app

# Set preview variable (for PR previews)
vercel env add NEXT_PUBLIC_API_URL preview
# Enter: https://flexile-staging.up.railway.app

# Set development variable
vercel env add NEXT_PUBLIC_API_URL development
# Enter: http://localhost:3001
```

### 5. Configure Vercel Project Settings

In `vercel.json` (already created):
- Build command points to frontend directory
- Framework detection: Next.js
- Output directory: `frontend/.next`

### 6. Update Backend CORS Settings

Your Rails backend needs to allow requests from Vercel:

**In `backend/config/initializers/cors.rb`** (or create it):

```ruby
# config/initializers/cors.rb
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(
      'https://flexile.vercel.app',
      'https://*.vercel.app', # All Vercel preview deployments
      /https:\/\/flexile-.*\.vercel\.app/, # PR previews
      'http://localhost:3000', # Local development
      ENV['DOMAIN'],
      ENV['APP_DOMAIN']
    ).compact

    resource '*',
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true,
      expose: ['Authorization']
  end
end
```

**Add to `backend/Gemfile`:**

```ruby
gem 'rack-cors'
```

Then redeploy Railway backend:
```bash
git add backend/Gemfile backend/config/initializers/cors.rb
git commit -m "Add CORS support for Vercel frontend"
git push origin main
```

### 7. Deploy to Vercel

#### Manual Deploy

```bash
# Deploy to production
vercel --prod

# Deploy to preview
vercel
```

#### Automatic Deployments (Recommended)

1. Go to Vercel dashboard
2. Connect your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `pnpm install && pnpm build`
   - **Output Directory**: `.next`
   - **Install Command**: `pnpm install --frozen-lockfile`

4. **Automatic Deployments**:
   - **Production**: Deploys when you push to `main`
   - **Preview**: Deploys for every PR automatically
   - **Development**: Local development

### 8. Configure Custom Domain (Optional)

1. Go to Vercel project → Settings → Domains
2. Add your custom domain (e.g., `app.yourdomain.com`)
3. Update DNS records as instructed
4. Update environment variables:
   ```bash
   NEXTAUTH_URL=https://app.yourdomain.com
   DOMAIN=app.yourdomain.com
   ```

## Preview Deployments

Vercel automatically creates preview deployments:

**Workflow:**
1. Create feature branch: `git checkout -b feature/new-feature`
2. Push to GitHub: `git push origin feature/new-feature`
3. Create PR → Vercel automatically:
   - Creates preview deployment
   - Comments on PR with preview URL
   - Uses preview environment variables (staging backend)
4. Every push to PR updates the preview
5. Merge PR → Deploys to production

**Preview URL format:**
- `https://flexile-[branch-name]-[your-username].vercel.app`
- Or unique hash: `https://flexile-git-[branch]-[your-username].vercel.app`

## Testing Workflow

### Option 1: Full Stack Testing (Both Platforms)

```bash
# 1. Push feature branch
git push origin feature/my-feature

# 2. Railway creates preview for backend (if enabled)
# → https://flexile-pr-123.up.railway.app

# 3. Vercel creates preview for frontend
# → https://flexile-feature-my-feature.vercel.app
# → Points to Railway staging backend

# 4. Test frontend preview
# 5. Merge → Both deploy to production
```

### Option 2: Frontend-Only Testing

```bash
# 1. Push branch → Vercel creates preview
# 2. Preview uses Railway staging backend
# 3. Test only frontend changes quickly
# 4. Merge when ready
```

## Environment Strategy

| Environment | Frontend (Vercel) | Backend (Railway) | Purpose |
|-------------|------------------|-------------------|---------|
| **Production** | `flexile.vercel.app` | `flexile-production.up.railway.app` | Live app |
| **Staging** | `flexile-git-staging.vercel.app` | `flexile-staging.up.railway.app` | Pre-production testing |
| **Preview** | `flexile-pr-*.vercel.app` | `flexile-staging.up.railway.app` | PR previews (frontend points to staging backend) |
| **Development** | `localhost:3000` | `localhost:3001` | Local dev |

## Monitoring & Debugging

### Vercel Logs

```bash
# View deployment logs
vercel logs [deployment-url]

# View function logs (API routes)
vercel logs --follow
```

### Vercel Dashboard

- **Analytics**: Real-time visitor analytics
- **Speed Insights**: Web Vitals and performance metrics
- **Deployment History**: All deployments with rollback capability

## Cost Considerations

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Unlimited previews
- 6,000 build minutes/month
- Perfect for most projects

**Railway:**
- Backend, database, Redis, and workers
- Pay for what you use

**Total Cost**: Very affordable, potentially free on Vercel's hobby plan

## Troubleshooting

### Issue: CORS Errors

**Solution**: Ensure `rack-cors` is configured properly and Vercel domains are whitelisted

```ruby
# Check backend/config/initializers/cors.rb includes:
origins 'https://*.vercel.app'
```

### Issue: Environment Variables Not Loading

**Solution**:
1. Check variable is set for correct environment (production/preview/development)
2. Rebuild deployment: `vercel --prod --force`

### Issue: Build Fails on Vercel

**Solution**:
1. Check `vercel.json` root directory is `frontend`
2. Ensure `pnpm-lock.yaml` is committed
3. Check build logs for specific errors

### Issue: Preview Points to Production Backend

**Solution**: Set preview environment variables to use staging backend:
```bash
vercel env add NEXT_PUBLIC_API_URL preview
# Enter: https://flexile-staging.up.railway.app
```

## Comparison: Vercel vs Railway for Frontend

| Feature | Vercel | Railway (Current) |
|---------|--------|-------------------|
| Next.js Optimization | ⭐⭐⭐⭐⭐ Native | ⭐⭐⭐ Good |
| Edge Network | ⭐⭐⭐⭐⭐ Global | ⭐⭐⭐ Regional |
| Preview Deployments | ⭐⭐⭐⭐⭐ Automatic | ⭐⭐⭐⭐⭐ Automatic |
| Analytics | ⭐⭐⭐⭐⭐ Built-in | ⭐⭐ Manual |
| Setup Complexity | ⭐⭐⭐ Medium | ⭐⭐⭐⭐⭐ Simple (monorepo) |
| Cost | ⭐⭐⭐⭐⭐ Free tier | ⭐⭐⭐⭐ Pay-as-you-go |
| Monorepo Support | ⭐⭐⭐ Requires config | ⭐⭐⭐⭐⭐ Native |

## Recommendation

**Use Vercel if:**
- You want best Next.js performance
- You need built-in analytics
- You prefer separate frontend/backend deployments
- You want the free tier

**Keep Railway if:**
- You prefer simple monorepo deployment
- You want everything in one place
- Current setup works well for you

**Best of Both Worlds:**
- Deploy frontend to Vercel (performance + analytics)
- Keep backend on Railway (easier full-stack deployment)
- Get automatic previews on both platforms

## Next Steps

1. **Test Vercel locally**: `vercel dev`
2. **Deploy to preview**: `vercel`
3. **Deploy to production**: `vercel --prod`
4. **Set up automatic deployments**: Connect GitHub in Vercel dashboard
5. **Monitor**: Check Vercel Analytics and Speed Insights

## Further Reading

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Preview Deployments](https://vercel.com/docs/concepts/deployments/preview-deployments)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

