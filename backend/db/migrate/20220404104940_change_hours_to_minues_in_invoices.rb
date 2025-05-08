class ChangeHoursToMinuesInInvoices < ActiveRecord::Migration[7.0]
  def up
    rename_column :invoices, :total_hours, :total_minutes
    Invoice.reset_column_information
    Invoice.find_each do |invoice|
      next if invoice.total_minutes.blank?

      invoice.total_minutes = invoice.total_minutes * 60
      invoice.save!
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
