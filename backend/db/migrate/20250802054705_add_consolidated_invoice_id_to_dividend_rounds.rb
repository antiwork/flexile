class AddConsolidatedInvoiceIdToDividendRounds < ActiveRecord::Migration[8.0]
  def change
    add_column :dividend_rounds, :consolidated_invoice_id, :bigint
  end
end
