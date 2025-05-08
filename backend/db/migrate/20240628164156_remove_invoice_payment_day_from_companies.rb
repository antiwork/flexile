class RemoveInvoicePaymentDayFromCompanies < ActiveRecord::Migration[7.1]
  def change
    remove_column :companies, :invoice_payment_day, :integer, default: 7, null: false
  end
end
