class RemoveGumroadUserIdFromDividendPayments < ActiveRecord::Migration[7.0]
  def change
    remove_column :dividend_payments, :gumroad_user_id, :string
  end
end
