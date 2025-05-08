class PopulateInvoiceData < ActiveRecord::Migration[7.0]
  def up
    if Rails.env.development?
      Company.all.each { |company| !company.valid? && company.destroy! }
      User.all.each { |user| !user.valid? && user.destroy! }
      Invoice.all.each { |invoice| (invoice.user.blank? || invoice.company.blank?) && invoice.delete }
    end

    Invoice.reset_column_information

    Invoice.includes(:user, :company).find_each do |invoice|
      invoice.due_on = invoice.invoice_date
      invoice.bill_from = invoice.user.legal_name
      invoice.bill_to = invoice.company.name
      invoice.save!
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
