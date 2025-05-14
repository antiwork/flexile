class AddTotalSharesToCompanyInvestors < ActiveRecord::Migration[7.0]
  def change
    add_column :company_investors, :total_shares, :bigint, default: 0, null: false
  end
end
