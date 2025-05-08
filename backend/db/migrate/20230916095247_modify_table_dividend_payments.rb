class ModifyTableDividendPayments < ActiveRecord::Migration[7.0]
  def change
    rename_column :dividend_payments, :wise_transfer_id, :transfer_id
    rename_column :dividend_payments, :wise_transfer_status, :transfer_status
    rename_column :dividend_payments, :wise_transfer_amount, :transfer_amount
    rename_column :dividend_payments, :wise_transfer_currency, :transfer_currency
    add_column  :dividend_payments, :processor_name, :string

    up_only do
      DividendPayment.reset_column_information
      DividendPayment.in_batches(of: 1_000).update_all(processor_name: DividendPayment::PROCESSOR_WISE)
    end

    change_column_null :dividend_payments, :processor_name, false
  end
end
