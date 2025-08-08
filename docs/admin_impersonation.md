## Prerequisites

- Admin must be logged in (JWT present) for the link to work since routes are under the admin constraint.
- Configure `Rails.application.config.action_mailer.default_url_options[:host]` to generate full URLs.
- Ensure `DOMAIN` is correctly set for cookie scoping.

## Generate an impersonation URL

- Rake task: `lib/tasks/user.rake`
- Route: `admin_create_impersonation_url`

Command:

```bash
bundle exec rake user:generate_impersonation_url[email=user@example.com]
```

This prints a URL like:

```
https://<HOST>/admin/impersonation?token=<signed-token>
```

## Start impersonation

- Endpoint: `GET /admin/impersonation?token=<signed-token>`
- Controller: `app/controllers/admin/impersonations_controller.rb#create`

> Open the URL in the Same Browser
>
> This is the most important step. You must paste the link into the same browser where you are currently logged in as an admin.
>
> If you open it in a different browser or a private window, it will not work.

Effects:

- Validates the signed token (purpose-scoped, 5-min expiry).
- Sets `session[:impersonator_id]` and `session[:user_id]`.
- Issues a JWT for the target user in `cookies["x-flexile-auth"]` (HttpOnly, Secure, SameSite=Strict).
- Redirects to `admin_root_path`.

## Stop impersonation

- There is no UI button. If needed, support can stop via the API:

- Endpoint: `DELETE /admin/impersonation`
- Controller: `app/controllers/admin/impersonations_controller.rb#destroy`

Example:

```bash
curl -X DELETE "https://<HOST>/admin/impersonation" \
  -H "Cookie: x-flexile-auth=Bearer <admin_or_impersonated_jwt>"
```

Effects:

- Restores `session[:user_id]` to the original admin.
- Reissues the admin JWT cookie.
- Redirects to `admin_root_path`.

## Security notes

- Signed IDs with `purpose: :impersonate` prevent token reuse/abuse and enforce expiry.
- Cookie flags: `httponly`, `secure`, `same_site: :strict`, `domain: DOMAIN`.
- JWT is the single source of truth; `JwtService` accepts token from header or `cookies["x-flexile-auth"]`.
- Routes are under `admin` constraint; unauthenticated users receive 404.

## Troubleshooting

- Invalid/expired link:
  - Regenerate with the rake task; confirm time sync and 5-minute window.
- 404 on valid link:
  - Admin may not be authenticated in the browser; routes are behind `admin_constraint`.
- Cookie not set:
  - Check `DOMAIN` matches the current host.
  - Ensure HTTPS in non-dev environments (Secure cookies require it).
- Tests reference:
  - Specs live in `spec/controllers/concerns/impersonations_controller_spec.rb`.

## Quick QA checklist

- Generate link and open as an authenticated admin.
- Optional: Call `DELETE /admin/impersonation` to revert.
- Verify no residual impersonation state after stop (new JWT cookie, session reset).
