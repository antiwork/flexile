# frozen_string_literal: true

class ConvertibleInvestment < ApplicationRecord
  has_paper_trail

  belongs_to :company
  has_many :convertible_securities

  validates :company_valuation_in_dollars, numericality: { greater_than_or_equal_to: 0, only_integer: true },
                                           presence: true
  validates :amount_in_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, presence: true
  validates :implied_shares, numericality: { greater_than_or_equal_to: 1, only_integer: true }, presence: true
  validates :valuation_type, inclusion: { in: %w(Pre-money Post-money) }, presence: true
  validates :identifier, :entity_name, :issued_at, :convertible_type, presence: true

  after_update_commit :update_implied_shares_for_securities, if: :saved_change_to_implied_shares?

  private
    def update_implied_shares_for_securities
      convertible_securities.each do |security|
        val = (implied_shares.to_d / amount_in_cents.to_d) * security.principal_value_in_cents.to_d
        security.update!(implied_shares: val)
      end
    end
end
