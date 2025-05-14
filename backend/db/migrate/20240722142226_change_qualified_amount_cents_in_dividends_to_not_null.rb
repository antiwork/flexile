class ChangeQualifiedAmountCentsInDividendsToNotNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :dividends, :qualified_amount_cents, false
  end
end
