# frozen_string_literal: true

FactoryBot.define do
  factory :company_monthly_financial_report do
    company
    year { 1.month.ago.year }
    month { 1.month.ago.month }
    net_income_cents { 1000_00 }
    revenue_cents { 500_00 }
  end
end
