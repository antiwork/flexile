# frozen_string_literal: true

class Balance < ApplicationRecord
  REQUIRED_BALANCE_BUFFER_IN_USD = 1000

  belongs_to :company
  has_many :balance_transactions, through: :company
  validates :company_id, uniqueness: true
  validates :amount_cents, presence: true, numericality: { only_integer: true }

  def recalculate_amount!
    update!(amount_cents: balance_transactions.sum(:amount_cents))
  end
end
