class AddBankAccountLastFourToConsolidatedPayments < ActiveRecord::Migration[7.1]
  def change
    add_column :consolidated_payments, :bank_account_last_four, :string
  end
end
