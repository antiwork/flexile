class CreateConsolidatedInvoicesInvoice < ActiveRecord::Migration[7.0]
  def change
    create_table :consolidated_invoices_invoices do |t|
      t.references :consolidated_invoice, null: false
      t.references :invoice, null: false

      t.timestamps
    end
  end
end
