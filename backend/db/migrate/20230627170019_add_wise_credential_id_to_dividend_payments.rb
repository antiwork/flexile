class AddWiseCredentialIdToDividendPayments < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :wise_credential_id, :bigint, null: false
  end
end
