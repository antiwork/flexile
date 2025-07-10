# Parallel Login Flow Documentation

This document explains the parallel authentication system in the Flexile application, which supports both Clerk-based login and Email OTP login using NextAuth.js v4.

## Overview

The application supports two authentication methods:
1. **Clerk Authentication** - Google OAuth and traditional login (existing system)
2. **Email OTP Authentication** - One-time password via email using NextAuth.js v4 (new system)

Both authentication methods work in parallel and users can choose either method to log in.

## Architecture

### Authentication Flow Diagram

```
┌─────────────────┐    ┌─────────────────┐
│   User Login    │    │   User Login    │
│   via Clerk     │    │   via OTP       │
│   (/login)      │    │   (/login2)     │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Clerk Session   │    │ NextAuth JWT    │
│   Management    │    │   Session       │
└─────────────────┘    └─────────────────┘
         │                       │
         │                       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │   TRPCProvider      │
         │   GetUserData       │
         │   (Unified Logic)   │
         └─────────────────────┘
                     │
                     ▼
         ┌─────────────────────┐
         │   Zustand Store     │
         │   (User State)      │
         └─────────────────────┘
```

### Components

#### 1. NextAuth.js v4 Configuration (`frontend/lib/auth.ts`)
- Custom credentials provider for OTP authentication
- JWT session strategy with 30-day expiration
- Integration with Rails API for user verification
- Session callbacks for user data management

#### 2. Login2 Page (`frontend/app/login2/page.tsx`)
- Two-step authentication flow (email → OTP)
- React state management for form steps
- Error handling and user feedback
- Redirect handling after successful login

#### 3. API Routes
- `/api/auth/[...nextauth]/route.ts` - NextAuth.js API handler
- `/api/send-otp/route.ts` - OTP email sending endpoint
- `/api/user-data/route.ts` - User data fetching with JWT

#### 4. User State Management (`frontend/trpc/client.tsx`)
- Unified authentication detection (Clerk + NextAuth)
- Automatic user data fetching for both auth methods
- Zustand store integration for consistent state

## Environment Configuration

### Required Environment Variables

Add these variables to your `.env.local` file:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret-key

# API Configuration
API_SECRET_TOKEN=your-api-secret-token

# Development/Production API URLs are handled automatically:
# - Development: http://api.flexile.dev
# - Production: https://api.flexile.com
```

### Environment Setup

1. **NEXTAUTH_SECRET**: Generate a random string for JWT signing
   ```bash
   openssl rand -base64 32
   ```

2. **API_SECRET_TOKEN**: Must match the token configured in your Rails backend
   - This is used for server-to-server API calls
   - Should be the same value as Rails `API_SECRET_TOKEN`

3. **NEXTAUTH_URL**:
   - Development: `http://localhost:3001`
   - Production: Your production domain

## Backend Integration

### Rails API Endpoints

The NextAuth flow integrates with these Rails API endpoints:

#### 1. `/api/v1/email_otp` (POST)
- Sends OTP email to user
- Parameters: `email`, `token`
- Returns: `{ message: "OTP sent successfully" }`

#### 2. `/api/v1/login` (POST)
- Verifies OTP and returns JWT
- Parameters: `email`, `otp_code`, `token`
- Returns: `{ jwt: "...", user: {...} }`

#### 3. `/internal/current_user_data` (GET)
- Fetches full user data using JWT
- Headers: `Authorization: Bearer <jwt>`
- Returns: Complete user object with companies and roles

### JWT Authentication

The backend handles JWT authentication through:
- `JwtAuthenticatable` concern for API endpoints
- JWT verification and user resolution
- Rate limiting for OTP attempts
- Session management and user context

## Usage

### User Flow

1. **Email Step**:
   - User enters email address
   - System validates email format
   - OTP is sent via Rails API
   - User proceeds to verification step

2. **OTP Step**:
   - User enters 6-digit OTP code
   - NextAuth.js validates credentials via Rails API
   - JWT token is received and stored in session
   - User data is fetched and stored in Zustand

3. **Session Management**:
   - NextAuth.js manages JWT session (30 days)
   - Automatic session refresh
   - Logout functionality

### Developer Integration

#### Accessing User Data

Both authentication methods provide the same user data structure:

```typescript
import { useCurrentUser } from "@/global";

function MyComponent() {
  const user = useCurrentUser(); // Works with both auth methods
  return <div>Welcome, {user.name}!</div>;
}
```

#### Checking Authentication

```typescript
import { useUserStore } from "@/global";

function MyComponent() {
  const user = useUserStore((state) => state.user);

  if (!user) {
    // User not authenticated
    return <div>Please log in</div>;
  }

  // User authenticated via either method
  return <div>Authenticated content</div>;
}
```

## Security Considerations

### API Secret Protection

- `API_SECRET_TOKEN` is only used in server-side API routes
- Never exposed to client-side code
- All external API calls are proxied through Next.js API routes

### Session Security

- JWT tokens are stored in secure HTTP-only cookies
- 30-day session expiration with automatic refresh
- CSRF protection on all authenticated requests

### Rate Limiting

- OTP attempts are rate-limited on the backend
- Maximum 5 attempts per 10-minute window
- Proper error messages for rate limit exceeded

## Testing

### Local Development

1. Start Rails backend with OTP email configuration
2. Start Next.js frontend with proper environment variables
3. Navigate to `/login2` for OTP flow testing
4. Use `/login` for Clerk flow testing

### Integration Testing

Both authentication methods should:
- Set user state in Zustand store
- Allow access to protected routes
- Provide consistent user data structure
- Support logout functionality

## Troubleshooting

### Common Issues

1. **OTP Email Not Received**:
   - Check Rails mailer configuration
   - Verify API_SECRET_TOKEN matches between frontend and backend
   - Check email service (SendGrid, etc.) configuration

2. **JWT Authentication Fails**:
   - Verify JWT_SECRET is configured in Rails
   - Check API endpoint accessibility
   - Ensure proper CORS configuration

3. **Session Not Persisting**:
   - Verify NEXTAUTH_SECRET is set
   - Check cookie configuration
   - Ensure proper domain settings

### Debug Mode

Enable debug logging by adding to your `.env.local`:

```bash
NEXTAUTH_DEBUG=true
```

This will provide detailed logs for NextAuth.js operations.

## Migration Notes

### For Existing Users

- Existing Clerk users continue to work without changes
- No database migrations required
- Both authentication methods can be used interchangeably
- User data structure remains consistent

### For New Features

- Use `useCurrentUser()` hook for consistent user access
- Both authentication methods provide the same user data
- Session management is handled automatically
- No need to distinguish between authentication methods in components

## Future Enhancements

### Planned Features

1. **Account Linking**: Allow users to link Clerk and OTP accounts
2. **Multi-factor Authentication**: Combine both methods for enhanced security
3. **Social Login**: Add more providers to NextAuth.js configuration
4. **Session Analytics**: Track authentication method usage

### Extension Points

- Add more NextAuth.js providers
- Implement custom session callbacks
- Add authentication audit logging
- Create admin interface for user management