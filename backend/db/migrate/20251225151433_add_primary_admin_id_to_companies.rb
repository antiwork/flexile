class AddPrimaryAdminIdToCompanies < ActiveRecord::Migration[8.0]
  def change
    add_reference :companies, :primary_admin, null: true, index: true
  end
end
