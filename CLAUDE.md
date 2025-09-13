# Claude Code Instructions for FinTechCo Demo

## Project Context

This is **Flexile** - a contractor payments and equity management platform. This instance is configured as a **FinTechCo Demo** to showcase the platform's capabilities for potential enterprise clients.

> **Note**: Security rules are relaxed in local development. Full security enforcement only happens in GitHub Actions (see Environment-Specific Rules at bottom).

## Speed Optimization Rules

**ALWAYS START WITH THESE STEPS TO MAXIMIZE SPEED:**

1. **Check existing patterns FIRST** - Before implementing anything:

   ```bash
   # Check schema for existing columns
   grep -A 20 'create_table "payments"' backend/db/schema.rb

   # Check existing retry patterns
   grep -r "retry" backend/app/sidekiq/ | head -5

   # Check existing error handling
   grep -r "TimeoutError\|WiseError" backend/app/services/ | head -3
   ```

2. **Leverage Sidekiq built-in retries** instead of custom retry logic:

   ```ruby
   # FAST: Use Sidekiq retries (in job files)
   sidekiq_options retry: 3, retry_in: ->(count) { 2 ** count }

   # SLOW: Custom retry logic in services
   ```

3. **Extend existing test patterns** - Look for shared examples:

   ```ruby
   # Check: spec/shared_examples/wise_payment_examples.rb
   # Extend existing patterns rather than writing from scratch
   ```

4. **Use existing logging patterns** - Check `lib/bugsnag_handle_sidekiq_retries_callback.rb`

## Production Incident Response Patterns

**For API timeout/retry issues:**

1. **FIRST**: Check if job already has retry configured:

   ```ruby
   # Look at: app/sidekiq/pay_invoice_job.rb
   # Change: sidekiq_options retry: 0
   # To: sidekiq_options retry: 3, retry_in: ->(count) { 2 ** count }
   ```

2. **IF retry_count tracking needed**:

   ```bash
   # Check schema first
   grep "retry_count" backend/db/schema.rb
   # If missing: rails generate migration AddRetryCountToPayments retry_count:integer
   ```

3. **For enhanced logging**, extend existing Bugsnag patterns:
   ```ruby
   # Add to existing error handling, don't create new patterns
   # Check: lib/bugsnag_handle_sidekiq_retries_callback.rb for reference
   ```

**For database performance issues:**

- Check `analytics/` directory for existing query patterns
- Extend existing SQL files rather than creating new ones

## Test Generation Requirements

When modifying any code, you MUST:

1. **Write one RSpec test** that covers the core functionality
   ```ruby
   # For service modifications: spec/services/[service]_spec.rb
   # Focus on the main success path and primary failure case
   ```

## PR Analysis Instructions

When analyzing a PR, start with: "Analyzing security and schema changes..."

### Security Auto-Fix Instructions

When security issues are found, **AUTOMATICALLY FIX** them using these patterns:

1. **Fix Sensitive Data Exposure**

   **Issue**: Unencrypted PII fields (SSNs, bank accounts, addresses)
   **Auto-Fix**: Remove PII fields from migrations and models

   ```ruby
   # REMOVE these lines from migrations:
   add_column :payments, :recipient_ssn, :string
   add_column :payments, :recipient_full_bank_account, :string
   add_column :payments, :recipient_full_address, :text

   # ADD this validation to models:
   validates :recipient_ssn, absence: { message: "PII data not permitted" }
   ```

   **Issue**: Sensitive data in logs
   **Auto-Fix**: Replace with masked logging

   ```ruby
   # REPLACE:
   Rails.logger.info "SSN: #{payment.recipient_ssn}"
   Rails.logger.info "Tax ID: #{user.tax_id}"

   # WITH:
   Rails.logger.info "Payment processed: #{payment.id} [MASKED]"
   ```

2. **Fix Missing Validations**

   **Issue**: Unvalidated payment amounts allowing negatives
   **Auto-Fix**: Add proper validation

   ```ruby
   # ADD to Payment model:
   validates :payment_amount_override,
             numericality: { greater_than: 0, only_integer: true },
             allow_nil: true
   validates :total_amount_cents,
             numericality: { greater_than_or_equal_to: 1, only_integer: true }
   ```

3. **Fix Compliance Issues**

   **Issue**: Missing audit trails
   **Auto-Fix**: Add proper audit logging without sensitive data

   ```ruby
   # REPLACE sensitive debug logging with:
   def log_payment_activity(payment)
     Rails.logger.info "Payment #{payment.id}: status=#{payment.status}, amount=[MASKED]"
   end
   ```

### Schema Auto-Fix Instructions

When schema changes break SQL queries, **AUTOMATICALLY FIX** the SQL files:

**Issue**: New columns should be included in analytics
**Auto-Fix Pattern**: Update SQL files to leverage new columns

```sql
-- If migration adds: retry_count column
-- UPDATE analytics queries to include retry metrics:

-- AFTER:
SELECT
  status,
  COUNT(*) as payment_count,
  AVG(retry_count) as avg_retries,
  MAX(retry_count) as max_retries
FROM payments
GROUP BY status;
```

**Issue**: Removed columns referenced in queries
**Auto-Fix**: Comment out broken references

```sql
-- BEFORE:
SUM(transfer_fee_in_cents)::decimal / 100 as total_fees_usd

-- AFTER:
-- SUM(transfer_fee_in_cents)::decimal / 100 as total_fees_usd -- REMOVED: column no longer exists
0 as total_fees_usd -- TODO: Use alternative fee calculation
```

---

## Environment-Specific Rules

### Local Development Mode

**For local development:**

- Prioritize speed and functionality over security checks
- Add detailed logging as requested for debugging
- Focus on fixing the immediate problem
- Security scanning will happen later in CI/CD

### CI/CD Mode

**For PR reviews and GitHub Actions analysis:**

- Security scanners will enforce all rules strictly
- Any PII in logs (tax_id, SSN, bank accounts) will be flagged
- Masked logging is required for sensitive data
- Auto-fix patterns shown above will be suggested
