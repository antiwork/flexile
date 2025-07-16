# frozen_string_literal: true

class LiquidationPayout < ApplicationRecord
  belongs_to :liquidation_scenario
  belongs_to :company_investor

  validates :security_type, presence: true, inclusion: { in: %w[equity convertible] }
  validates :payout_amount_cents, presence: true,
                                  numericality: { greater_than_or_equal_to: 0, only_integer: true }
  validates :number_of_shares, numericality: { greater_than: 0, only_integer: true },
                               allow_nil: true
end