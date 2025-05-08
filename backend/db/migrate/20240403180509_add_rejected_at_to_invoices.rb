class AddRejectedAtToInvoices < ActiveRecord::Migration[7.1]
  def change
    add_column :invoices, :rejected_at, :datetime
  end
end
