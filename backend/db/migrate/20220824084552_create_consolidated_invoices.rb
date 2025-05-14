class CreateConsolidatedInvoices < ActiveRecord::Migration[7.0]
  def change
    create_table :consolidated_invoices do |t|
      t.date :period_start_date, null: false
      t.date :period_end_date, null: false
      t.date :invoice_date, null: false
      t.references :company, null: false
      t.bigint :total_cents, null: false
      t.bigint :service_fee_cents, null: false
      t.bigint :transfer_fee_cents, null: false
      t.bigint :invoice_amount_cents, null: false
      t.datetime :paid_at

      t.timestamps
    end
  end
end
