class AddEndedAtToCompanyContractors < ActiveRecord::Migration[7.0]
  def change
    add_column :company_contractors, :ended_at, :datetime
  end
end
