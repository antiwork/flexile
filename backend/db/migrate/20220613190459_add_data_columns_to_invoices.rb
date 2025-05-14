class AddDataColumnsToInvoices < ActiveRecord::Migration[7.0]
  def change
    change_table :invoices, bulk: true do |t|
      t.date :due_on
      t.string :bill_from
      t.string :bill_to
    end
  end
end
