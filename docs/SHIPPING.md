## Feature: One-Off Cash/Equity Bonuses in Flexile

This document outlines the steps to implement one-off cash/equity bonuses in Flexile, covering both backend and frontend development.

**1. Backend (Ruby on Rails)**

**1.1. Model Changes:**

- Create a new model `Bonus` with the following attributes:
  - `company_id` (references `Company`)
  - `company_worker_id` (references `CompanyWorker`)
  - `amount_cents` (integer)
  - `equity_type` (string enum: "fixed", "range")
  - `fixed_equity_percentage` (integer, optional)
  - `min_equity_percentage` (integer, optional)
  - `max_equity_percentage` (integer, optional)
  - `status` (string enum: "pending", "accepted", "rejected", "paid")
  - `accepted_equity_percentage` (integer, optional)
  - `invoice_id` (references `Invoice`)

**1.2. Controller Changes:**

- **`Internal::Companies::Administrator::BonusesController`:**

  - **`create` action:**

    - Receives bonus parameters from the UI (amount, equity_type, percentages, company_worker_id).
    - Creates a `Bonus` record and an associated "bonus invoice" (`Invoice`). The `Invoice` should have a specific flag or attribute marking it as a bonus invoice (e.g., `bonus_invoice: true`). Initially, set the `Invoice` status to `pending`. The invoice should have a single `InvoiceLineItem` for the bonus amount.
    - Returns the `Bonus` ID to the frontend.

  - **`update` action:** Not needed for initial implementation (used for admin updates, which are out of scope for MVP).

- **`Internal::Companies::BonusesController`:**
  - **`accept` action:**
    - Receives the `Bonus` ID and the `accepted_equity_percentage` (if applicable).
    - Updates the `Bonus` record with the accepted percentage and status "accepted".
    - Triggers the invoice payment process (see Service Changes below).

**1.3. Service Changes:**

- Create a new service `PayBonusInvoice` (or adapt an existing service like `PayInvoice`).
  - Triggered by the `BonusesController#accept` action.
  - This service handles:
    - Approving the "bonus invoice". Since it's a bonus, it might not require the standard multi-level approval flow. You could either skip approvals or auto-approve it on the admin's behalf.
    - Marking the `Bonus` status as "paid".
    - Calling the existing invoice payment flow to handle the actual payment via Stripe, QuickBooks, and Wise. Ensure that the equity component, if selected, is properly handled in existing services/workers. The equity portion should likely be handled as a separate transaction from the cash portion, perhaps by creating an `EquityGrant` or a similar record.

**1.4. Policy Changes:**

- **`BonusPolicy`:** Define authorization rules, ensuring only company administrators can create bonuses and only the intended worker can accept them.

**1.5. Feature Flag (Optional):**

- Consider introducing a feature flag for this functionality, allowing you to roll it out gradually or disable it easily if necessary.

**2. Frontend (React, Next.js)**

**2.1. New Pages/Components:**

- **`frontend/app/companies/[companyId]/administrator/bonuses/new/page.tsx`:** Form for creating a new bonus.
  - Input fields for:
    - Recipient (dropdown of existing workers)
    - Bonus amount
    - Equity type (fixed or range)
    - Percentage(s) (depending on equity type)
  - "Create Bonus" button, which triggers the `BonusesController#create` action. Upon success, redirect to a confirmation page or the worker list.
- **`frontend/app/companies/[companyId]/bonuses/[id]/page.tsx`:** Page for the worker to accept the bonus.
  - Display bonus details (amount, equity options).
  - If equity is enabled and the bonus has a range equity type, provide a selection mechanism for the worker to choose their desired equity percentage.
  - "Accept Bonus" button, which triggers the `BonusesController#accept` action. Redirect to a success page or the dashboard after successful acceptance.

**2.2. tRPC Changes:**

- Add new tRPC routes for:
  - Creating a bonus (`companies.bonuses.create`).
  - Fetching bonus details (`companies.bonuses.get`).
  - Accepting a bonus (`companies.bonuses.accept`).
  - Fetching eligible workers for bonuses (`companies.bonuses.eligibleWorkers`).
- Update existing tRPC route to fetch company settings and include the equity compensation settings (fixed percentage, allowed range, whether it's enabled).

**2.3. State Management:**

- Update the existing `Company` store to include whether one-off bonuses are enabled. This can be fetched when the company data is loaded or through a separate API request.

**3. Post-MVP Enhancements**

- **Worker Rejection:** Add a "Reject Bonus" button on the bonus acceptance page, triggering a new backend action (`reject`) and updating the `Bonus` status accordingly. Consider adding a reason for rejection.
- **Bonus for New Workers:** This would likely involve adding bonus parameters to the new worker invitation flow, changing the invitation email, creating the bonus and invoice after the worker accepts the invitation, and handling the edge case where a worker rejects the offer after accepting the invitation.

**4. Testing:**

- **Backend (RSpec):** Write unit tests for the new model, controller actions, and services. Focus on edge cases and error handling.
- **Frontend (Playwright):** Write end-to-end tests to cover the entire bonus flow, from creation to acceptance (and rejection, post-MVP). Ensure that the UI behaves correctly and data is passed correctly between frontend and backend.

**Example API Requests (Illustrative)**

**Create Bonus (Admin):**

```
POST /internal/companies/:company_id/administrator/bonuses
{
  "amount_cents": 10000,
  "equity_type": "fixed",
  "fixed_equity_percentage": 10,
  "company_worker_id": "some_worker_id"
}
```

**Accept Bonus (Worker):**

```
PATCH /internal/companies/:company_id/bonuses/:id/accept
{
  "accepted_equity_percentage": 5
}
```

This detailed breakdown provides a comprehensive roadmap for implementing the one-off bonus feature, ensuring a robust and well-tested solution. Remember to address any technical debt and consider code refactoring opportunities as you develop.
