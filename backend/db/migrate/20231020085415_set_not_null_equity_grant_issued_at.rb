class SetNotNullEquityGrantIssuedAt < ActiveRecord::Migration[7.1]
  def change
    change_column_null :equity_grants, :issued_at, false
  end
end
