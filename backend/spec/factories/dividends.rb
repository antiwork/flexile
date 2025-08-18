# frozen_string_literal: true

FactoryBot.define do
  factory :dividend do
    company
    company_investor
    user_compliance_info
    dividend_round
    number_of_shares { 100 }
    status { Dividend::ISSUED }
    total_amount_in_cents { 100 * number_of_shares }
    net_amount_in_cents { total_amount_in_cents }
    withheld_tax_cents { 0 }
    withholding_percentage { 0 }
    qualified_amount_cents { 0 }

    trait :retained do
      retained_reason { Dividend::RETAINED_REASONS.sample }
      status { Dividend::RETAINED }
    end

    trait :paid do
      paid_at { Time.current }
      status { Dividend::PAID }
    end

    trait :pending do
      paid_at { Time.current }
      status { Dividend::PENDING_SIGNUP }
    end

    trait :processing do
      status { Dividend::PROCESSING }
    end

    trait :qualified do
      qualified_amount_cents { total_amount_in_cents }
    end
  end
end
