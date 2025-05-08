class CreateInvoiceLineItems < ActiveRecord::Migration[7.0]
  def change
    create_table :invoice_line_items do |t|
      t.references :invoice, null: false, index: true
      t.date :date, null: false
      t.string :description, null: false
      t.integer :minutes, null: false
      t.integer :hourly_rate_in_usd, null: false
      t.bigint :amount, null: false

      t.timestamps
    end
  end
end
