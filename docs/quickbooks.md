# QuickBooks Integration Guide

## Table of Contents

- [Technical Overview](#technical-overview)
- [Local Development Setup](#local-development-setup)
- [Integration Details](#integration-details)
- [Getting Started (Admin Guide)](#getting-started-admin-guide)
- [Setting up the Integration](#setting-up-the-integration)
- [Data Synchronization](#data-synchronization)
- [Managing Integration Status](#managing-integration-status)
- [Debugging and Troubleshooting](#debugging-and-troubleshooting)

## Technical Overview

Flexile uses [OAuth2](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0) to connect to QuickBooks. The integration is set up on a per-company basis.

QuickBooks API documentation can be found [here](https://developer.intuit.com/app/developer/qbo/docs/get-started).

### How to set up QuickBooks locally

- [ ] Ensure you have access to the [Flexile QuickBooks sandbox account](https://app.sandbox.qbo.intuit.com/app/homepage)
  - If you don't have access, ask Sahil or Raul to add you as a team member to the [Intuit Developer account](https://developer.intuit.com/app/developer/dashboard)
- [ ] Login to your local Flexile app as a Gumroad company administrator (i.e.: `sahil@example.com`) and navigate to [`/companies/_/administrator/settings`](https://localhost:3001/companies/_/administrator/settings)
  - You should see an **Integrations** section and the **QuickBooks** box with a **Connect** button
- [ ] Click the **Connect** button and follow the instructions to connect to the QuickBooks sandbox account
  - You will be redirected to the QuickBooks sandbox account and asked to login
  - After logging in, you will be asked to authorize the Flexile app to access your QuickBooks sandbox account
  - After authorizing, you will be redirected back to the Flexile app and a set up wizard will be displayed
  - Select the expense and bank accounts required for Flexile to properly sync contractors, invoices, and payments to QuickBooks
  - Click **Save** to complete the set up wizard

## Integration Details

### Sync flow

`QuickbooksIntegrationSyncScheduleJob` is run upon finishing the initial integration setup which syncs all the company's active contractors.

Data sync is done via the [`QuickbooksDataSyncJob`](../app/sidekiq/quickbooks_data_sync_job.rb).
Flexile syncs back to QuickBooks the following data:

- Company contractors as QBO **Vendor**
- Invoices and consolidated invoices as QBO **Bill**
- Payments and consolidated payments as QBO **BillPayment**

**ℹ️ Note:**

The integration's data is linked to QBO via the `integration_records` table.

Flexile creates an internal **Flexile.com Money Out Clearing** account for clearing payments made for invoices in QuickBooks.
A basic flow would look like this:

- A contractor is onboarding into Flexile and we create a new QBO Vendor for them
- The contractor submits an invoice at the end of the month and once it's fully approved by the minimum required company administrators (i.e. 2 in Gumroad's case) we create a new QBO Bill for it
- On the 7th of the next month, a consolidated invoice is created for all approved invoices and a new QBO Bill is created for it
- When the payment for the consolidated invoice is successfully processed, we:
  - Create a new QBO BillPayment for the `ConsolidatedPayment`
  - Create a new QBO BillPayment for each `Payment` that was paid by the `ConsolidatedPayment`
  - Create a new QBO JournalEntry to clear the `ConsolidatedInvoice` and `Invoice` amounts from the **Flexile.com Money Out Clearing** account via the `ConsolidatedPayment#quickbooks_journal_entry_paylod`

#### 1. Contractors

Synchronized when:

- A contractor [finishes the onboarding setup](../app/models/user.rb)
- A contractor [updates](../app/models/user.rb)
  - `email`
  - `unconfirmed_email`
  - `preferred_name`
  - `legal_name`
  - `tax_id`
  - `business_name`
  - `city`
  - `state`
  - `street_address`
  - `zip_code`
  - `country_code`
- A company administrator [updates the contractor's `pay_rate_in_subunits`](../app/models/company_worker.rb)

#### 2. Invoices

Synchronized when an [invoice becomes payable](../app/models/invoice.rb).

#### 3. Payments

Synchronized when a payment [changes its status to `SUCCEEDED`](../app/models/payment.rb).

#### 4. Consolidated invoices

Synchronized when a consolidated invoice [is created](../app/models/consolidated_invoice.rb).

#### 5. Consolidated payments

Synchronized when a consolidated payment [changes its status to `SUCCEEDED`](../app/models/consolidated_payment.rb).

### Integration statuses

An integration has the following [states](../app/models/integration.rb):

- `initialized` - The integration has been created and connected to QuickBooks but the user has not finished setting up the expense and bank accounts
- `active` - The integration is successfully connected and syncing data
- `out_of_sync` - The integration became unauthorized and needs to be reconnected
- `deleted` - The integration has been disconnected from QuickBooks

### Webhooks

Flexile is subscribed to the following QuickBooks webhooks events:

- `Vendor` - `Merge`, `Update`, `Delete`
- `Bill` - `Update`, `Delete`
- `BillPayment` - `Update`, `Delete`

We use these events mainly for unlinking the integration records from the QBO records to avoid unnecessary future syncs.

`Quickbooks::EventHandler` service is responsible for handling the webhook events.

### Debugging

- [ ] Check [Flexile's Bugsnag](https://app.bugsnag.com/gumroad/flexile/errors) for errors related to QuickBooks.
- [ ] The `Integration` record stores a `sync_error` column which persists the last error message that occurred during a sync.
- [ ] Flexile uses Papertrail for logging. Access it through [Heroku's dashboard](https://dashboard.heroku.com/apps/flexile) and search for:
  - `QuickbooksOauth.perform` for any OAuth related errors
  - `IntegrationApi::Quickbooks.response` for the Quickbooks API responses
  - `Intuit TID` for the Quickbooks API request IDs in case you need to contact Quickbooks support

**ℹ️ Note:**

By default you can search logs for the past 7 days, and download log archives for the past year.

---

## Getting Started (Admin Guide)

### Useful Links

- [Intuit developer homepage](https://developer.intuit.com/app/developer/homepage) (docs + access OAuth apps)
- [QuickBooks web app](https://qbo.intuit.com/app/homepage?locale=en-us)

### Overview

Flexile's QuickBooks integration automates the process of recording financial data related to contractors, invoices, and payments into your QuickBooks Online account. This helps maintain accurate accounting records with minimal manual entry. The integration primarily syncs:

- **Company Contractors** as QBO **Vendors**
- **Invoices** and **Consolidated Invoices** as QBO **Bills**
- **Payments** and **Consolidated Payments** as QBO **BillPayments**
- **Journal Entries** for clearing transactions
- Monthly **Company Financials** (Revenue and Net Income)

## Setting up the Integration

### Connect to QuickBooks

**Who**: Company administrators

**Manual step**:

1. **Access Flexile Settings**:

   - Log in to your Flexile account as a company administrator
   - Navigate to the company settings page (e.g., `/companies/_/administrator/settings`)

2. **Connect to QuickBooks**:

   - Locate the **Integrations** section
   - Find the **QuickBooks** box and click the **Connect** button
   - You will be redirected to QuickBooks. If you're setting this up locally, ensure you're connecting to the [Flexile QuickBooks sandbox account](https://app.sandbox.qbo.intuit.com/app/homepage). For production, you'll connect to your company's live QuickBooks account.
   - Log in to QuickBooks and authorize Flexile to access your company's data

3. **Configuration Wizard**:
   - After authorization, you'll be redirected back to Flexile
   - A setup wizard will appear, prompting you to map Flexile data to specific QuickBooks accounts:
     - **Consulting Services Expense Account**: The QBO expense account for contractor service costs
     - **Flexile Fees Expense Account**: The QBO expense account for Flexile platform fees
     - **Equity Compensation Expense Account** (Optional, if applicable): The QBO expense account for equity-based compensation
     - **Default Bank Account**: The QBO bank account from which payments are made
     - **Expense Category Accounts**: Map Flexile's internal expense categories to specific QBO expense accounts
   - Click **Save** to complete the setup

**Important Notes**:

- Flexile uses OAuth 2.0 for secure authentication with QuickBooks
- The integration creates an internal **"Flexile.com Money Out Clearing"** bank account in QuickBooks. This account is used as an intermediary to reconcile payments for consolidated invoices and individual invoices
- A **"Flexile" Vendor** is also created in QuickBooks to represent Flexile's service fees

## Data Synchronization

Data synchronization is primarily managed by background jobs and event-driven updates.

- **`QuickbooksIntegrationSyncScheduleJob`**: Runs after the initial integration setup to sync all active company contractors
- **`QuickbooksDataSyncJob`**: Handles the ongoing synchronization of individual records (contractors, invoices, payments) as they are created or updated in Flexile
- **`QuickbooksCompanyFinancialReportSyncJob`** & **`QuickbooksMonthlyFinancialReportSyncJob`**: Run monthly (on the 20th) to pull your company's revenue and net income from QuickBooks into Flexile

**Linking Records**:
The `integration_records` table in Flexile's database links Flexile entities to their corresponding QuickBooks entities using external IDs and sync tokens.

### Syncing Contractors as Vendors

**When**: After contractor completes onboarding or updates key information

**What triggers sync**:

- Contractor completes onboarding in Flexile
- Updates to email, preferred/legal name
- Changes to tax ID, business name
- Address updates (street, city, state, zip, country)
- Pay rate changes (for company workers)

**Background jobs**:

```ruby
QuickbooksIntegrationSyncScheduleJob.perform_async(integration_id)
QuickbooksDataSyncJob.perform_async(contractor_id, 'CompanyContractor')
```

**What this does**:

- Checks if corresponding Vendor exists in QBO (matching by email and display name)
- Creates new Vendor in QBO if not found
- Updates existing Vendor sync token if found
- Creates or updates `integration_record` to link Flexile `CompanyContractor` with QBO `Vendor`
- Triggers `quickbooks/sync-workers` Inngest event for batch processing

### Syncing Invoices as Bills

**When**: Invoice becomes "payable" in Flexile

**Background job**:

```ruby
QuickbooksDataSyncJob.perform_async(invoice_id, 'Invoice')
```

**What this does**:

- Creates corresponding Bill in QuickBooks
- Maps line items and expenses from Flexile invoice to QBO Bill lines
- Creates `integration_record` linking Flexile `Invoice` to QBO `Bill`

### Syncing Payments as BillPayments

**When**: Payment record status changes to `SUCCEEDED`

**Background job**:

```ruby
QuickbooksDataSyncJob.perform_async(payment_id, 'Payment')
```

**What this does**:

- Creates BillPayment in QuickBooks
- Applies payment to corresponding Bill (synced from Flexile Invoice)
- Creates `integration_record` linking Flexile `Payment` to QBO `BillPayment`

### Processing Consolidated Payments

**When**: ConsolidatedPayment status changes to `SUCCEEDED`

**Background job**:

```ruby
QuickbooksDataSyncJob.perform_async(consolidated_payment_id, 'ConsolidatedPayment')
```

**What this does**:

1. **BillPayment for Consolidated Invoice**:

   - Creates BillPayment in QBO for the `ConsolidatedPayment`
   - Applies to Bill created from `ConsolidatedInvoice`

2. **BillPayments for Individual Invoices**:

   - Creates BillPayments for each individual `Payment` in the `ConsolidatedPayment`
   - Applies to respective Bills from individual Flexile Invoices

3. **Journal Entry**:
   - Creates `JournalEntry` in QBO to clear amounts from "Flexile.com Money Out Clearing" account
   - Debits the clearing account for total amount
   - Credits company's main bank account

### Syncing Financial Reports

**When**: Automatically on the 20th of each month

**Background jobs**:

```ruby
QuickbooksCompanyFinancialReportSyncJob.perform_async(company_id)
QuickbooksMonthlyFinancialReportSyncJob.perform_async(company_id, month, year)
```

**What this does**:

- Fetches Profit and Loss report from QuickBooks for previous month
- Extracts Revenue ("Total Income") and "Net Income" figures
- Updates `CompanyMonthlyFinancialReport` records in Flexile

## Managing Integration Status

### Integration Statuses

- **`initialized`**: Connected to QuickBooks but account mapping not completed
- **`active`**: Successfully connected, configured, and actively syncing
- **`out_of_sync`**: Unauthorized (token expired or access revoked)
- **`deleted`**: Intentionally disconnected by administrator

### Reconnecting an Out of Sync Integration

**Manual step**:

1. Navigate to company settings page
2. Locate the QuickBooks integration showing `out_of_sync` status
3. Click **Connect** button to re-authorize
4. Complete OAuth flow with QuickBooks
5. Verify integration status returns to `active`

### Disconnecting the Integration

**Manual step**:

1. Navigate to company settings page
2. Locate the QuickBooks integration
3. Click **Disconnect** button
4. Confirm disconnection
5. Integration status will be set to `deleted`

## Debugging and Troubleshooting

### Check Integration Errors

**Manual step**:

Check the `sync_error` column in the integrations table:

```ruby
integration = Company.find(COMPANY_ID).quickbooks_integration
puts integration.sync_error if integration.sync_error.present?
```

### Check Bugsnag for Errors

1. Access [Flexile's Bugsnag dashboard](https://app.bugsnag.com/gumroad/flexile/errors)
2. Search for QuickBooks-related errors
3. Review error details and stack traces

### Check Application Logs

**Search patterns in Heroku logs**:

- `QuickbooksOauth.perform` - OAuth-related errors
- `IntegrationApi::Quickbooks.response` - Raw API responses from QuickBooks
- `Intuit TID` - Intuit Transaction ID for specific requests
- `Webhooks::QuickbooksController` - Incoming webhook payloads

### Verify Data in QuickBooks

**Manual step**:

1. Log into your QuickBooks Online account
2. Check if entities (Vendors, Bills, BillPayments) were created as expected
3. Review Audit Log in QBO for specific transactions
4. Compare data between Flexile and QuickBooks

### Check Inngest Dashboard

Monitor function status for:

- `quickbooks/sync-integration`
- `quickbooks/sync-workers`
- `quickbooks/sync-financial-report`

### Manual Resync

**Manual step**:

Force a resync for specific data types:

```ruby
company = Company.find(COMPANY_ID)
integration = company.quickbooks_integration

QuickbooksIntegrationSyncScheduleJob.perform_async(integration.id)

company.company_contractors.active.each do |contractor|
  QuickbooksDataSyncJob.perform_async(contractor.id, 'CompanyContractor')
end
```

### Automation Opportunities & Potential Enhancements

While the current integration automates many core processes, further enhancements could improve its robustness and user experience:

- **Automated Re-sync Attempts**: Implement more sophisticated retry mechanisms for transient API errors during sync jobs, potentially with exponential backoff
- **Enhanced Admin Dashboard for Sync Status**: Provide a more detailed view within Flexile of the sync status of individual records
- **Proactive Notifications for `out_of_sync` Status**: Automatically notify company administrators via email or in-app notification if the integration becomes `out_of_sync`
- **Data Discrepancy Detection & Resolution Tools**: Develop tools or reports to help identify and resolve discrepancies between Flexile data and QuickBooks data
- **More Granular Webhook Handling**: Expand webhook handling to update Flexile records if corresponding QBO entities are modified in QuickBooks
- **User-Initiated Resync**: Allow administrators to trigger a full resync or a resync for specific data types from the UI
- **Improved Error Messaging**: Provide more user-friendly error messages in the UI when a sync fails
- **Pre-Sync Validation**: Implement more pre-sync validations to catch potential issues before attempting to call the QBO API
