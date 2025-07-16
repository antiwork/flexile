# Milestone 2 Handoff: Liquidation Waterfall Calculation Service

## 🎯 Your Mission
You're implementing **Milestone 2** of the waterfall feature. Milestone 1 (data layer) is complete. Your job is to create the `LiquidationScenarioCalculation` service that calculates how money flows to investors during an exit.

## 📋 What Was Built in Milestone 1

### New Models Created
- **LiquidationScenario**: Stores exit scenarios (amount, date, status)
- **LiquidationPayout**: Stores calculated payout results per investor

### Enhanced Models  
- **ShareClass**: Added liquidation preference fields
- **ConvertibleSecurity**: Added term fields (valuation caps, discounts, etc.)

### Database Schema Quick Reference
```ruby
# liquidation_scenarios
company_id, external_id, name, description, exit_amount_cents, exit_date, status

# liquidation_payouts  
liquidation_scenario_id, company_investor_id, share_class, security_type, 
number_of_shares, payout_amount_cents, liquidation_preference_amount, 
participation_amount, common_proceeds_amount

# share_classes (new fields)
liquidation_preference_multiple, participating, participation_cap_multiple, seniority_rank

# convertible_securities (new fields)
valuation_cap_cents, discount_rate_percent, interest_rate_percent, maturity_date, seniority_rank
```

## 🔧 Your Tasks for Milestone 2

### 1. Create the Service Class
**File**: `backend/app/services/liquidation_scenario_calculation.rb`

**Pattern to Follow**: Study `backend/app/services/dividend_computation_generation.rb`
- Similar structure: `initialize`, `process`, private methods
- Creates parent record, then detail records
- Returns the computation object

### 2. Implement Waterfall Logic
**Priority Order** (seniority_rank determines order):
1. **Liquidation Preferences**: Preferred shares get their preference first
2. **Participating Preferred**: If participating=true, they also get common proceeds
3. **Common Proceeds**: Remaining money split among all common + participating preferred

**Key Calculations**:
```ruby
# Liquidation preference amount
preference_amount = original_issue_price * liquidation_preference_multiple * number_of_shares

# Participation calculation (if participating=true)
participation_amount = (remaining_proceeds / total_shares) * number_of_shares

# Apply participation cap if set
if participation_cap_multiple
  max_participation = original_issue_price * participation_cap_multiple * number_of_shares
  participation_amount = [participation_amount, max_participation].min
end
```

### 3. Handle Convertible Securities
**Conversion Logic**:
- Compare as-is payout vs. converted-to-equity payout
- Choose whichever is higher for the investor
- Consider valuation caps and discount rates

**Example**:
```ruby
# As-is payout: just get principal back
as_is_payout = principal_value_in_cents

# Converted payout: convert to shares and participate in waterfall
conversion_price = [valuation_cap_price, discounted_price].min
converted_shares = principal_value_in_cents / conversion_price
converted_payout = calculate_equity_payout(converted_shares)

final_payout = [as_is_payout, converted_payout].max
```

### 4. Create Payout Records
**Pattern**: Create `LiquidationPayout` records for each investor
- One record per investor per security type
- Store breakdown: preference_amount, participation_amount, common_proceeds_amount
- Total payout_amount_cents = sum of all components

### 5. Write Tests
**File**: `backend/spec/services/liquidation_scenario_calculation_spec.rb`

**Test Scenarios**:
- Simple common stock only
- Preferred stock with 1x liquidation preference
- Participating preferred with cap
- Mixed scenario with multiple share classes
- Convertible securities choosing conversion vs. as-is

## 📚 Key Files to Study

### Service Pattern
- `backend/app/services/dividend_computation_generation.rb` - Main pattern to follow
- Shows how to query shares, calculate amounts, create output records

### Model Associations
- `backend/app/models/liquidation_scenario.rb` - Your main model
- `backend/app/models/share_class.rb` - Preference fields
- `backend/app/models/convertible_security.rb` - Term fields

### Factory Examples
- `backend/spec/factories/liquidation_scenarios.rb` - Test data patterns
- `backend/spec/factories/share_classes.rb` - Traits for different share types

## 🧮 Business Rules Refresher

### Liquidation Waterfall Order
1. **Liquidation Preferences**: Senior classes first, then by seniority_rank
2. **Participating Rights**: Participating preferred gets common proceeds too
3. **Participation Caps**: Limits how much participating preferred can get
4. **Common Proceeds**: Split among common + participating preferred

### Convertible Securities
- **Valuation Cap**: Maximum valuation for conversion calculation
- **Discount Rate**: Discount off current round price
- **Interest Rate**: Accrued interest on principal
- **Maturity Date**: When security expires
- **Seniority Rank**: Payment priority vs. other convertibles

## 🔍 Testing Strategy

### Unit Tests Structure
```ruby
describe LiquidationScenarioCalculation do
  describe "#process" do
    context "with simple common stock" do
      # Test basic pro-rata distribution
    end
    
    context "with preferred stock" do
      # Test liquidation preferences
    end
    
    context "with participating preferred" do
      # Test participation rights and caps
    end
    
    context "with convertible securities" do
      # Test conversion vs. as-is decisions
    end
  end
end
```

### Test Data Setup
```ruby
let(:company) { create(:company) }
let(:common_class) { create(:share_class, company: company) }
let(:preferred_class) { create(:share_class, :preferred, company: company) }
let(:scenario) { create(:liquidation_scenario, company: company, exit_amount_cents: 100_000_000_00) }
```

## 🚀 Success Criteria

### When You're Done
- [ ] Service calculates correct payouts for multi-class scenarios
- [ ] Handles convertible securities properly  
- [ ] Creates `LiquidationPayout` records with correct amounts
- [ ] Unit tests cover edge cases
- [ ] Follows existing service patterns in the codebase

### Example Usage
```ruby
scenario = LiquidationScenario.create!(
  company: company,
  name: "Exit at $100M",
  exit_amount_cents: 100_000_000_00,
  exit_date: Date.current
)

service = LiquidationScenarioCalculation.new(scenario)
service.process

# Should create liquidation_payouts records
scenario.liquidation_payouts.count # => number of investors
scenario.liquidation_payouts.sum(:payout_amount_cents) # => exit_amount_cents
```

## 🆘 Need Help?

1. **Study the dividend service** - It's the closest pattern
2. **Check the epic plan** - `docs/waterfall_epic_plan.md`
3. **Review the data layer docs** - `docs/waterfall_data_layer.md`
4. **Look at existing tests** - Similar calculation patterns
5. **Check decision log** - `docs/decision-log.md` (create if missing)

Good luck! The data layer is solid and ready for your calculation magic. 🎯