# frozen_string_literal: true

FactoryBot.define do
  factory :payment_balance_transaction do
    company
    payment
    amount_cents { 1_200_00 }
    transaction_type { BalanceTransaction::PAYMENT_INITIATED }
  end
end
