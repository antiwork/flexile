# frozen_string_literal: true

FactoryBot.define do
  factory :consolidated_invoice do
    company

    invoice_date { Date.today }
    invoice_number { "FX-#{company.consolidated_invoices.count + 1}" }
    period_start_date { 31.days.ago }
    period_end_date { Date.yesterday }
    flexile_fee_cents { 0 }
    status { ConsolidatedInvoice::SENT }

    after :build do |ci, evaluator|
      invoices = evaluator.invoices.present? ? evaluator.invoices : create_list(:invoice, 2, company: ci.company)
      ci.invoices = invoices
      ci.invoice_amount_cents ||= invoices.sum(&:cash_amount_in_cents)
      ci.transfer_fee_cents ||= invoices.sum(&:flexile_fee_cents)
      ci.total_cents ||= ci.invoice_amount_cents + ci.transfer_fee_cents + ci.flexile_fee_cents
    end

    trait :paid do
      status { ConsolidatedInvoice::PAID }
      paid_at { Time.current }
      receipt { { io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")), filename: "receipt.pdf", content_type: "application/pdf" } }
    end
  end
end
