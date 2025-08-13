# frozen_string_literal: true

class FlexileFeeCalculator
  INVOICE_BASE_FEE_CENTS = 50
  INVOICE_PERCENTAGE = 1.5
  INVOICE_MAX_FEE_CENTS = 15_00

  DIVIDEND_BASE_FEE_CENTS = 30
  DIVIDEND_PERCENTAGE = 2.9
  DIVIDEND_MAX_FEE_CENTS = 30_00

  def self.calculate_invoice_fee_cents(total_amount_in_usd_cents)
    percentage_fee_cents = (total_amount_in_usd_cents * INVOICE_PERCENTAGE / 100).round
    fee_cents = INVOICE_BASE_FEE_CENTS + percentage_fee_cents
    [fee_cents, INVOICE_MAX_FEE_CENTS].min
  end

  def self.calculate_dividend_fee_cents(total_amount_in_cents)
    percentage_fee_cents = (total_amount_in_cents * DIVIDEND_PERCENTAGE / 100).round
    fee_cents = DIVIDEND_BASE_FEE_CENTS + percentage_fee_cents
    [fee_cents, DIVIDEND_MAX_FEE_CENTS].min
  end
end
