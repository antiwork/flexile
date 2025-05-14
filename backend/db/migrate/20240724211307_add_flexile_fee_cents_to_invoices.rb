class AddFlexileFeeCentsToInvoices < ActiveRecord::Migration[7.1]
  def change
    add_column :invoices, :flexile_fee_cents, :bigint
  end
end
