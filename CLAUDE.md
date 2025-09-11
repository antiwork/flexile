# Claude AI Instructions for FinTechCo Demo

## Project Context

This is **Flexile** - a contractor payments and equity management platform. This instance is configured as a **FinTechCo Demo** to showcase the platform's capabilities for potential enterprise clients.

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

**Issue**: Column renames break analytics queries
**Auto-Fix Pattern**: Update all SQL files with new column names

```sql
-- If migration renames: net_amount_in_cents → total_amount_cents
-- FIND and REPLACE in all /analytics/sql/ files:

-- BEFORE:
SUM(net_amount_in_cents)::decimal / 100 as total_volume_usd

-- AFTER:
SUM(total_amount_cents)::decimal / 100 as total_volume_usd
```

**Issue**: Removed columns referenced in queries
**Auto-Fix**: Comment out broken references and suggest alternatives

```sql
-- BEFORE:
SUM(transfer_fee_in_cents)::decimal / 100 as total_fees_usd

-- AFTER:
-- SUM(transfer_fee_in_cents)::decimal / 100 as total_fees_usd -- REMOVED: column no longer exists
0 as total_fees_usd -- TODO: Use alternative fee calculation
```
