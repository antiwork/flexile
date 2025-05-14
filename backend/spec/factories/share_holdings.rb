# frozen_string_literal: true

FactoryBot.define do
  factory :share_holding do
    company_investor
    company_investor_entity do
      association :company_investor_entity,
                  company: company_investor.company,
                  name: company_investor.user.legal_name
    end
    share_class { create(:share_class, company: company_investor.company) }
    sequence(:name) { |n| "GUM-#{n}" }
    issued_at { 1.year.ago }
    originally_acquired_at { issued_at }
    number_of_shares { 101 }
    share_price_usd { 111.22 }
    total_amount_in_cents { (number_of_shares * (share_price_usd * 100.0)).round }
    share_holder_name { company_investor.user.legal_name }
  end
end
