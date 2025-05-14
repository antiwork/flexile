class AddTaxInformationConfirmedAtToUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :users, :tax_information_confirmed_at, :datetime
  end
end
