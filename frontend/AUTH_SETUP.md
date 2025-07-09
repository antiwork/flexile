# Auth.js OTP Authentication Setup

This project now includes a parallel authentication flow using Auth.js with OTP (One-Time Password) authentication alongside the existing Clerk authentication.

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
# Auth.js secret (server-side only)
AUTH_SECRET=your-auth-secret-here

# API token for backend communication (server-side only)
API_SECRET_TOKEN=your-api-secret-token-here
```

### AUTH_SECRET
Generate a random secret for Auth.js:
```bash
npx auth secret
```

### API_SECRET_TOKEN
This should match the API token configured in your Rails backend for accessing the OTP endpoints. This is kept server-side only for security.

## How it Works

1. **OTP Request**: User enters email on `/login2` → calls Next.js `/api/auth/send-otp` → calls Rails `/api/v1/email_otp` → sends email with OTP
2. **OTP Verification**: User enters OTP → calls Next.js `/api/auth/login` → calls Rails `/api/v1/login` → returns JWT → creates Auth.js session

## API Architecture

**Frontend** → **Next.js API Routes** → **Rails Backend**

### Next.js API Routes
- `POST /api/auth/send-otp` - Proxy to Rails email_otp endpoint
- `POST /api/auth/login` - Proxy to Rails login endpoint
- `GET/POST /api/auth/[...nextauth]` - Auth.js session management

### Rails Backend API Endpoints
- `POST /api/v1/email_otp` - Send OTP email (called by Next.js)
- `POST /api/v1/login` - Verify OTP and login (called by Next.js)

## Routes

- `/login2` - OTP authentication page
- `/login2/test` - Test page to verify authentication works
- `/api/auth/[...nextauth]` - Auth.js API routes

## Usage

1. Visit `/login2`
2. Enter your email address
3. Check your email for the OTP code
4. Enter the OTP code
5. You'll be redirected to `/dashboard` upon successful authentication

## Testing

Visit `/login2/test` to see the authentication status and session data.

## Implementation Details

- Uses Auth.js v5 (beta)
- Custom credentials provider for OTP authentication
- Parallel to existing Clerk authentication
- Stores JWT token in session for backend API calls
- No frontend data storage - all authentication handled by backend APIs
- **Security**: API tokens kept server-side, frontend only calls Next.js API routes
- **Architecture**: Frontend → Next.js API → Rails Backend (no direct Rails API calls from frontend)