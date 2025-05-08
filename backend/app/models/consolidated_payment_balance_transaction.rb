# frozen_string_literal: true

class ConsolidatedPaymentBalanceTransaction < BalanceTransaction
  belongs_to :consolidated_payment
end
