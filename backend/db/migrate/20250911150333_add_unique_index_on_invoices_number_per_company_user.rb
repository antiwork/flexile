class AddUniqueIndexOnInvoicesNumberPerCompanyUser < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!

  def up
    add_index :invoices,
              "company_id, user_id, lower(invoice_number)",
              unique: true,
              algorithm: :concurrently,
              where: "deleted_at IS NULL",
              name: "idx_invoices_unique_number_per_company_user"
  end

  def down
    remove_index :invoices, name: "idx_invoices_unique_number_per_company_user"
  end
end
