class AddCreatedByToInvoices < ActiveRecord::Migration[7.2]
  def up
    add_reference :invoices, :created_by

    Invoice.reset_column_information
    Invoice.find_each do |invoice|
      invoice.created_by = invoice.user
      invoice.save(validate: false)
    end

    change_column_null :invoices, :created_by_id, false
  end

  def down
    remove_reference :invoices, :created_by
  end
end
