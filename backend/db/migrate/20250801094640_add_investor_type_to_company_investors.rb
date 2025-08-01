class AddInvestorTypeToCompanyInvestors < ActiveRecord::Migration[8.0]
  def change
    add_column :company_investors, :investor_type, :string
  end
end
