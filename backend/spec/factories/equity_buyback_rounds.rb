# frozen_string_literal: true

FactoryBot.define do
  factory :equity_buyback_round do
    company
    tender_offer { create(:tender_offer, company:) }
    issued_at { 1.day.ago }
    number_of_shares { 100 }
    number_of_shareholders { 10 }
    total_amount_cents { 10_000_00 }
    status { "Issued" }
  end
end
