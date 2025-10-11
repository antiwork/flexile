# frozen_string_literal: true

class Payment < ApplicationRecord
  has_paper_trail

  include Payments::Status, Payments::Wise, Serializable

  belongs_to :invoice
  belongs_to :wise_credential
  has_many :balance_transactions, class_name: "PaymentBalanceTransaction"

  delegate :company, to: :invoice

  # Active payment states are those that are in-flight and not terminal
  # INITIAL: Payment record created, transfer being set up
  # SUCCEEDED: Already completed successfully
  ACTIVE_STATUSES = [INITIAL].freeze
  TERMINAL_STATUSES = [SUCCEEDED, FAILED, CANCELLED].freeze

  scope :active, -> { where(status: ACTIVE_STATUSES) }
  scope :terminal, -> { where(status: TERMINAL_STATUSES) }

  validates :net_amount_in_cents, numericality: { greater_than_or_equal_to: 1, only_integer: true }, presence: true
  validates :transfer_fee_in_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true

  WISE_TRANSFER_REFERENCE = "PMT"

  def active?
    status.in?(ACTIVE_STATUSES)
  end

  def terminal?
    status.in?(TERMINAL_STATUSES)
  end
end
