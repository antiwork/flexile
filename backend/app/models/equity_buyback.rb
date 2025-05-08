# frozen_string_literal: true

class EquityBuyback < ApplicationRecord
  belongs_to :company
  belongs_to :equity_buyback_round
  belongs_to :company_investor
  belongs_to :security, polymorphic: true
  has_and_belongs_to_many :equity_buyback_payments, join_table: :equity_buybacks_equity_buyback_payments

  # Possible `status` values
  ISSUED = "Issued"
  RETAINED = "Retained"
  PROCESSING = "Processing"
  PAID = "Paid"
  ALL_STATUSES = [ISSUED, RETAINED, PROCESSING, PAID].freeze

  RETAINED_REASON_COUNTRY_SANCTIONED = "ofac_sanctioned_country"
  RETAINED_REASONS = [RETAINED_REASON_COUNTRY_SANCTIONED].freeze

  validates :retained_reason, inclusion: { in: RETAINED_REASONS }, allow_nil: true
  validates :total_amount_cents, presence: true, numericality: { greater_than: 0 }
  validates :share_price_cents, presence: true, numericality: { greater_than: 0 }
  validates :exercise_price_cents, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: ALL_STATUSES }
  validates :share_class, presence: true

  scope :paid, -> { where(status: PAID) }

  def external_status = status == PROCESSING ? ISSUED : status
  def issued? = status == ISSUED
  def retained? = status == RETAINED

  def mark_retained!(reason)
    update!(status: RETAINED, retained_reason: reason)
  end
end
