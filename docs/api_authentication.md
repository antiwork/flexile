# API Authentication

This document describes the JWT-based authentication API endpoint for the Flexile application.

## Authentication Endpoint

### POST /api/v1/login

Authenticates a user via email and secret token, returning a JWT token for subsequent requests.

#### Request

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "email": "user@example.com",
  "token": "your_secret_token_here"
}
```

#### Response

**Success (200 OK):**
```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "John Doe",
    "legal_name": "John Doe",
    "preferred_name": "John"
  }
}
```

**Error Responses:**

**400 Bad Request:**
```json
{
  "error": "Email is required"
}
```

OR

```json
{
  "error": "Token is required"
}
```

**401 Unauthorized:**
```json
{
  "error": "Invalid token"
}
```

**404 Not Found:**
```json
{
  "error": "User not found"
}
```

## Using the JWT Token

Once you receive the JWT token, include it in the `Authorization` header for subsequent API requests:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Configuration

The API uses two environment variables:

- `API_SECRET_TOKEN`: The secret token that clients must provide for authentication
- `JWT_SECRET`: The secret key used to sign JWT tokens

If these environment variables are not set, the application will fall back to using `Rails.application.secret_key_base`.

## Security Notes

- The secret token is validated using `secure_compare` to prevent timing attacks at the API base controller level
- All API endpoints (except helper endpoints) require the `API_SECRET_TOKEN` for access
- JWT tokens expire after 24 hours
- All API endpoints should validate the JWT token using the `JwtAuthenticatable` concern for user-specific operations
- The API uses `protect_from_forgery with: :null_session` to handle CSRF protection appropriately for API requests
- Helper API endpoints use HMAC-based authentication instead of the secret token

## Example Usage

```bash
# Step 1: Get JWT token
curl -X POST https://api.example.com/api/v1/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "token": "your_secret_token"}'

# Step 2: Use JWT token in subsequent requests
curl -X GET https://api.example.com/api/v1/some_endpoint \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```