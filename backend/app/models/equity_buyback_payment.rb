# frozen_string_literal: true

class EquityBuybackPayment < ApplicationRecord
  include Payments::Status, Payments::Wise

  belongs_to :wise_credential, optional: true

  has_and_belongs_to_many :equity_buybacks, join_table: :equity_buybacks_equity_buyback_payments

  PROCESSOR_WISE = "wise"
  PROCESSOR_BLOCKCHAIN = "blockchain"
  WISE_TRANSFER_REFERENCE = "EB"

  validates :wise_credential_id, presence: true, if: -> { processor_name == PROCESSOR_WISE }
  validates :total_transaction_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validates :transfer_fee_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true
  validates :processor_name, presence: true, inclusion: { in: [PROCESSOR_WISE, PROCESSOR_BLOCKCHAIN] }
  validates :equity_buybacks, presence: true

  alias_attribute :wise_transfer_status, :transfer_status

  scope :wise, -> { where(processor_name: PROCESSOR_WISE) }
end
