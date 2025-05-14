# frozen_string_literal: true

module InvoiceHelpers
  def human_status(invoice)
    case invoice.status
    when Invoice::RECEIVED, Invoice::APPROVED
      invoice.invoice_approvals_count >= invoice.company.required_invoice_approval_count ?
        "Approved" :
        "Awaiting approval (#{invoice.invoice_approvals_count}/#{invoice.company.required_invoice_approval_count})"
    when Invoice::PROCESSING then "Payment in progress"
    when Invoice::PAYMENT_PENDING then "Payment scheduled"
    when Invoice::PAID then invoice.paid_at ? "Paid on #{invoice.paid_at.strftime("%b %-d")}" : "Paid"
    when Invoice::REJECTED then "Rejected"
    when Invoice::FAILED then "Failed"
    when ConsolidatedInvoice::SENT then "Sent"
    when ConsolidatedInvoice::REFUNDED then "Refunded"
    end
  end
end
