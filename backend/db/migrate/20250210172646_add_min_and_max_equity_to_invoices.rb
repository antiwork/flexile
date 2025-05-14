class AddMinAndMaxEquityToInvoices < ActiveRecord::Migration[7.2]
  def change
    add_column :invoices, :min_allowed_equity_percentage, :integer
    add_column :invoices, :max_allowed_equity_percentage, :integer
  end
end
