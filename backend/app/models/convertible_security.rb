# frozen_string_literal: true

class ConvertibleSecurity < ApplicationRecord
  has_paper_trail

  belongs_to :company_investor
  belongs_to :convertible_investment

  validates :principal_value_in_cents, presence: true,
                                       numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :issued_at, presence: true
  validates :implied_shares, numericality: { greater_than: 0.0 }, presence: true
  validates :valuation_cap_cents, numericality: { greater_than: 0, only_integer: true },
                                  allow_nil: true
  validates :discount_rate_percent, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
                                    allow_nil: true
  validates :interest_rate_percent, numericality: { greater_than_or_equal_to: 0 },
                                    allow_nil: true
  validates :seniority_rank, numericality: { greater_than_or_equal_to: 0, only_integer: true },
                             allow_nil: true
end
