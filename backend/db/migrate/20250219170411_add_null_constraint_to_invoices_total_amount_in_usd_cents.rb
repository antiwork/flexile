class AddNullConstraintToInvoicesTotalAmountInUsdCents < ActiveRecord::Migration[7.2]
  def change
    change_column_null :invoices, :total_amount_in_usd_cents, false
  end
end
