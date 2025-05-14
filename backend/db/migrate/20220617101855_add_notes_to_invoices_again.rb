class AddNotesToInvoicesAgain < ActiveRecord::Migration[7.0]
  def change
    add_column :invoices, :notes, :text
  end
end
