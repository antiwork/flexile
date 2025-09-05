# frozen_string_literal: true

class Payment < ApplicationRecord
  has_paper_trail

  include Payments::Status, Payments::Wise, Serializable

  belongs_to :invoice
  belongs_to :wise_credential
  has_many :balance_transactions, class_name: "PaymentBalanceTransaction"

  delegate :company, to: :invoice


  validates :net_amount_in_cents, numericality: { greater_than_or_equal_to: 1, only_integer: true }, presence: true
  validates :transfer_fee_in_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true

  WISE_TRANSFER_REFERENCE = "PMT"
end
