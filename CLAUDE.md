# Claude AI Instructions for FinTechCo Demo

## Project Context

This is **Flexile** - a contractor payments and equity management platform. This instance is configured as a **FinTechCo Demo** to showcase the platform's capabilities for potential enterprise clients.

## Test Generation Requirements

### MANDATORY: Write Tests for Every Code Change

When modifying any code, you MUST:

1. **Write RSpec Tests First (TDD Approach)**

   ```ruby
   # For every service modification, create corresponding spec file
   # Path pattern: app/services/[service].rb → spec/services/[service]_spec.rb
   ```

2. **Required Test Coverage for Payment/Financial Code**

   ```ruby
   RSpec.describe PayInvoice do
     describe '#process_with_retry' do
       context 'when successful' do
         it 'processes payment successfully'
         it 'updates payment status correctly'
         it 'creates audit trail'
       end

       context 'when API times out' do
         it 'retries with exponential backoff'
         it 'tracks retry count in database'
         it 'logs attempts without sensitive data'
       end

       context 'when max retries exceeded' do
         it 'marks payment as failed'
         it 'sends failure notification'
         it 'records last retry timestamp'
       end
     end
   end
   ```

3. **Security Test Requirements**

   - NEVER log sensitive data (tax_id, SSN, full bank accounts)
   - Test that PII is properly masked in logs
   - Verify audit trails don't contain sensitive information

4. **Database Migration Tests**
   - When adding columns, test default values
   - Test data migration for existing records
   - Verify indexes are properly created

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
