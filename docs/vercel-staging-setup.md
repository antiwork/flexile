# Vercel Staging Environment Setup

Your app architecture:
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Rails API)

## Quick Setup

### 1. Configure Vercel Environment Variables

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

#### For Production (main branch):
```bash
NEXT_PUBLIC_API_URL=https://flexile-production.up.railway.app
NEXTAUTH_URL=https://flexile-brown-nine.vercel.app
# ... other production vars
```

#### For Preview (all other branches - INCLUDING staging):
```bash
NEXT_PUBLIC_API_URL=https://flexile-staging.up.railway.app
NEXTAUTH_URL=https://flexile-git-staging-johnarndts-projects.vercel.app
# ... other staging/test vars
```

### 2. Testing Workflow

#### Option A: PR Preview Deployments (Easiest)

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Push to GitHub
git push origin feature/my-feature

# 3. Create PR
# → Vercel automatically creates preview deployment
# → Preview URL: flexile-pr-123-johnarndts-projects.vercel.app
# → Uses Preview environment variables (staging backend!)

# 4. Test on preview URL
# 5. Merge to main → Deploys to production
```

#### Option B: Staging Branch

```bash
# 1. Create staging branch
git checkout -b staging
git push origin staging

# 2. In Vercel Dashboard:
# → Settings → Git → Add Branch: staging
# → staging branch auto-deploys to a staging URL

# 3. Test features on staging branch first
git checkout staging
git merge feature/my-feature
git push origin staging

# 4. Test on: flexile-git-staging-johnarndts-projects.vercel.app
# 5. If good, merge staging to main
```

### 3. Current URLs

- **Production**: `flexile-brown-nine.vercel.app` (or custom domain)
- **Preview/Staging**: Auto-generated for each branch/PR
- **Railway Backend Production**: `flexile-production.up.railway.app` (API only)
- **Railway Backend Staging**: `flexile-staging.up.railway.app` (API only)

## How It Works

```
┌─────────────────────────────────────────┐
│  Vercel (Frontend)                      │
│  ├─ Production: main branch             │
│  │   → Points to Railway production API │
│  ├─ Staging: staging branch (optional)  │
│  │   → Points to Railway staging API    │
│  └─ Preview: PR branches                │
│      → Points to Railway staging API    │
└─────────────────────────────────────────┘
           ↓ API calls
┌─────────────────────────────────────────┐
│  Railway (Backend)                      │
│  ├─ Production: main branch             │
│  │   Database, Redis, Workers           │
│  ├─ Staging: staging environment        │
│  │   Separate DB, Redis, Workers        │
│  └─ Preview: PR environments (optional) │
│      Separate instances                 │
└─────────────────────────────────────────┘
```

## Set Environment Variables Now

1. Go to: https://vercel.com/johnarndts-projects/flexile/settings/environment-variables

2. Add for **Preview** environment:
   - `NEXT_PUBLIC_API_URL` = `https://flexile-staging.up.railway.app`
   - This makes ALL PR previews use the staging backend!

3. Add for **Production** environment:
   - `NEXT_PUBLIC_API_URL` = `https://flexile-production.up.railway.app`
   - Main branch uses production backend

## Test It Now

```bash
# Push any branch to test
git checkout -b test-vercel-staging
git push origin test-vercel-staging

# Create PR on GitHub
# → Check Vercel bot comment with preview URL
# → Visit preview URL - it will use staging backend!
```

