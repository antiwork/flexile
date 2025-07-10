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

### Frontend (Next.js)
- **Auth.js (NextAuth)** - Handles OTP authentication with JWT sessions
- **Clerk** - Handles social/traditional authentication
- **Session Management** - Unified session handling for both systems

## Setup

### Environment Variables

Add the following to your `.env` file:

```bash
# NextAuth.js configuration
NEXTAUTH_SECRET=your-nextauth-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# API configuration for OTP authentication
NEXT_PUBLIC_API_URL=http://api.flexile.dev  # or https://api.flexile.com for production
```

### API Endpoints

The system uses the following Rails API endpoints:

- `POST /api/v1/email_otp` - Send OTP to email
- `POST /api/v1/login` - Verify OTP and login

## Usage

### For Users

1. **Regular Login** (Clerk) - Visit `/login`
2. **OTP Login** - Visit `/login2`

### OTP Login Flow

1. User enters their email address
2. System sends OTP code via email
3. User enters the 6-digit code
4. System verifies code and creates session
5. User is redirected to dashboard

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

#### API Calls with JWT

For OTP-authenticated users, you can use the JWT token for API calls:

```typescript
const { jwt } = useAuthSession();

if (jwt) {
  // Make API call with JWT token
  const response = await fetch('/api/protected-endpoint', {
    headers: {
      'Authorization': `Bearer ${jwt}`,
    },
  });
}
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
│   │       └── [...nextauth]/
│   │           └── route.ts # NextAuth API routes
│   └── layout.tsx           # Root layout (updated)
├── components/
│   └── ProtectedPage.tsx    # Protected page component
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   └── session.ts           # Unified session management
└── env/
    ├── index.ts             # Server env vars (updated)
    └── client.ts            # Client env vars (updated)
```

## Security Considerations

1. **JWT Tokens** - Stored in NextAuth sessions with 30-day expiration
2. **Rate Limiting** - Backend implements OTP rate limiting
3. **Session Management** - Both systems use secure session storage
4. **CSRF Protection** - Maintained for both authentication systems

## Troubleshooting

### Common Issues

1. **Environment Variables** - Ensure all required env vars are set
2. **API Endpoints** - Verify API URLs are correct for your environment
3. **CORS** - Ensure Rails API allows requests from frontend domain

### Debug Mode

Enable debug logging by setting:
```bash
NEXTAUTH_DEBUG=true
```

## Development Notes

- The system maintains backward compatibility with existing Clerk authentication
- Users can be authenticated via either system simultaneously
- Session state is managed separately for each authentication method
- The unified session hook provides a consistent interface for both systems

## Production Deployment

1. Set production environment variables
2. Update API URLs to production endpoints
3. Configure CORS settings in Rails
4. Test both authentication flows thoroughly

## Testing

Test both authentication flows:

1. **Clerk Login** - Use `/login` and verify social/email login works
2. **OTP Login** - Use `/login2` and verify email OTP flow works
3. **Session Management** - Verify sessions work correctly for both systems
4. **Protected Routes** - Ensure protected pages work with both auth methods