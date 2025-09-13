# Impersonation

## UI

Team members can impersonate users at `/admin` by entering their email address.

## Rails Console

### Impersonate a user

```ruby
user = User.find_by(email: "user@example.com")
user.generate_impersonation_url
# => https://flexile.com/impersonate?actor_token=eyJhbGciOiJIUzI1NiJ9...
```

### Impersonate a company

```ruby
company = Company.find_by(name: "Example Corp")
company.generate_impersonation_url
# => https://flexile.com/impersonate?actor_token=eyJhbGciOiJIUzI1NiJ9...
```

This will generate impersonation url for primary admin. Open the generated URL in browser to start impersonation session. Click "Stop impersonating" in sidebar to end session.
