class AddPartialIndexToInvoicesForListPerformance < ActiveRecord::Migration[8.0]
  # Disable transaction for CONCURRENTLY index creation to avoid blocking table access
  disable_ddl_transaction!

  def change
    # Add partial index optimized for the invoice list query pattern:
    # WHERE company_id = ? AND deleted_at IS NULL ORDER BY invoice_date DESC, created_at DESC
    add_index :invoices, [:company_id, :invoice_date, :created_at],
              where: "deleted_at IS NULL",
              order: { invoice_date: :desc, created_at: :desc },
              name: "idx_invoices_company_alive_date_created",
              algorithm: :concurrently
  end
end
