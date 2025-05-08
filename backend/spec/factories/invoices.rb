# frozen_string_literal: true

FactoryBot.define do
  factory :invoice do
    company_worker
    company { company_worker.company }
    user { company_worker.user }
    created_by { user }
    sequence(:invoice_number) { |n| "invoice-#{n}" }
    description { Faker::Lorem.sentence }
    status { Invoice::RECEIVED }
    invoice_date { Date.current }
    total_minutes { 60 }
    total_amount_in_usd_cents { 60_00 }
    cash_amount_in_cents { total_amount_in_usd_cents }
    equity_percentage { 0 }
    equity_amount_in_cents { 0 }
    equity_amount_in_options { 0 }
    attachments { [{ io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")), filename: "invoice.pdf", content_type: "application/pdf" }] }
    street_address { Faker::Address.street_address }
    city { Faker::Address.city }
    state { Faker::Address.state_abbr }
    zip_code { Faker::Address.zip_code }
    country_code { "US" }

    trait :project_based do
      total_minutes { nil }
      company_worker { association :company_worker, :project_based }
    end

    after :build do |invoice|
      invoice.invoice_line_items << build(:invoice_line_item, invoice: nil, minutes: invoice.total_minutes)
      invoice.flexile_fee_cents ||= invoice.calculate_flexile_fee_cents
    end

    factory :invoice_with_equity do
      transient do
        equity_split { 10 }
      end

      after(:build) do |invoice, evaluator|
        invoice.equity_percentage = evaluator.equity_split
        invoice.equity_amount_in_cents = (invoice.total_amount_in_usd_cents * (evaluator.equity_split / 100.to_d)).round
        invoice.cash_amount_in_cents = invoice.total_amount_in_usd_cents - invoice.equity_amount_in_cents
        invoice.equity_amount_in_options ||= 100
      end
    end
  end

  trait :paid do
    status { Invoice::PAID }
    paid_at { Time.current }

    after :create do |invoice|
      create_list(:invoice_approval, invoice.company.required_invoice_approval_count, invoice:)
    end
  end

  trait :rejected do
    status { Invoice::REJECTED }
    association :rejected_by, factory: [:user]
    rejected_at { Time.current }
    rejection_reason { "This is a duplicate" }
  end

  trait :approved do
    status { Invoice::APPROVED }

    transient do
      approvals { 1 }
    end

    after :create do |invoice, evaluator|
      create_list(:invoice_approval, evaluator.approvals, invoice:)
    end
  end

  trait :failed do
    approved
    approvals { company.required_invoice_approval_count }
    status { Invoice::FAILED }
  end

  trait :processing do
    approved
    approvals { company.required_invoice_approval_count }
    status { Invoice::PROCESSING }

    after :create do |invoice, evaluator|
      create(:consolidated_invoice, company: invoice.company, invoices: [invoice], created_at: invoice.invoice_date)
    end
  end

  trait :payment_pending do
    status { Invoice::PAYMENT_PENDING }

    after :create do |invoice, evaluator|
      create(:consolidated_invoice, company: invoice.company, invoices: [invoice], created_at: invoice.invoice_date)
    end
  end

  trait :fully_approved do
    approved
    approvals { company.required_invoice_approval_count }
  end

  trait :partially_approved do
    approved
    approvals { company.required_invoice_approval_count - 1 }
  end
end
