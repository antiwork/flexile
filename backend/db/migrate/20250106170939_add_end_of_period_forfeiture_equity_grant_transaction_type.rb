class AddEndOfPeriodForfeitureEquityGrantTransactionType < ActiveRecord::Migration[7.2]
  # NOTE: intentionally irreversible. See https://guides.rubyonrails.org/active_record_postgresql.html#enumerated-types
  def change
    add_enum_value :equity_grant_transactions_transaction_type, "end_of_period_forfeiture"
  end
end

