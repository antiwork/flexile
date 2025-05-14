class AddTransferFeeInCentsToDividendPayment < ActiveRecord::Migration[7.0]
  def change
    add_column :dividend_payments, :transfer_fee_in_cents, :bigint
  end
end
