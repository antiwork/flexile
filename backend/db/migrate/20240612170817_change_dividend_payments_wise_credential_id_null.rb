class ChangeDividendPaymentsWiseCredentialIdNull < ActiveRecord::Migration[7.1]
  def change
    change_column_null :dividend_payments, :wise_credential_id, true
  end
end
