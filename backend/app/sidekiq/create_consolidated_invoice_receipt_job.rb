# frozen_string_literal: true

class CreateConsolidatedInvoiceReceiptJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(consolidated_payment_id, processed_date)
    consolidated_payment = ConsolidatedPayment.find(consolidated_payment_id)
    consolidated_invoice = consolidated_payment.consolidated_invoice
    pdf = CreatePdf.new(
      body_html: ApplicationController.render(
        template: "ssr/consolidated_invoice_receipt",
        layout: false,
        locals: { consolidated_invoice: }
      ),
    ).perform

    consolidated_invoice.receipt.attach(
      io: StringIO.new(pdf),
      filename: "Flexile-Invoice-#{consolidated_invoice.invoice_number}.pdf",
      content_type: "application/pdf",
    )

    consolidated_invoice.company.company_administrators.each do |company_administrator|
      CompanyMailer.consolidated_invoice_receipt(
        user_id: company_administrator.user_id,
        consolidated_payment_id:,
        processed_date:,
      ).deliver_later
    end
  end
end
