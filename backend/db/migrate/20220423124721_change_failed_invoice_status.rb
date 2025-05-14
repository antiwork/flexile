class ChangeFailedInvoiceStatus < ActiveRecord::Migration[7.0]
  def up
    Invoice.where(status: "funding_failed").update_all(status: "failed")
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
