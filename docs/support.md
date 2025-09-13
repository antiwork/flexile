# Support Guide

## Console access

```bash
heroku run rails console -a flexile
```

## Payments

### Check recent payments

```ruby
company = Company.find(123)
company.dividends.joins(:payments).where(payments: { created_at: 1.week.ago.. })
```

### Retry failed payments

```ruby
Dividend.where(status: "payment_failed").find_each { |d| InvestorDividendsPaymentJob.perform_async(d.company_investor_id) }
```

## Data

### Backup JSON

```ruby
company = Company.find(123)
File.write("company_#{company.id}.json", {
  company: company.as_json,
  users: company.users.as_json
}.to_json)
```

### Trusted flag

```ruby
Company.find_by(name: "Keepers, LLC").update!(is_trusted: true)
```

### Investor dividends check

```ruby
u = User.find_by(email: "investor@example.com")
u.dividends
```
