# frozen_string_literal: true

class PaymentBalanceTransaction < BalanceTransaction
  belongs_to :payment
end
