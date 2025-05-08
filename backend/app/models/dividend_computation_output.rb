# frozen_string_literal: true

class DividendComputationOutput < ApplicationRecord
  belongs_to :dividend_computation
  belongs_to :company_investor, optional: true

  validates :share_class, presence: true
  validates :number_of_shares, presence: true
  validates :preferred_dividend_amount_in_usd, presence: true
  validates :dividend_amount_in_usd, presence: true
  validates :total_amount_in_usd, presence: true
  validates :qualified_dividend_amount_usd, numericality: { greater_than_or_equal_to: 0 }

  validate :either_investor_id_or_investor_name_must_be_present

  private
    def either_investor_id_or_investor_name_must_be_present
      return if company_investor_id.present? ^ investor_name.present?

      errors.add(:base, "Exactly one of company_investor_id or investor_name must be present")
    end
end
