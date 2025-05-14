# frozen_string_literal: true

FactoryBot.define do
  factory :invoice_approval do
    invoice
    approved_at { Time.current }

    after(:build) do |invoice_approval|
      invoice_approval.approver ||= create(:company_administrator, company: invoice_approval.invoice.company).user
    end
  end
end
