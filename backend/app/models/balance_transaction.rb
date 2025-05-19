# frozen_string_literal: true

class BalanceTransaction < ApplicationRecord
  belongs_to :company

  PAYMENT_INITIATED = "payment_initiated"
  PAYMENT_FAILED = "payment_failed"
  PAYMENT_CANCELLED = "payment_cancelled"
  TRANSACTION_TYPES = [PAYMENT_INITIATED, PAYMENT_FAILED, PAYMENT_CANCELLED].freeze

  validates :amount_cents, presence: true, immutable: true
  validates :transaction_type, presence: true, inclusion: TRANSACTION_TYPES

  after_commit :update_balance!, on: [:create, :destroy]

  private
    def update_balance!
      company.balance.recalculate_amount!
    end
end
