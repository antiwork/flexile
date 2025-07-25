# frozen_string_literal: true

FactoryBot.define do
  factory :tender_offer do
    company
    name { "#{company.name} Buyback #{SecureRandom.hex(4)}" }
    attachment { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.zip")) }
    letter_of_transmittal { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.pdf")) }
    starts_at { 20.days.ago }
    ends_at { 10.days.from_now }
    minimum_valuation { 100_000 }
    buyback_type { "tender_offer" }

    after(:build) do |tender_offer|
      if tender_offer.tender_offer_investors.empty?
        tender_offer.tender_offer_investors.build(
          company_investor: build(:company_investor, company: tender_offer.company)
        )
      end
    end

    trait :with_single_stock do
      buyback_type { "single_stock" }

      after(:build) do |tender_offer|
        tender_offer.tender_offer_investors.clear
        tender_offer.tender_offer_investors.build(
          company_investor: build(:company_investor, company: tender_offer.company)
        )
      end
    end

    trait :with_tender_offer do
      buyback_type { "tender_offer" }

      after(:build) do |tender_offer|
        tender_offer.tender_offer_investors.clear
        2.times do
          tender_offer.tender_offer_investors.build(
            company_investor: build(:company_investor, company: tender_offer.company)
          )
        end
      end
    end

    trait :without_attachments do
      attachment { nil }
      letter_of_transmittal { nil }
    end

    trait :without_investors do
      after(:build) do |tender_offer|
        tender_offer.tender_offer_investors.clear
      end
    end
  end
end
