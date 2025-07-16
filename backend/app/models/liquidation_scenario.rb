# frozen_string_literal: true

class LiquidationScenario < ApplicationRecord
  has_paper_trail

  include ExternalId

  belongs_to :company
  has_many :liquidation_payouts, dependent: :destroy

  validates :name, presence: true
  validates :exit_amount_cents, presence: true,
                                numericality: { greater_than: 0, only_integer: true }
  validates :exit_date, presence: true
  validates :status, presence: true, inclusion: { in: %w[draft final] }
end