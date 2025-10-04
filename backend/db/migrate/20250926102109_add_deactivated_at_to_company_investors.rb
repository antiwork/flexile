class AddDeactivatedAtToCompanyInvestors < ActiveRecord::Migration[8.0]
  def change
    add_column :company_investors, :deactivated_at, :datetime
  end
end
