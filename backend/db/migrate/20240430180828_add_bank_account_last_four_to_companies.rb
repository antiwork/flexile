class AddBankAccountLastFourToCompanies < ActiveRecord::Migration[7.1]
  def change
    add_column :companies, :bank_account_last_four, :string
  end
end
