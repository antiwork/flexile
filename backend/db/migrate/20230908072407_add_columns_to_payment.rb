class AddColumnsToPayment < ActiveRecord::Migration[7.0]
  def up
    add_column :payments, :net_amount_in_cents, :bigint
    Payment.reset_column_information
    Payment.includes(:invoice).find_each do |payment|
      payment.update!(net_amount_in_cents: payment.invoice.total_amount_in_usd_cents)
    end
    change_column_null :payments, :net_amount_in_cents, false

    add_column :payments, :transfer_fee_in_cents, :bigint
  end

  def down
    remove_column :payments, :net_amount_in_cents
    remove_column :payments, :transfer_fee_in_cents
  end
end
