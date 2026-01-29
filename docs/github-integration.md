# GitHub Integration Setup

This document explains how to set up the GitHub integration for Flexile, which enables contractors to link Pull Requests to invoices and allows automatic bounty verification.

## Features

- **PR Verification**: Contractors can paste GitHub PR URLs in invoice line items to automatically fetch and display PR details
- **Bounty Detection**: Automatically extracts bounty amounts from PR or linked issue labels
- **PR Ownership Verification**: Verifies that the contractor is the author of linked PRs
- **Webhook Events**: Receives real-time updates when PRs are merged or issues are labeled

## Prerequisites

1. A GitHub organization where you want to install the app
2. Admin access to both the GitHub organization and Flexile company settings

## GitHub App Setup

### 1. Create a GitHub App

1. Go to your GitHub organization's settings
2. Navigate to **Developer settings** > **GitHub Apps** > **New GitHub App**
3. Configure the app with the following settings:

**Basic Information:**

- **GitHub App name**: `Flexile` (or your preferred name)
- **Homepage URL**: Your Flexile instance URL (e.g., `https://app.flexile.com`)

**Identifying and authorizing users:**

- **Callback URL**: `https://your-domain.com/github/callback`
- **Request user authorization (OAuth) during installation**: Checked
- **Post installation Setup URL**: `https://your-domain.com/github/installation`
- **Redirect on update**: Checked

**Webhook:**

- **Active**: Checked
- **Webhook URL**: `https://your-domain.com/webhooks/github`
- **Webhook secret**: Generate a secure random string (save this for later)

**Repository permissions:**

- **Contents**: Read-only
- **Issues**: Read-only
- **Metadata**: Read-only
- **Pull requests**: Read-only

**Organization permissions:**

- **Members**: Read-only

**Subscribe to events:**

- Pull request
- Issues
- Installation

### 2. Generate Private Key

After creating the app:

1. Scroll down to **Private keys**
2. Click **Generate a private key**
3. Save the downloaded `.pem` file securely

### 3. Note the App Credentials

From your GitHub App settings page, note:

- **App ID** (numeric)
- **Client ID**
- **Client secret** (generate one if not already created)

## Environment Configuration

Set the following environment variables in your Flexile backend:

```bash
# GitHub OAuth (for user authentication)
GH_CLIENT_ID=your_client_id
GH_CLIENT_SECRET=your_client_secret

# GitHub App (for organization installation)
GH_APP_ID=your_app_id
GH_APP_SLUG=your-app-slug  # The URL slug from your app's public page
GH_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
GH_WEBHOOK_SECRET=your_webhook_secret
```

**Note**: For `GH_APP_PRIVATE_KEY`, replace newlines with `\n` to store as a single-line string.

## Company Administrator Setup

### Connecting GitHub to Your Company

1. Log in to Flexile as a company administrator
2. Navigate to **Settings** > **Integrations**
3. Click **Connect** on the GitHub card
4. You'll be redirected to GitHub to:
   - Authorize the OAuth app (grants user-level access)
   - Install the GitHub App on your organization
5. Select your organization and grant the requested permissions
6. After installation, you'll be redirected back to Flexile

### Verifying the Connection

Once connected, the integrations page will show:

- A green indicator with your organization name
- The ability to disconnect if needed

## Contractor Usage

### Connecting GitHub Account

Contractors can connect their GitHub account to verify PR ownership:

1. Go to **Settings** > **Profile**
2. Click **Connect** on the GitHub card
3. Authorize with GitHub
4. Your GitHub username will appear once connected

### Using PR Links in Invoices

1. Create or edit an invoice
2. In a line item description, paste a GitHub PR URL (e.g., `https://github.com/org/repo/pull/123`)
3. If the PR belongs to the company's connected GitHub organization:
   - PR details (title, status, author) will be fetched automatically
   - Bounty amounts will be extracted from labels if present
4. The PR author will be verified against your connected GitHub account

### Bounty Labels

Bounties are automatically detected from labels on PRs or linked issues. Supported formats:

- `$100`, `$1,000`, `$100.00` - Dollar amounts
- `$3K`, `$3.5K` - Thousands
- `$1M`, `$1.5M` - Millions
- `bounty:100`, `bounty-100`, `bounty_100` - Bounty prefix
- `100 USD`, `100 dollars` - USD suffix

## Webhook Events

The integration listens for these GitHub webhook events:

- **installation**: When the app is installed/uninstalled
- **pull_request**: When PRs are opened, closed, or merged
- **issues**: When issues are labeled (for bounty updates)

## Troubleshooting

### "GitHub App not installed" Error

- Ensure the GitHub App is installed on the organization
- Check that the organization name in Flexile matches exactly

### PR Details Not Loading

- Verify the PR URL is from the company's connected organization
- Check that the contractor has connected their GitHub account
- Ensure the GitHub App has the required permissions

### Webhook Not Receiving Events

- Verify the webhook URL is accessible from the internet
- Check the webhook secret matches the configuration
- Review GitHub's webhook delivery logs in your app settings

## Security Considerations

- The webhook secret should be a strong, random string
- Store the private key securely and never commit it to version control
- The integration only requests read-only permissions
- User tokens are stored encrypted and used only for verification
