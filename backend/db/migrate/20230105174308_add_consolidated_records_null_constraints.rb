class AddConsolidatedRecordsNullConstraints < ActiveRecord::Migration[7.0]
  def change
    change_column_null :consolidated_payments, :type, false
    change_column_null :consolidated_invoices, :status, false
  end
end
