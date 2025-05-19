class RenameHourlyRateInUsdToPayRateUsdForInvoiceLineItems < ActiveRecord::Migration[7.1]
  def change
    rename_column :invoice_line_items, :hourly_rate_in_usd, :pay_rate_usd
  end
end
