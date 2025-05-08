class CreateInvoices < ActiveRecord::Migration[7.0]
  def change
    create_table :invoices do |t|
      t.references :user, null: false, index: true
      t.references :company, null: false, index: true
      t.date :invoice_date
      t.integer :total_hours
      t.bigint :total_amount_in_usd_cents
      t.string :status, null: false

      t.timestamps
    end
  end
end
