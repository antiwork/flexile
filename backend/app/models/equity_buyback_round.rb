# frozen_string_literal: true

class EquityBuybackRound < ApplicationRecord
  belongs_to :company
  belongs_to :tender_offer
  has_many :equity_buybacks
  # has_many :investor_dividend_rounds

  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :number_of_shareholders, presence: true, numericality: { greater_than: 0 }
  validates :total_amount_cents, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w(Issued Paid) }
  validates :ready_for_payment, inclusion: { in: [true, false] }

  scope :ready_for_payment, -> { where(ready_for_payment: true) }
end
