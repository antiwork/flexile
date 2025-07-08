# Auth.js OTP Authentication Setup

This project now includes a parallel authentication flow using Auth.js with OTP (One-Time Password) authentication alongside the existing Clerk authentication.

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
# Auth.js secret (server-side only)
AUTH_SECRET=your-auth-secret-here

# API configuration (client-side accessible)
NEXT_PUBLIC_API_SECRET_TOKEN=your-api-secret-token-here
NEXT_PUBLIC_API_URL=http://localhost:3000  # Optional - defaults to localhost:3000 in dev
```

### AUTH_SECRET
Generate a random secret for Auth.js:
```bash
npx auth secret
```

### NEXT_PUBLIC_API_SECRET_TOKEN
This should match the API token configured in your backend for accessing the OTP endpoints. Uses `NEXT_PUBLIC_` prefix to make it available in client-side code.

### NEXT_PUBLIC_API_URL (Optional)
Override the default API URL. If not set, it will auto-detect based on environment:
- Development: `http://localhost:3000`
- Production: `https://api.flexile.com`
- Preview: Auto-generated Heroku URL

## How it Works

1. **OTP Request**: User enters email on `/login2` → calls `/api/v1/email_otp` → sends email with OTP
2. **OTP Verification**: User enters OTP → calls `/api/v1/login` → returns JWT → creates Auth.js session

## API Endpoints Used

- `POST /api/v1/email_otp` - Send OTP email
- `POST /api/v1/login` - Verify OTP and login

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