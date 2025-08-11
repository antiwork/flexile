# Admin User Impersonation

Simple console-based user impersonation for team members to debug user issues.

## Usage

Generate an impersonation URL for any user:

```bash
rails impersonation:generate_url[user@example.com]
```

This outputs a secure URL that expires in 5 minutes:
```
Impersonation URL for John Doe (user@example.com):
https://yourapp.com/admin/impersonate?token=AbCdEf...

Note: URL expires in 5 minutes
Only accessible by team members
```

## How It Works

1. **Generate URL**: Console command creates signed token for target user
2. **Admin access**: Team member pastes URL in browser
3. **Secure switch**: System validates token, switches admin to impersonate user
4. **Stop**: Admin can stop impersonation at `/admin/impersonate` (DELETE)

## Security

- Only team members (`team_member: true`) can access impersonation routes
- Tokens expire after 5 minutes
- Uses Rails signed IDs with purpose verification
- JWT cookie authentication for browser sessions
- All impersonation activity logged in session

## Requirements

- `action_mailer.default_url_options[:host]` must be configured
- User must have `team_member: true` flag to access admin routes
- Target user must exist in database

## Troubleshooting

**Error: "action_mailer.default_url_options[:host] not configured"**
Set in `config/environments/#{Rails.env}.rb`:
```ruby
config.action_mailer.default_url_options = { host: 'yourapp.com' }
```

**Error: "User with email 'x' not found"**  
Verify the email address exists in the database.