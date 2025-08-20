# Admin Impersonation API

This document describes the simplified admin impersonation API endpoint that returns a JWT token for frontend-managed impersonation.

## Overview

The impersonation system allows admin users to obtain JWT tokens for other users. The actual impersonation state management (storing both admin and impersonated user tokens) is handled by the Next.js frontend using NextAuth session.

## API Endpoint

### Start Impersonation

**Endpoint:** `POST /admin/impersonate`

Send the token in the request body (form or JSON), e.g.:

```bash
curl -X POST https://yourapp.com/admin/impersonate \
  -H 'Content-Type: application/json' \
  -H 'x-flexile-auth: Bearer <admin-jwt>' \
  -d '{"token":"<signed-impersonation-token>"}'
```

**Parameters:**
- `token` (required): A signed token generated via the rake task

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "display_name": "John Doe"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid or expired impersonation token"
}
```

**Status Codes:**
- `200 OK`: Successfully generated JWT for impersonated user
- `400 Bad Request`: Token parameter is missing or blank
- `401 Unauthorized`: Token is invalid or expired
- `404 Not Found`: User specified in token not found

## Generating Impersonation URLs

To generate a secure impersonation URL for an admin to use:

```bash
rails impersonation:generate_url[user@example.com]
```

This outputs a secure URL that expires in 5 minutes:
```text
Impersonation URL for John Doe (user@example.com):
https://yourapp.com/admin/impersonate?token=AbCdEf...

Note: URL expires in 5 minutes
Only accessible by team members
```

## Frontend Implementation

The Next.js frontend should:

1. Make a POST request to `/admin/impersonate` with the token
2. Store the returned JWT as the impersonated user's token in NextAuth session
3. Maintain the original admin's JWT separately
4. Use the impersonated user's JWT for API requests
5. To stop impersonation, remove the impersonated JWT from the session

## Security

- Impersonation URLs expire after 5 minutes
- Only team members (admins) can access the impersonation endpoint
- All impersonation events are logged for audit purposes
- The backend remains stateless - no session or cookie management
- Impersonation JWTs are short-lived (15 minutes) and tagged (`imp: true`, `act: <admin_id>`) for auditability

## Configuration

Ensure the following is configured:

1. `Rails.application.config.action_mailer.default_url_options[:host]` must be set
2. Users must have `team_member` attribute to access admin features
3. Routes must include `post :impersonate` under the `admin` namespace and be protected by the team_member/admin constraint

## Troubleshooting

**Error: "action_mailer.default_url_options[:host] not configured"**
Set in `config/environments/#{Rails.env}.rb`:
```ruby
config.action_mailer.default_url_options = { host: 'yourapp.com' }
```

**Error: "User with email 'x' not found"**  
Verify the email address exists in the database.