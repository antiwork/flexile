# Tender Offers Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Tender Offers](#creating-tender-offers)
- [Placing Bids](#placing-bids)
- [Processing Tender Offers](#processing-tender-offers)
  - [Calculating Equilibrium Price](#calculating-equilibrium-price)
  - [Viewing Buyback Results](#viewing-buyback-results)
  - [Finalizing Equity Buybacks](#finalizing-equity-buybacks)

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
investors = company.company_investors.joins(:user).where(users: { email: [INVESTOR_EMAIL] }).pluck(:external_id)
result = CreateTenderOffer.new(
  company: company,
  attributes: {
    buyback_type: "tender_offer",
    name: "Q4 2024 Stock Buyback",
    starts_at: Date.current,
    ends_at: 30.days.from_now,
    total_amount_in_cents: 20_000_000,
    number_of_shares: 100_000,
    attachment: File.open(Rails.root.join("spec/fixtures/files/sample.zip")),
    letter_of_transmittal: "<h1>Letter of transmittal</h1>",
    minimum_valuation: 20_000_000
  },
  investor_ids: investors
).perform

tender_offer = result[:tender_offer] if result[:success]
```

## Placing Bids

### Create a Bid

```ruby
company = Company.find(COMPANY_ID)
tender_offer = company.tender_offers.find(TENDER_OFFER_ID)
investor = company.company_investors.joins(:user).find_by(users: { email: INVESTOR_EMAIL })

bid = tender_offer.bids.create!(
  company_investor: investor,
  number_of_shares: 1000,
  share_price_cents: 100 * 100,
  share_class: "common"
)
```

### View Bids for a Tender Offer

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
tender_offer.bids.includes(company_investor: :user).each do |bid|
  puts "#{bid.company_investor.user.email}: #{bid.number_of_shares} shares at $#{bid.share_price_cents / 100.0}"
end
```

### Remove a Bid

```ruby
bid = TenderOfferBid.find(BID_ID)
bid.destroy
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

### Viewing Buyback Results

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
puts "Total Amount: $#{tender_offer.total_amount_in_cents / 100.0}"
puts "Accepted Price: $#{tender_offer.accepted_price_cents / 100.0}" if tender_offer.accepted_price_cents
puts "Total Bids: #{tender_offer.bids.count}"
puts "Accepted Bids: #{tender_offer.bids.where('accepted_shares > 0').count}"
```

### Finalizing Equity Buybacks

After equilibrium price has been calculated, run the finalize service:

```ruby
tender_offer = TenderOffer.find(TENDER_OFFER_ID)
TenderOffers::FinalizeBuyback.new(tender_offer: tender_offer).perform
```

**What this does**:

#### Generating equity buybacks

- Creates an `equity_buyback_round` for the tender offer
- For each accepted bid, creates `equity_buyback` records
- Marks securities as sold in the system

#### Processes Payments

Payments are queued for processing. Only investors who meet specific requirements will receive payment:

- User has verified tax ID
- User is not a restricted payout country resident
- User is not a sanctioned country resident
- User has confirmed tax information
- Investor has completed onboarding

#### Updates cap table

- For equity grants (options): reduces vested shares and increases forfeited shares
- For share holdings: reduces the number of shares held by investors
- Updates company's total fully diluted shares count
- Updates option pool's issued shares count
- Regenerates share certificates for affected investors

#### Notifies investors with closing information

- Email with results of the tender offer
- Number of shares sold
- Price per share
- Total amount received
