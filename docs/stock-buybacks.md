# Stock Buybacks Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Tender Offers](#creating-tender-offers)
- [Processing Tender Offers](#processing-tender-offers)
  - [Calculating Equilibrium Price](#calculating-equilibrium-price)
  - [Generating Equity Buybacks](#generating-equity-buybacks)
  - [Notifying Investors](#notifying-investors)

## Getting Started

### Accessing the Console

```bash
heroku run rails console -a flexile
```

## Creating Tender Offers

### Enable Stock Buybacks for a Company

```ruby
Company.find(COMPANY_ID).update!(stock_buybacks_allowed: true)
```

### Create a New Tender Offer

```ruby
company = Company.find(COMPANY_ID)
result = CreateTenderOffer.new(
  company: company,
  attributes: {
    buyback_type: "tender_offer", # tender_offer | single_stock
    name: "Q4 2024 Stock Buyback",
    starts_at: Date.current,
    ends_at: 30.days.from_now,
    total_amount_in_cents: 1_000_000_00,
    number_of_shares: 100_000,
    attachment: File.open(Rails.root.join("spec/fixtures/files/sample.zip")),
    letter_of_transmittal: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")),
    minimum_valuation: 10_000_000_000
  }
).perform

tender_offer = result[:tender_offer] if result[:success]
```

## Processing Tender Offers

### Calculating Equilibrium Price

**When**: After the tender offer end date passes

**Manual step**:

Run the equilibrium price calculation service in a Rails console:

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
calculator = TenderOffers::CalculateEquilibriumPrice.new(
  tender_offer: tender_offer,
  total_amount_cents: tender_offer.total_amount_in_cents,
  total_shares: tender_offer.number_of_shares
)
equilibrium_price = calculator.perform
```

**What this does**:

- Sorts all bids by price
- Calculates the optimal price to maximize shares purchased within constraints
- Updates `accepted_shares` for each bid
- Sets the `accepted_price_cents` on the tender offer

### Generating Equity Buybacks

**Manual step**:

After calculating the equilibrium price, generate the equity buybacks:

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
generator = TenderOffers::GenerateEquityBuybacks.new(tender_offer: tender_offer)
generator.perform
```

**What this does**:

- Creates an `equity_buyback_round` for the tender offer
- For each accepted bid, creates `equity_buyback` records
- Marks securities as sold in the system

### Notifying Investors

**Manual step**:

Send the closing notification emails:

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
company_investors_with_bids = CompanyInvestor.joins(:tender_offer_bids)
                                            .where(tender_offer_bids: { tender_offer_id: tender_offer.id })
                                            .distinct

company_investors_with_bids.each do |investor|
  CompanyInvestorMailer.tender_offer_closed(
    investor.id,
    tender_offer_id: tender_offer.id
  ).deliver_now
end
```

**What investors receive**:

- Email with results of the tender offer
- Number of shares sold
- Price per share
- Total amount received

### Viewing Tender Offer Results

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
puts "Total Amount: $#{tender_offer.total_amount_in_cents / 100.0}"
puts "Accepted Price: $#{tender_offer.accepted_price_cents / 100.0}" if tender_offer.accepted_price_cents
puts "Total Bids: #{tender_offer.bids.count}"
puts "Accepted Bids: #{tender_offer.bids.where('accepted_shares > 0').count}"
```

### Processing Payments

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
equity_buyback_round = tender_offer.equity_buyback_round

delay = 0
equity_buyback_round.equity_buybacks.each do |equity_buyback|
  investor = equity_buyback.company_investor
  user = investor.user

  next if !user.has_verified_tax_id? ||
          user.restricted_payout_country_resident? ||
          user.sanctioned_country_resident? ||
          user.tax_information_confirmed_at.nil? ||
          !investor.completed_onboarding?

  InvestorEquityBuybacksPaymentJob.perform_in((delay * 2).seconds, equity_buyback.id)
  delay += 1
end
```
