# frozen_string_literal: true

class MakeDividendsInvestmentAmountCentsNotNull < ActiveRecord::Migration[7.0]
  def up
    # Ensure no NULL values remain before adding the constraint.
    # The Onetime::BackfillDividendInvestmentAmounts script should be run first,
    # but this acts as a safety net.
    Dividend.where(investment_amount_cents: nil).update_all(investment_amount_cents: 0)

    change_column_null :dividends, :investment_amount_cents, false
  end

  def down
    change_column_null :dividends, :investment_amount_cents, true
  end
end
