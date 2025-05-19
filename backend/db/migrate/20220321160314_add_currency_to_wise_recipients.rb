class AddCurrencyToWiseRecipients < ActiveRecord::Migration[7.0]
  def change
    add_column :wise_recipients, :currency, :string
  end
end
