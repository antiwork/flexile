## QuickBooks integration

Flexile uses [OAuth2](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)
to connect to QuickBooks. The integration is set up on a per-company basis.

QuickBooks API documentation can be found [here](https://developer.intuit.com/app/developer/qbo/docs/get-started).

### How to set up QuickBooks locally

- [ ] Ensure you have access to the [Flexile QuickBooks sandbox account](https://app.sandbox.qbo.intuit.com/app/homepage)
  - If you don't have access, ask Sahil or Raul to add you as a team member to the [Intuit Developer account](https://developer.intuit.com/app/developer/dashboard)
- [ ] Login to your local Flexile app as a Gumroad company administrator (i.e.: `sahil@example.com`) and navigate to [`/companies/_/administrator/settings`](https://flexile.dev/companies/_/administrator/settings)
  - You should see an **Integrations** section and the **QuickBooks** box with a **Connect** button
- [ ] Click the **Connect** button and follow the instructions to connect to the QuickBooks sandbox account
  - You will be redirected to the QuickBooks sandbox account and asked to login
  - After logging in, you will be asked to authorize the Flexile app to access your QuickBooks sandbox account
  - After authorizing, you will be redirected back to the Flexile app and a set up wizard will be displayed
  - Select the expense and bank accounts required for Flexile to properly sync contractors, invoices, and payments to QuickBooks
  - Click **Save** to complete the set up wizard

### Sync flow

`QuickbooksIntegrationSyncScheduleJob` is run upon finishing the initial integration setup which syncs all the company's
active contractors.

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
- The contractor submits an invoice at the end of the month and once it's fully approved by the minimum required
  company administrators (i.e. 2 in Gumroad's case) we create a new QBO Bill for it
- On the 7th of the next month, a consolidated invoice is created for all approved invoices and a new QBO Bill is created for it
- When the payment for the consolidated invoice is successfully processed, we:
  - Create a new QBO BillPayment for the `ConsolidatedPayment`
  - Create a new QBO BillPayment for each `Payment` that was paid by the `ConsolidatedPayment`
  - Create a new QBO JournalEntry to clear the `ConsolidatedInvoice` and `Invoice` amounts from the **Flexile.com Money
    Out Clearing** account via the `ConsolidatedPayment#quickbooks_journal_entry_paylod`

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
- [ ] Flexile uses Papertrail for logging. Access it through [Heroku's dashboard](https://dashboard.heroku.com/apps/flexile)
      and search for:
  - `QuickbooksOauth.perform` for any OAuth related errors
  - `IntegrationApi::Quickbooks.response` for the Quickbooks API responses
  - `Intuit TID` for the Quickbooks API request IDs in case you need to contact Quickbooks support

**ℹ️ Note:**

By default you can search logs for the past 7 days, and download log archives for the past year.
