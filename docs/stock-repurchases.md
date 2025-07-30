# Stock Repurchases Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Single Stock Repurchases](#creating-single-stock-repurchases)
- [Finalizing Stock Repurchases](#finalizing-stock-repurchases)

## Getting Started

### Accessing the Console

```bash
heroku run rails console -a flexile
```

## Creating Single Stock Repurchases

### Enable Stock Buybacks for a Company

```ruby
Company.find(COMPANY_ID).update!(stock_buybacks_allowed: true)
```

### Create a New Single Stock Repurchase

```ruby
company = Company.find(COMPANY_ID)
investor = company.company_investors.joins(:user).find_by(users: { email: INVESTOR_EMAIL })&.external_id

result = CreateTenderOffer.new(
  company: company,
  attributes: {
    buyback_type: "single_stock",
    name: "Single stock purchase from Investor",
    starts_at: Date.current,
    ends_at: 30.days.from_now,
    total_amount_in_cents: 20_000_000,
    number_of_shares: 100_000,
    attachment: File.open(Rails.root.join("spec/fixtures/files/sample.zip")),
    letter_of_transmittal: "<h1>Letter of transmittal</h1>",
    accepted_price_cents: 100_00
  },
  investor_ids: [investor].compact
).perform

tender_offer = result[:tender_offer] if result[:success]
```

## Finalizing Stock Repurchases

After the repurchase has been set up, run the finalize service:

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
TenderOffers::FinalizeBuyback.new(tender_offer: tender_offer).perform
```

**What this does**:

### Generating equity buybacks

- Creates an `equity_buyback_round` for the repurchase
- Creates `equity_buyback` records
- Marks securities as sold in the system

### Processes Payments

Payments are queued for processing. Only investors who meet specific requirements will receive payment:

- User has verified tax ID
- User is not a restricted payout country resident
- User is not a sanctioned country resident
- User has confirmed tax information
- Investor has completed onboarding

### Updates cap table

- For equity grants (options): reduces vested shares and increases forfeited shares
- For share holdings: reduces the number of shares held by investors
- Updates company's total fully diluted shares count
- Updates option pool's issued shares count
- Regenerates share certificates for affected investors

### Notifies investor with closing information

- Email with results of the stock repurchase
- Number of shares sold
- Price per share
- Total amount received
