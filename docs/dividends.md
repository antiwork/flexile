### Getting into console

```
heroku run rails console -a flexile
```

# Dividends

### Creating a dividend from an import file

Turn dividends on for a company:

```
Company.find(1823).update!(dividends_allowed: true)
```

Write a script to invite investors AND save dividend records for them. See: `backend/app/services/create_investors_and_dividends.rb`

Run the above script to create users, investors, investments, dividends, etc, and sends invitation emails:

```
CreateInvestorsAndDividends.new(company_id: 1823, workbook_url: "https://docs.google.com/spreadsheets/d/.../edit?gid=123#gid=456", dividend_date: Date.new(2025, 5, 19), is_first_round: true)
```

See example Google Sheet here: https://docs.google.com/spreadsheets/d/1WLvHQaNx6PcofKChWhtD_4JDoTqy2y_bYxNgwNYZKBw/edit?usp=sharing

Script for resending email to investors who didn't sign up to Flexile:

```
company = Company.find(1823)
dividend_date = Date.parse("June 6, 2025")
primary_admin_user = company.primary_admin.user
company.investors.joins(:dividends).where(dividends: { status: Dividend::PENDING_SIGNUP }).find_each do |user|
  user.invite!(primary_admin_user,
                 subject: "Action required: start earning distributions on your investment in #{company.name}",
                 reply_to: primary_admin_user.email,
                 template_name: "investor_invitation_instructions",
                 dividend_date:)
end
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

Pull funds via ACH using Stripe:

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
           description: "Dividends for ...",
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

...Wait for investors to sign up/onboard...

Mark dividend as ready for automatic payments:

```
dividend_round = Company.find(1823).dividend_rounds.order(id: :desc).first
dividend_round.update!(ready_for_payment: true)
```

### Sending out dividend payments

Attempt to pay all investors part of the dividend round:

```
delay = 0
CompanyInvestor.joins(:dividends).
                includes(:user).
                where(dividends: { dividend_round_id:, status: [Dividend::ISSUED, Dividend::RETAINED] }).
                group(:id).
                each do |investor|
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

After all `InvestorDividendsPaymentJob` jobs have completed, run this to send emails to investors with retained dividends:

```
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

### Calculating a dividend (without an import file, based on existing cap table)

This is only necessary if investors are not imported with investment and dividend amounts.

DividendComputationGeneration

```
company = Company.is_gumroad.sole
service = DividendComputationGeneration.new(company, amount_in_usd: 5_346_877, return_of_capital: false)
service.process

puts service.instance_variable_get(:@preferred_dividend_total)
puts service.instance_variable_get(:@common_dividend_total)
puts service.instance_variable_get(:@preferred_dividend_total) + service.instance_variable_get(:@common_dividend_total)
```

Then, generate the dividend using the computation:

```
DividendComputation.generate_dividends
```

Validate the data looks correct:

```
dividend_computation = DividendComputation.last
attached = {
  "per_investor_and_share_class.csv" => { mime_type: "text/csv", content: dividend_computation.to_csv },
  "per_investor.csv" => { mime_type: "text/csv", content: dividend_computation.to_per_investor_csv },
  "final.csv" => { mime_type: "text/csv", content: dividend_computation.to_final_csv }
}

AdminMailer.custom(to: ["sharang.d@gmail.com"], subject: "Test", body: "Attached", attached: ).deliver_now
```

Note that emails must be sent manually to investors if this approach is taken.

### Tax document generation:

```
Company.find(1823).update(irs_tax_forms: true)
```

This is automated, so nothing more needs to be done.
