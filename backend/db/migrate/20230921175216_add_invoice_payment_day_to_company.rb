class AddInvoicePaymentDayToCompany < ActiveRecord::Migration[7.0]
  def change
    add_column :companies, :invoice_payment_day, :integer, null: false, default: 7
  end
end
