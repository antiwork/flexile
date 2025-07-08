# frozen_string_literal: true

class InvoiceCsv
  HEADERS = ["Contractor name", "Role", "Invoice date", "Invoice ID", "Paid at", "Amount in USD", "Status"]

  def initialize(invoices)
    @invoices = invoices
  end

  def generate
    data = invoice_data
    CSV.generate do |csv|
      csv << HEADERS
      data.each do |row|
        csv << row
      end
    end
  end

  private
    def invoice_data
      @invoices.each_with_object([]) do |invoice, row|
        status = invoice.status
        status = "open" if status == Invoice::RECEIVED
        invoice_date = invoice.invoice_date.to_fs(:us_date)
        paid_at = invoice.paid_at ? invoice.paid_at.to_fs(:us_date) : nil
        row << [
          invoice.user.legal_name,
          invoice.user.company_workers.first.role,
          invoice_date,
          invoice.invoice_number,
          paid_at,
          invoice.total_amount_in_usd,
          status
        ]
      end
    end
end

### Usage:
=begin
invoices = Invoice.alive.where("invoice_date >= ? AND invoice_date <= ?", Date.parse("1 May 2022"), Date.parse("31 May 2022")).includes(user: :company_workers).order(created_at: :asc)
attached = { "Invoices.csv" => InvoiceCsv.new(invoices).generate }
AdminMailer.custom(to: ["raul@gumroad.com", "olson_steven@yahoo.com"], subject: "Gumroad Invoices CSV", body: "Attached", attached:).deliver_now
=end
