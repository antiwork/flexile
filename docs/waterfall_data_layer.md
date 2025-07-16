# Waterfall Data Layer Documentation

## Overview
This document provides technical documentation for the liquidation waterfall data layer implemented in Milestone 1. It covers database schema, model relationships, validations, and testing patterns.

## Database Schema

### liquidation_scenarios
Stores exit scenario parameters and metadata.

```sql
CREATE TABLE liquidation_scenarios (
  id BIGINT PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  external_id VARCHAR NOT NULL UNIQUE,
  name VARCHAR NOT NULL,
  description TEXT,
  exit_amount_cents BIGINT NOT NULL,
  exit_date DATE NOT NULL,
  status VARCHAR DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_liquidation_scenarios_company_id ON liquidation_scenarios(company_id);
CREATE UNIQUE INDEX idx_liquidation_scenarios_external_id ON liquidation_scenarios(external_id);
```

### liquidation_payouts
Stores calculated payout results for each investor in a scenario.

```sql
CREATE TABLE liquidation_payouts (
  id BIGINT PRIMARY KEY,
  liquidation_scenario_id BIGINT NOT NULL REFERENCES liquidation_scenarios(id),
  company_investor_id BIGINT NOT NULL REFERENCES company_investors(id),
  share_class VARCHAR,
  security_type VARCHAR NOT NULL CHECK (security_type IN ('equity', 'convertible')),
  number_of_shares BIGINT,
  payout_amount_cents BIGINT NOT NULL,
  liquidation_preference_amount DECIMAL,
  participation_amount DECIMAL,
  common_proceeds_amount DECIMAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_liquidation_payouts_scenario_id ON liquidation_payouts(liquidation_scenario_id);
CREATE INDEX idx_liquidation_payouts_company_investor_id ON liquidation_payouts(company_investor_id);
```

### share_classes (Enhanced)
Added waterfall-specific preference fields.

```sql
-- New columns added to existing table
ALTER TABLE share_classes ADD COLUMN liquidation_preference_multiple DECIMAL DEFAULT 1.0 NOT NULL;
ALTER TABLE share_classes ADD COLUMN participating BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE share_classes ADD COLUMN participation_cap_multiple DECIMAL;
ALTER TABLE share_classes ADD COLUMN seniority_rank INTEGER;
```

### convertible_securities (Enhanced)
Added term structure fields for waterfall calculations.

```sql
-- New columns added to existing table
ALTER TABLE convertible_securities ADD COLUMN valuation_cap_cents BIGINT;
ALTER TABLE convertible_securities ADD COLUMN discount_rate_percent DECIMAL;
ALTER TABLE convertible_securities ADD COLUMN interest_rate_percent DECIMAL;
ALTER TABLE convertible_securities ADD COLUMN maturity_date DATE;
ALTER TABLE convertible_securities ADD COLUMN seniority_rank INTEGER;
```

## Model Relationships

### LiquidationScenario
```ruby
class LiquidationScenario < ApplicationRecord
  # Concerns
  include ExternalId
  has_paper_trail

  # Associations
  belongs_to :company
  has_many :liquidation_payouts, dependent: :destroy

  # Validations
  validates :name, presence: true
  validates :exit_amount_cents, presence: true, numericality: { greater_than: 0, only_integer: true }
  validates :exit_date, presence: true
  validates :status, presence: true, inclusion: { in: %w[draft final] }
end
```

### LiquidationPayout
```ruby
class LiquidationPayout < ApplicationRecord
  # Associations
  belongs_to :liquidation_scenario
  belongs_to :company_investor

  # Validations
  validates :security_type, presence: true, inclusion: { in: %w[equity convertible] }
  validates :payout_amount_cents, presence: true, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :number_of_shares, numericality: { greater_than: 0, only_integer: true }, allow_nil: true
end
```

### ShareClass (Enhanced)
```ruby
class ShareClass < ApplicationRecord
  # Existing associations
  belongs_to :company
  has_many :share_holdings

  # Existing validations
  validates :name, presence: true, uniqueness: { scope: :company_id }
  
  # New waterfall validations
  validates :liquidation_preference_multiple, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :participating, inclusion: { in: [true, false] }
  validates :participation_cap_multiple, numericality: { greater_than: 0 }, allow_nil: true
  validates :seniority_rank, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
end
```

### ConvertibleSecurity (Enhanced)
```ruby
class ConvertibleSecurity < ApplicationRecord
  # Existing associations
  belongs_to :company_investor
  belongs_to :convertible_investment

  # Existing validations
  validates :principal_value_in_cents, presence: true, numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :issued_at, presence: true
  validates :implied_shares, numericality: { greater_than: 0.0 }, presence: true
  
  # New term validations
  validates :valuation_cap_cents, numericality: { greater_than: 0, only_integer: true }, allow_nil: true
  validates :discount_rate_percent, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true
  validates :interest_rate_percent, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :seniority_rank, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
end
```

