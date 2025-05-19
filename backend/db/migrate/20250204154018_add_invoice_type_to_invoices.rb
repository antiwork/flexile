class AddInvoiceTypeToInvoices < ActiveRecord::Migration[7.2]
  def change
    create_enum :invoices_invoice_type, %w[services other]
    add_column :invoices, :invoice_type, :enum, enum_type: :invoices_invoice_type, null: false, default: "services"
  end
end
