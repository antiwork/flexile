# QuickBooks Integration Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Setting up the Integration](#setting-up-the-integration)
- [Data Synchronization](#data-synchronization)
  - [Syncing Contractors as Vendors](#syncing-contractors-as-vendors)
  - [Syncing Invoices as Bills](#syncing-invoices-as-bills)
  - [Syncing Payments as BillPayments](#syncing-payments-as-billpayments)
  - [Processing Consolidated Payments](#processing-consolidated-payments)
  - [Syncing Financial Reports](#syncing-financial-reports)
- [Managing Integration Status](#managing-integration-status)
- [Debugging and Troubleshooting](#debugging-and-troubleshooting)

## Getting Started

### Useful Links

- [Intuit developer homepage](https://developer.intuit.com/app/developer/homepage) (docs + access OAuth apps)
- [QuickBooks web app](https://qbo.intuit.com/app/homepage?locale=en-us)

### Overview

Flexile's QuickBooks integration automates the process of recording financial data related to contractors, invoices, and payments into your QuickBooks Online account. The integration primarily syncs:

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
   - You will be redirected to QuickBooks
   - Log in to QuickBooks and authorize Flexile to access your company's data

3. **Configuration Wizard**:
   - After authorization, you'll be redirected back to Flexile
   - A setup wizard will appear, prompting you to map Flexile data to specific QuickBooks accounts:
     - **Consulting Services Expense Account**: The QBO expense account for contractor service costs
     - **Flexile Fees Expense Account**: The QBO expense account for Flexile platform fees
     - **Equity Compensation Expense Account** (Optional): The QBO expense account for equity-based compensation
     - **Default Bank Account**: The QBO bank account from which payments are made
     - **Expense Category Accounts**: Map Flexile's internal expense categories to specific QBO expense accounts
   - Click **Save** to complete the setup

**What this creates**:

- Internal **"Flexile.com Money Out Clearing"** bank account in QuickBooks
- **"Flexile" Vendor** in QuickBooks to represent Flexile's service fees
- OAuth 2.0 secure authentication with QuickBooks

## Data Synchronization

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
