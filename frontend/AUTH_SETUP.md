# Auth.js OTP Authentication Setup

This project now includes a parallel authentication flow using Auth.js with OTP (One-Time Password) authentication alongside the existing Clerk authentication.

## Required Environment Variables

Add these environment variables to your `.env` file:

```bash
AUTH_SECRET=your-auth-secret-here
API_SECRET_TOKEN=your-api-secret-token-here
```

### AUTH_SECRET
Generate a random secret for Auth.js:
```bash
npx auth secret
```

### API_SECRET_TOKEN
This should match the API token configured in your backend for accessing the OTP endpoints.

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