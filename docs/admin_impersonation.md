# Admin Impersonation Guide

## Table of Contents

- [Generate an impersonation URL](#generate-an-impersonation-url)
- [Start impersonation](#start-impersonation)
- [Stop impersonation](#stop-impersonation)
- [Troubleshooting](#troubleshooting)
- [Quick QA checklist](#quick-qa-checklist)

## Generate an impersonation URL

Command:

```bash
bundle exec rake user:generate_impersonation_url[email=user@example.com]
```

This prints a URL like:

```text
https://<HOST>/admin/impersonation?token=<signed-token>
```

Note: Links expire in ~5 minutes.

## Start impersonation

- Admin must be logged in for the generated URL to work.

> Open the URL in the Same Browser where admin is logged in.
>
> If you open it in a different browser or a private window, it will not work.

## Stop impersonation

Command:

```bash
curl -X DELETE "https://<HOST>/admin/impersonation" \
  -H "Cookie: x-flexile-auth=Bearer <admin_or_impersonated_jwt>"
```

## Troubleshooting

- Invalid/expired link:
  - Regenerate the URL; confirm time sync and 5-minute window.
- 404 on valid link:
  - Admin may not be authenticated in the browser.

## Quick QA checklist

- Generate link and open as an authenticated admin.
- Call `DELETE /admin/impersonation` to revert.
