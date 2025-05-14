class AddCountryToWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    add_column :wise_recipients, :country_code, :string
  end
end
