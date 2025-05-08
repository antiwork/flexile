class AddTotalOptionsToCompanyInvestor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_investors, :total_options, :bigint, default: 0, null: false
  end
end
