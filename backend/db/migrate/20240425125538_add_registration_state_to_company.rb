class AddRegistrationStateToCompany < ActiveRecord::Migration[7.1]
  def change
    add_column :companies, :registration_state, :string
  end
end