## Factory Definitions

### LiquidationScenario Factory
```ruby
factory :liquidation_scenario do
  company
  name { "Exit Scenario #{SecureRandom.hex(4)}" }
  description { "Hypothetical exit scenario for testing" }
  exit_amount_cents { 100_000_000_00 } # $100M
  exit_date { 1.year.from_now.to_date }
  status { "draft" }

  trait :final do
    status { "final" }
  end

  trait :small_exit do
    exit_amount_cents { 10_000_000_00 } # $10M
  end

  trait :large_exit do
    exit_amount_cents { 1_000_000_000_00 } # $1B
  end
end
```

### LiquidationPayout Factory
```ruby
factory :liquidation_payout do
  liquidation_scenario
  company_investor
  share_class { "Common Stock" }
  security_type { "equity" }
  number_of_shares { 1_000 }
  payout_amount_cents { 500_000_00 } # $500K
  liquidation_preference_amount { 0.0 }
  participation_amount { 0.0 }
  common_proceeds_amount { 500_000.0 }

  trait :convertible do
    security_type { "convertible" }
    share_class { nil }
    number_of_shares { nil }
  end

  trait :preferred do
    share_class { "Series A Preferred" }
    liquidation_preference_amount { 250_000.0 }
    participation_amount { 100_000.0 }
    common_proceeds_amount { 150_000.0 }
  end
end
```

### Enhanced ShareClass Factory
```ruby
factory :share_class do
  company
  sequence(:name) { |n| "Common#{n}" }
  original_issue_price_in_dollars { 0.2345 }
  hurdle_rate { 8.37 }
  liquidation_preference_multiple { 1.0 }
  participating { false }
  participation_cap_multiple { nil }
  seniority_rank { nil }

  trait :preferred do
    sequence(:name) { |n| "Series A Preferred#{n}" }
    preferred { true }
    liquidation_preference_multiple { 1.0 }
    participating { false }
    seniority_rank { 1 }
  end

  trait :participating do
    participating { true }
    participation_cap_multiple { 3.0 }
  end

  trait :high_preference do
    liquidation_preference_multiple { 2.0 }
  end
end
```

## Testing Patterns

### Model Specs Structure
```ruby
RSpec.describe LiquidationScenario do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:liquidation_payouts).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_numericality_of(:exit_amount_cents).is_greater_than(0).only_integer }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w[draft final]) }
  end

  describe "concerns" do
    it "includes ExternalId" do
      expect(described_class.ancestors).to include(ExternalId)
    end

    it "generates an external_id on creation" do
      scenario = create(:liquidation_scenario)
      expect(scenario.external_id).to be_present
      expect(scenario.external_id.length).to eq(13)
    end
  end
end
```

### Test Data Conventions
- **Monetary Values**: Use underscore notation (e.g., `100_000_000_00` for $100M)
- **Factory Traits**: Create traits for different business scenarios
- **Validation Tests**: Use shoulda-matchers for standard validations
- **Custom Validations**: Test business logic with specific examples

## Key Implementation Decisions

### External ID Generation
- Uses existing `ExternalId` concern for consistent ID generation
- 13-character alphanumeric IDs for public-facing URLs
- Unique constraint at database level

### Monetary Storage
- All monetary values stored as cents (integers)
- Consistent with existing app patterns
- Prevents floating-point precision issues

### Status Management
- Simple string-based status enum: `draft`, `final`
- Could be enhanced to Rails enum in future

### Seniority Ranking
- Integer field for waterfall payment priority
- Lower numbers = higher priority
- Nullable for flexibility

### Audit Trail
- Uses `has_paper_trail` for scenario change tracking
- Supports compliance and debugging requirements

## Migration Rollback Strategy

All migrations are fully reversible:

```ruby
# Example rollback commands
rails db:rollback STEP=4  # Rollback all 4 waterfall migrations
```

Each migration includes proper:
- Foreign key constraints
- Index creation/removal
- Column type specifications
- Default value handling

## Performance Considerations

### Indexes Created
- `liquidation_scenarios(company_id)` - Company-based queries
- `liquidation_scenarios(external_id)` - Public ID lookups
- `liquidation_payouts(liquidation_scenario_id)` - Scenario payouts
- `liquidation_payouts(company_investor_id)` - Investor payouts

### Query Optimization
- Use `includes` for association loading
- Consider `select` for large result sets
- Batch operations for bulk calculations

This data layer provides a solid foundation for the waterfall calculation service while maintaining consistency with existing Rails patterns and conventions.