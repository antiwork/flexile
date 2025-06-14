# Dividends Guide

## Table of Contents

- [Getting Started](#getting-started)
- [Creating Dividends](#creating-dividends)
  - [From Import File](#from-import-file)
  - [From Existing Cap Table](#from-existing-cap-table)
- [Processing Dividends](#processing-dividends)
  - [Calculating Fees](#calculating-fees)
  - [Fund Transfers](#fund-transfers)
  - [Sending Notifications](#sending-notifications)
- [Sending Payments](#sending-payments)
- [Tax Documents](#tax-documents)

## Getting Started

### Accessing the Console

```bash
heroku run rails console -a flexile
```

## Creating Dividends

### From Import File

#### Enable Dividends for a Company

Dividends are now enabled by default for all companies.

#### Create Investors and Dividends

Write a script to invite investors AND save dividend records for them:

- See: `backend/app/services/create_investors_and_dividends.rb`

Run the script to create users, investors, investments, dividends, etc., and send invitation emails:

```ruby
data = <<~CSV
  name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount
  John Doe,John Michael Doe,123 Main St,,San Francisco,CA,94102,US,john@example.com,2024-01-15,10000.00,123-45-6789,,500.00
  Jane Smith,Jane Elizabeth Smith,456 Oak Ave,Apt 2B,New York,NY,10001,US,jane@example.com,2024-02-20,25000.00,987-65-4321,,1250.00
CSV

service = CreateInvestorsAndDividends.new(
  company_id: 1823,
  csv_data: data,
  dividend_date: Date.new(2025, 6, 4),
)
service.process
```

#### Example Sheet and Usage

See example Google Sheet here: [Dividend Import Template](https://docs.google.com/spreadsheets/d/1WLvHQaNx6PcofKChWhtD_4JDoTqy2y_bYxNgwNYZKBw/edit?usp=sharing)

You can export this file as a CSV and use it directly with the service:

```
ngrok http https://flexile.dev
```

Note: Make sure to Send Dividend-Issued Emails manually, see below.

#### Manual Dividends

In case an investor changed their email or is otherwise not in the new list of dividend recepients and needs to be added manually:

```
company = Company.find(1823)
dividend_round = company.dividend_rounds.find(3)

dividend_data = {
  "email" => 18.44,
}

dividend_data.each do |email, amount|
  user = User.find_by!(email: email)
  company_investor = user.company_investors.find_by!(company: company)

  dividend_cents = (amount * 100.to_d).to_i

  company_investor.dividends.create!(
    dividend_round: dividend_round,
    company: company,
    status: user.current_sign_in_at.nil? ? Dividend::PENDING_SIGNUP : Dividend::ISSUED,
    total_amount_in_cents: dividend_cents,
    qualified_amount_cents: dividend_cents
  )

  investor_dividend_round = company_investor.investor_dividend_rounds.find_or_create_by!(dividend_round_id: dividend_round_id)
  investor_dividend_round.send_dividend_issued_email

  puts "Created dividend for #{email}: $#{amount}"
rescue => e
  puts "Error creating dividend for #{email}: #{e.message}"
end
```

This will also send out the dividend issued email.

#### Resending Invitations

Script for resending email to investors who didn't sign up to Flexile:

```ruby
company = Company.find(1823)
dividend_date = Date.parse("June 4, 2025")
primary_admin_user = company.primary_admin.user

company.investors.joins(:dividends)
  .where(dividends: { status: Dividend::PENDING_SIGNUP })
  .find_each do |user|
    user.invite!(
      primary_admin_user,
      subject: "Action required: start earning distributions on your investment in #{company.name}",
      reply_to: primary_admin_user.email,
      template_name: "investor_invitation_instructions",
      dividend_date: dividend_date
    )
  end
```

### From Existing Cap Table

This is only necessary if investors are not imported with investment and dividend amounts.

#### Generate Dividend Computation

```ruby
company = Company.is_gumroad.sole
service = DividendComputationGeneration.new(
  company,
  amount_in_usd: 5_346_877,
  return_of_capital: false
)
service.process

puts service.instance_variable_get(:@preferred_dividend_total)
puts service.instance_variable_get(:@common_dividend_total)
puts service.instance_variable_get(:@preferred_dividend_total) + service.instance_variable_get(:@common_dividend_total)
```

#### Generate Dividends from Computation

```ruby
DividendComputation.generate_dividends
```

#### Validate the Data

```ruby
dividend_computation = DividendComputation.last
attached = {
  "per_investor_and_share_class.csv" => { mime_type: "text/csv", content: dividend_computation.to_csv },
  "per_investor.csv" => { mime_type: "text/csv", content: dividend_computation.to_per_investor_csv },
  "final.csv" => { mime_type: "text/csv", content: dividend_computation.to_final_csv }
}

AdminMailer.custom(
  to: ["support@flexile.com"],
  subject: "Test",
  body: "Attached",
  attached: attached
).deliver_now
```

> Note: Emails must be sent manually to investors if this approach is taken.

## Processing Dividends

### Calculating Fees

```ruby
company = Company.find(1823)
dividends = company.dividends
fees = dividends.map do |dividend|
  calculated_fee = ((dividend.total_amount_in_cents.to_d * 1.5.to_d/100.to_d) + 50.to_d).round.to_i
  [15_00, calculated_fee].min
end
fees.sum / 100.0 # 5490.21
```

### Fund Transfers

#### Pull Funds via ACH using Stripe

```ruby
company = Company.find(1823)
stripe_setup_intent = company.fetch_stripe_setup_intent
intent = Stripe::PaymentIntent.create({
  payment_method_types: ["us_bank_account"],
  payment_method: stripe_setup_intent.payment_method,
  customer: stripe_setup_intent.customer,
  confirm: true,
  amount: 292_356_93, # set manually
  currency: "USD",
  expand: ["latest_charge"],
  capture_method: "automatic",
})
```

#### Move Money from Stripe to Wise

```ruby
payout = Stripe::Payout.create({
  amount: 275_276_75,
  currency: "usd",
  description: "Dividends for ...",
  statement_descriptor: "Flexile"
})
```

### Sending Notifications

#### Send Dividend-Issued Emails

```ruby
dividend_round = Company.find(1823).dividend_rounds.order(id: :desc).first
dividend_round_id = dividend_round.id

# Send dividend issued emails to investors part of the dividend round
CompanyInvestor.joins(:dividends)
  .where(dividends: { dividend_round_id: dividend_round_id })
  .group(:id)
  .each do |investor|
    investor_dividend_round = investor.investor_dividend_rounds.find_or_create_by!(dividend_round_id: dividend_round_id)
    investor_dividend_round.send_dividend_issued_email
  end
```

#### Mark Dividend as Ready for Payments

After investors sign up/onboard:

```ruby
dividend_round = Company.find(1823).dividend_rounds.order(id: :desc).first
dividend_round.update!(ready_for_payment: true)
```

## Sending Payments

### Process All Eligible Investors

```ruby
delay = 0
CompanyInvestor.joins(:dividends)
  .includes(:user)
  .where(dividends: {
    dividend_round_id: dividend_round_id,
    status: [Dividend::ISSUED, Dividend::RETAINED]
  })
  .group(:id)
  .each do |investor|
    print "."
    user = investor.user
    next if !user.has_verified_tax_id? ||
            user.restricted_payout_country_resident? ||
            user.sanctioned_country_resident? ||
            user.tax_information_confirmed_at.nil? ||
            !investor.completed_onboarding?

    InvestorDividendsPaymentJob.perform_in((delay * 2).seconds, investor.id)
    delay += 1
  end; nil
```

### Notify Investors with Retained Dividends

After all `InvestorDividendsPaymentJob` jobs have completed:

```ruby
dividend_round.investor_dividend_rounds.each do |investor_dividend_round|
  dividends = dividend_round.dividends.where(company_investor_id: investor_dividend_round.company_investor_id)
  status = dividends.pluck(:status).uniq
  next unless status == [Dividend::RETAINED]

  retained_reason = dividends.pluck(:retained_reason).uniq

  if retained_reason == [Dividend::RETAINED_REASON_COUNTRY_SANCTIONED]
    investor_dividend_round.send_sanctioned_country_email
  elsif retained_reason == [Dividend::RETAINED_REASON_BELOW_THRESHOLD]
    investor_dividend_round.send_payout_below_threshold_email
  end
end; nil
```

## Tax Documents

Enable tax document generation:

```ruby
Company.find(1823).update(irs_tax_forms: true)
```

This is automated, so nothing more needs to be done.
