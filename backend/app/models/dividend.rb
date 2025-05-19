# frozen_string_literal: true

class Dividend < ApplicationRecord
  belongs_to :company
  belongs_to :dividend_round
  belongs_to :company_investor
  belongs_to :user_compliance_info, optional: true
  has_and_belongs_to_many :dividend_payments, join_table: :dividends_dividend_payments

  # Possible `status` values
  PENDING_SIGNUP = "Pending signup"
  ISSUED = "Issued"
  RETAINED = "Retained"
  PROCESSING = "Processing"
  PAID = "Paid"
  ALL_STATUSES = [PENDING_SIGNUP, ISSUED, RETAINED, PROCESSING, PAID].freeze

  RETAINED_REASON_COUNTRY_SANCTIONED = "ofac_sanctioned_country"
  RETAINED_REASON_BELOW_THRESHOLD = "below_minimum_payment_threshold"
  RETAINED_REASONS = [RETAINED_REASON_COUNTRY_SANCTIONED, RETAINED_REASON_BELOW_THRESHOLD].freeze

  validates :retained_reason, inclusion: { in: RETAINED_REASONS }, allow_nil: true
  validates :total_amount_in_cents, presence: true, numericality: { greater_than: 0 }
  validates :number_of_shares, numericality: { greater_than: 0 }, allow_nil: true
  validates :status, presence: true, inclusion: { in: ALL_STATUSES }
  validates :withheld_tax_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validates :withholding_percentage, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validates :net_amount_in_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validates :qualified_amount_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }

  scope :pending_signup, -> { where(status: PENDING_SIGNUP) }
  scope :paid, -> { where(status: PAID) }
  scope :for_tax_year, -> (tax_year) { paid.where("EXTRACT(year from dividends.paid_at) = ?", tax_year) }

  def external_status = status == PROCESSING ? ISSUED : status
  def issued? = status == ISSUED
  def retained? = status == RETAINED

  def mark_retained!(reason)
    update!(status: RETAINED, retained_reason: reason)
  end
end
