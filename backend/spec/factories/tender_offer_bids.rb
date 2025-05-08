# frozen_string_literal: true

FactoryBot.define do
  factory :tender_offer_bid do
    tender_offer
    company_investor { create(:company_investor, company: tender_offer.company) }
    number_of_shares { 100 }
    share_price_cents { 12_45 }
    share_class { "A" }
  end
end
