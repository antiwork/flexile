# GitHub App Setup for Flexile

To integrate GitHub with Flexile, you need to create and configure a GitHub App. This app handles two distinct flows using the same credentials:

1.  **For Admins**: Installs the App on the Company Organization to read PRs.
2.  **For Contractors**: Authenticates their GitHub Identity via OAuth to verify authorship.

## 1. Creating the GitHub App

Go to **Settings** -> **Developer settings** -> **GitHub Apps** -> **New GitHub App**.

### General

- **GitHub App Name**: e.g., "Flexile App".
- **Homepage URL**: Your app URL (e.g., `https://flexile.com`).
- **Callback URL 1**: `[ENV.APP_DOMAIN]/api/auth/callback/github`
  - _Crucial_: This is used for the **Contractor OAuth** flow for Login using NextAuth.
  - Example: `https://flexile.com/api/auth/callback/github`
- **Callback URL 2**: `[ENV.API_DOMAIN]/internal/github_connection/callback`
  - _Crucial_: This is used for the **Contractor OAuth** flow. It must match exactly.
  - Example: `https://api.flexile.com/internal/github_connection/callback`
- **Setup URL**: `[ENV.API_DOMAIN]/internal/companies/github_organization_connection/callback`
  - _Crucial_: This is where Admins are redirected after **Installing** the app on their Org.
  - Example: `https://api.flexile.com/internal/companies/github_organization_connection/callback`
- **Redirect on update**: Check this option.
  - _Crucial_: Ensures users are redirected to the 'Setup URL' after updating installations (e.g., adding/removing repositories).

### Webhook

- **Active**: Uncheck. Webhooks are not currently used.

## 2. Permissions

### Repository Permissions

- **Checks**: **Read-only**.
- **Issues**: **Read and write**
- **Metadata**: **Read only** (Mandatory and is auto selected).

### Organization Permissions

- No permission is selected here.

### Account Permissions

- **Email addresses**: **Read-only**.

## 3. Environment Variables

After creating the app, set these variables in your Flexile backend:

- `GH_APP_ID`: App ID (from the top of the App settings).
- `GH_APP_SLUG`: The URL-friendly name of your app (e.g., `flexile-app`).
  - Found in the public link: `https://github.com/apps/[GH_APP_SLUG]`.
- `GH_CLIENT_ID`: Client ID (from the top of the App settings).
- `GH_CLIENT_SECRET`: Copy from `https://github.com/apps/[GH_APP_SLUG]`.
- `GH_APP_PRIVATE_KEY`: Generate a Private Key (`.pem`) on `https://github.com/apps/[GH_APP_SLUG]` , then Base64 encode it.
  - Command: `base64 -i path/to/key.pem | pbcopy`
  - _Note_: The backend expects a Base64 string, not the raw file content.

---

## User Flows (Context)

- **Admins**: Go to **Settings > Integrations**. Clicking "Connect" installs this App on their GitHub Organization. Flexile is able to verify that pull reqeusts belong to that org.
- **Contractors**: Go to **Settings > Account**. Clicking "Connect" allows Flexile to read their GitHub Identity (login/Email) to verify they authored a PR.
