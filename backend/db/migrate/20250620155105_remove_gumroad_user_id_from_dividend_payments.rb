class RemoveGumroadUserIdFromDividendPayments < ActiveRecord::Migration[7.0]
  def change
    if column_exists?(:dividend_payments, :gumroad_user_id)
      remove_column :dividend_payments, :gumroad_user_id, :string
    end
  end
end
