# frozen_string_literal: true

FactoryBot.define do
  factory :company do
    name { Faker::Company.name }
    email { Faker::Internet.unique.email }
    registration_number { Faker::Company.duns_number }
    registration_state { "DE" }
    street_address { Faker::Address.street_address }
    city { Faker::Address.city }
    state { Faker::Address.state_abbr }
    zip_code { Faker::Address.zip_code }
    country_code { "US" }
    stripe_customer_id { "cus_M2QFeoOFttyzTx" }
    brand_color { Faker::Color.hex_color }
    website { "https://www.example.com" }
    required_invoice_approval_count { 2 }
    fully_diluted_shares { 1_000_000 }
    valuation_in_dollars { 2_000_000 }
    share_price_in_usd { 100 }
    fmv_per_share_in_usd { 40 }

    transient do
      without_bank_account { false }
    end

    after :build do |company, evaluator|
      company.bank_account = build(:company_stripe_account, company:) unless company.bank_account.present? || evaluator.without_bank_account
    end

    trait :without_bank_account do
      without_bank_account { true }
      stripe_customer_id { nil }
    end

    trait :pre_onboarding do
      without_bank_account
      name { nil }
      street_address { nil }
      city { nil }
      state { nil }
      zip_code { nil }
    end

    trait :completed_onboarding do
      after :create do |company|
        create(:company_administrator, company:)
      end
    end

    trait :with_logo do
      after :create do |company|
        company.logo.attach(io: File.open(Rails.root.join("spec", "fixtures", "files", "company-logo.png")), filename: "company-logo.png")
      end
    end
  end
end
