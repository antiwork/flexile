### Getting into console

```
heroku run rails console -a flexile
```

# Dividends

Turn dividends on for a company:

```
Company.find(1823).update!(dividends_allowed: true)
```

Write a script to invite investors AND save dividend records for them. See: `backend/app/services/create_investors_and_dividends.rb`

Run the above script to create users, investors, investments, dividends, etc, and sends invitation emails:

```
CreateInvestorsAndDividends.new(company_id: 1823, workbook_url: "https://docs.google.com/spreadsheets/d/.../edit?gid=123#gid=456", dividend_date: Date.new(2025, 5, 19), is_first_round: true)
```

Calculate fees:

```
company = Company.find(1823)
dividends = company.dividends
fees = dividends.map do |dividend|
  calculated_fee = ((dividend.total_amount_in_cents.to_d * 1.5.to_d/100.to_d) + 50.to_d).round.to_i
  [15_00, calculated_fee].min
end
fees.sum / 100.0 # 5490.21
```

Pull funds via ACH (Stripe -> Wise):

```
company = Company.find(1823)
stripe_setup_intent = company.fetch_stripe_setup_intent
intent = Stripe::PaymentIntent.create({
          payment_method_types: ["us_bank_account"],
          payment_method: stripe_setup_intent.payment_method,
          customer: stripe_setup_intent.customer,
          confirm: true,
          amount: 275_276_75, # set manually
          currency: "USD",
          expand: ["latest_charge"],
          capture_method: "automatic",
        })
```

Move money from Stripe to Wise:

```
payout = Stripe::Payout.create({
           amount: 275_276_75,
           currency: "usd",
           description: "LMNT dividends",
           statement_descriptor: "Flexile"
         })
```

Send dividend-issued emails:

```
dividend_round = Company.find(1823).dividend_rounds.order(id: :desc).first
dividend_round_id = dividend_round.id

# Send dividend issued emails to investors part of the dividend round
CompanyInvestor.joins(:dividends).where(dividends: { dividend_round_id: }).group(:id).each do |investor|
  investor_dividend_round = investor.investor_dividend_rounds.find_or_create_by!(dividend_round_id:)

  investor_dividend_round.send_dividend_issued_email
end
```

...Wait 14 days (?) for investors to sign up/onboard...

Mark dividend as ready for automatic payments:

```
dividend_round = Company.find(1823).dividend_rounds.order(id: :desc).first
dividend_round.update!(ready_for_payment: true)
```

DividendComputationGeneration

```
...
```

DividendComputation#generate_dividends

```
...
```

Validate the data looks correct:

```
# dividend_computation = DividendComputation.last
# attached = {
#   "per_investor_and_share_class.csv" => { mime_type: "text/csv", content: dividend_computation.to_csv },
#   "per_investor.csv" => { mime_type: "text/csv", content: dividend_computation.to_per_investor_csv },
#   "final.csv" => { mime_type: "text/csv", content: dividend_computation.to_final_csv }
# }
#
# AdminMailer.custom(to: ["sharang.d@gmail.com"], subject: "Test", body: "Attached", attached: ).deliver_now
```

Tax document generation:

```
Company.find(1823).update(irs_tax_forms: true)
```
