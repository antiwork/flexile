class DropInvoicesRejectedByForeignKey < ActiveRecord::Migration[7.1]
  def change
    remove_foreign_key "invoices", "users", column: "rejected_by_id"
  end
end
