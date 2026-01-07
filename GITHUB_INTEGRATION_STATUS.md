# GitHub Integration Status

This document outlines the implementation status of the GitHub integration features for Flexile.

## Implemented Features

### 1. Invoice Editing & GitHub PR Links

- **PR Link Prettification**: Raw GitHub PR/Issue URLs in the invoice line item description are automatically converted to a rich `GithubPRLink` component on blur.
- **Toggle Behavior**: Users can easily edit the link by clicking the "Edit" button or the component itself (if not holding modifier keys), which reverts it to a raw text input.
- **Bounty Auto-fill**: If a PR has a label indicating a bounty (e.g., "bounty: $100"), the invoice line item's rate is automatically populated with this amount if it was previously set to 0.
- **Connection Warning**: A warning banner is displayed on the invoice edit page if the user is billing a company that has a connected GitHub organization, but the user themselves has not connected their GitHub account.

### 2. User Authentication & Connection

- **Sign in with GitHub**: A "Sign in with GitHub" button has been added to the login page (`frontend/app/(auth)/index.tsx`).
- **Connection Management**:
  - Users can connect/disconnect their GitHub account from the Settings page.
  - Companies can connect/disconnect their GitHub organization from the Company Settings.
- **Enums**: Updated `SignInMethod` enum to include `Github`.

### 3. Backend & API

- **TRPC Endpoints**: `github.getPullRequest` endpoint (already existing) fetches PR details, including bounty information from labels.

## Testing Instructions

### Prerequisites

- Ensure backend server is running.
- Ensure you have a GitHub app configured with `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in your environment variables.

### Scenarios

#### 1. Sign in with GitHub

1. Navigate to `/login`.
2. Click "Log in with GitHub".
3. Verify redirection to GitHub and successful login upon return.

#### 2. Connect GitHub Account (User)

1. Go to **Settings**.
2. Locate the "GitHub Account" card.
3. Click "Connect GitHub".
4. Verify the status changes to "Connected" with your username.

#### 3. Invoice Creation with PR Link

1. Go to **Invoices** > **New Invoice**.
2. Select a company to bill.
3. In a line item description, paste a valid public GitHub PR URL (e.g., `https://github.com/facebook/react/pull/28773`).
4. Tab out or click away.
5. **Verify**: The link converts to a card showing PR title, status, and repository.
6. **Verify**: If the PR has a bounty label (e.g. `bounty: 500`), the "Rate" field should auto-update to `$500.00` (if it was previously 0).

#### 4. Warning Banner

1. As a company admin, go to **Settings** and connect a GitHub organization (e.g., `facebook`).
2. As a contractor (who hasn't connected GitHub), create an invoice for this company.
3. Add a PR link from the `facebook` organization.
4. **Verify**: A warning banner appears at the top: "You are billing a company that uses GitHub, but you haven't connected your GitHub account."
5. Click "Connect GitHub" in the banner.
6. **Verify**: OAuth flow triggers and upon return, the banner disappears.

## Pending / Next Steps

- [ ] Comprehensive E2E testing for the full OAuth flow (requires mocking GitHub API).
- [ ] Visual regression testing for the `GithubPRLink` component states (merged, closed, open, paid).
