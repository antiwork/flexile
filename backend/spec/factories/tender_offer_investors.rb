# frozen_string_literal: true

FactoryBot.define do
  factory :tender_offer_investor do
    tender_offer
    company_investor
  end
end
