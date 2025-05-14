class AddDeactivatedAtToCompanies < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :deactivated_at, :datetime
  end
end
