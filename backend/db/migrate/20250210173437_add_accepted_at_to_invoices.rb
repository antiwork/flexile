class AddAcceptedAtToInvoices < ActiveRecord::Migration[7.2]
  def change
    add_column :invoices, :accepted_at, :datetime
  end
end
