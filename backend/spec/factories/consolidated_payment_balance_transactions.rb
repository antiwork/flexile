# frozen_string_literal: true

FactoryBot.define do
  factory :consolidated_payment_balance_transaction do
    company
    consolidated_payment
    amount_cents { 25_000_00 }
    transaction_type { BalanceTransaction::PAYMENT_INITIATED }
  end
end
