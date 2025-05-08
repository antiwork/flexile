# frozen_string_literal: true

FactoryBot.define do
  factory :equity_buyback do
    company
    equity_buyback_round { create(:equity_buyback_round, company:) }
    company_investor { create(:company_investor, company:) }
    security { create(:share_holding, company_investor:) }
    total_amount_cents { 10_000_00 }
    share_price_cents { 100 }
    exercise_price_cents { 100 }
    number_of_shares { 100 }
    status { "Issued" }
    share_class { security.share_class.name }

    trait :retained do
      retained_reason { EquityBuyback::RETAINED_REASONS.sample }
      status { EquityBuyback::RETAINED }
    end

    trait :paid do
      paid_at { Time.current }
      status { EquityBuyback::PAID }
    end
  end
end
