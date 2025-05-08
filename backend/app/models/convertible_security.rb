# frozen_string_literal: true

class ConvertibleSecurity < ApplicationRecord
  has_paper_trail

  belongs_to :company_investor
  belongs_to :convertible_investment

  validates :principal_value_in_cents, presence: true,
                                       numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :issued_at, presence: true
  validates :implied_shares, numericality: { greater_than: 0.0 }, presence: true
end
