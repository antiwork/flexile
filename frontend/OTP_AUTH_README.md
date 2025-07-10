# OTP Authentication System

This document explains how to set up and use the parallel OTP-based authentication system alongside the existing Clerk authentication.

## Overview

The application now supports two authentication methods:
1. **Clerk Authentication** (existing) - Social login and email/password
2. **OTP Authentication** (new) - Email-based one-time password

Both systems work in parallel, allowing users to choose their preferred authentication method.

## Architecture

### Backend (Rails)
- `Api::V1::EmailOtpController` - Sends OTP codes via email
- `Api::V1::LoginController` - Verifies OTP codes and returns JWT tokens
- **API Authentication** - All API endpoints require an `API_SECRET_TOKEN` for security

### Frontend (Next.js)
- **Next.js API Routes** - Server-side routes that securely call Rails backend
- **Auth.js (NextAuth)** - Handles OTP authentication with JWT sessions
- **Clerk** - Handles social/traditional authentication
- **Session Management** - Unified session handling for both systems

### Security Architecture

```
Browser → Next.js API Routes → Rails Backend
           (Server-side only)    (with API_SECRET_TOKEN)
```

The `API_SECRET_TOKEN` is **never exposed to the browser** and only exists on the Next.js server.

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
# NextAuth.js configuration
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Server-side API configuration (NEVER exposed to browser)
API_SECRET_TOKEN=your-api-secret-token-here
API_URL=http://api.flexile.dev  # or https://api.flexile.com for production
```

**Security Note**: The `API_SECRET_TOKEN` is only available server-side and never sent to the browser.

### API Endpoints

The system uses the following secure flow:

**Frontend → Next.js API Routes:**
- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/verify-otp` - Verify OTP and login

**Next.js API Routes → Rails Backend:**
- `POST /api/v1/email_otp` - Send OTP to email (with API token)
- `POST /api/v1/login` - Verify OTP and login (with API token)

## Usage

### For Users

1. **Regular Login** (Clerk) - Visit `/login`
2. **OTP Login** - Visit `/login2`

### OTP Login Flow

1. User enters their email address
2. Frontend calls `/api/auth/send-otp` (Next.js)
3. Next.js server calls Rails with API token
4. User enters the 6-digit code
5. Frontend calls `/api/auth/verify-otp` (Next.js)
6. Next.js server verifies with Rails and creates session
7. User is redirected to dashboard

### For Developers

#### Session Management

Use the unified session hook:

```typescript
import { useAuthSession } from "@/lib/session";

function MyComponent() {
  const { user, isAuthenticated, authType, jwt } = useAuthSession();

  if (!isAuthenticated) {
    return <div>Please log in</div>;
  }

  return (
    <div>
      Welcome {user.name}!
      Authenticated via: {authType} {/* "clerk" or "otp" */}
      {jwt && <p>JWT Token available for API calls</p>}
    </div>
  );
}
```

#### Protected Pages

Use the `ProtectedPage` component:

```typescript
import ProtectedPage from "@/components/ProtectedPage";

export default function DashboardPage() {
  return (
    <ProtectedPage>
      <h1>Dashboard</h1>
      <p>This content is protected</p>
    </ProtectedPage>
  );
}
```

#### API Calls

For OTP-authenticated users, you can use the JWT token for API calls:

```typescript
import { apiClient } from "@/lib/api-client";

// For OTP operations (uses Next.js API routes)
await apiClient.post('/api/auth/send-otp', { email }, { useJWT: false });

// For authenticated endpoints (includes JWT token automatically)
const data = await apiClient.get('/api/protected-endpoint');

// For public Next.js API routes
const response = await apiClient.post('/api/public-endpoint', { data }, { useJWT: false });
```

## File Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/           # Clerk login
│   │   ├── login2/          # OTP login
│   │   └── layout.tsx       # Auth layout (updated)
│   ├── api/
│   │   └── auth/
│   │       ├── [...nextauth]/
│   │       │   └── route.ts # NextAuth API routes
│   │       ├── send-otp/
│   │       │   └── route.ts # Server-side OTP sending
│   │       └── verify-otp/
│   │           └── route.ts # Server-side OTP verification
│   └── layout.tsx           # Root layout (updated)
├── components/
│   └── ProtectedPage.tsx    # Protected page component
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── session.ts           # Unified session management
│   └── api-client.ts        # API client for Next.js routes
└── env/
    ├── index.ts             # Server env vars (secure)
    └── client.ts            # Client env vars (public only)
```

## Security Considerations

1. **API Secret Token** - Never exposed to browser, only on Next.js server
2. **Server-side Proxy** - All Rails API calls go through Next.js API routes
3. **JWT Tokens** - Stored in NextAuth sessions with 30-day expiration
4. **Rate Limiting** - Backend implements OTP rate limiting
5. **Session Management** - Both systems use secure session storage
6. **CSRF Protection** - Maintained for both authentication systems

## Troubleshooting

### Common Issues

1. **Environment Variables** - Ensure all server-side env vars are set
2. **API Routes** - Verify Next.js API routes are working (check `/api/auth/send-otp`)
3. **Rails Backend** - Ensure Rails backend is accessible from Next.js server
4. **CORS** - Ensure Rails API allows requests from Next.js server

### API Token Errors

If you see "Token is required" or "Invalid token" errors:
1. Check that `API_SECRET_TOKEN` is set in Next.js server environment
2. Check that `API_URL` points to the correct Rails backend
3. Verify Rails backend is receiving requests with the token
4. Restart Next.js server after changing environment variables

### Debug Mode

Enable debug logging by setting:
```bash
NEXTAUTH_DEBUG=true
```

Check Next.js API route logs in the server console for detailed error information.

## Development Notes

- The system maintains backward compatibility with existing Clerk authentication
- Users can be authenticated via either system simultaneously
- Session state is managed separately for each authentication method
- The unified session hook provides a consistent interface for both systems
- API secret token is securely handled server-side only
- All Rails API calls are proxied through Next.js for security

## Production Deployment

1. Set production environment variables (server-side only)
2. Ensure `API_URL` points to production Rails backend
3. Configure network access between Next.js and Rails servers
4. Ensure API secret tokens are securely generated and stored
5. Test both authentication flows thoroughly
6. Verify no sensitive tokens are exposed in browser

## Testing

Test both authentication flows:

1. **Clerk Login** - Use `/login` and verify social/email login works
2. **OTP Login** - Use `/login2` and verify email OTP flow works
3. **API Security** - Verify no API tokens are visible in browser dev tools
4. **Session Management** - Verify sessions work correctly for both systems
5. **Protected Routes** - Ensure protected pages work with both auth methods
6. **Server Logs** - Check Next.js server logs for any API errors