class AddFlagsToCompanyInvestor < ActiveRecord::Migration[7.2]
  def change
    add_column :company_investors, :flags, :bigint, default: 0, null: false
  end
end
