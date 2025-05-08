class AddRequiredInvoiceApprovalCountToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :required_invoice_approval_count,
               :integer, null: false, default: 1
  end
end
