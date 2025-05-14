# frozen_string_literal: true

FactoryBot.define do
  factory :invoice_expense do
    invoice
    expense_category
    total_amount_in_cents { 1_000_00 }
    description { "American Airlines" }
    attachment { { io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")), filename: "expense.pdf", content_type: "application/pdf" } }
  end
end
