# frozen_string_literal: true

module Wise
  class HandleDividendPayoutFailure
    def self.call(dividend_payment, webhook_params)
      new(dividend_payment, webhook_params).call
    end

    def initialize(dividend_payment, webhook_params)
      @dividend_payment = dividend_payment
      @params = webhook_params
    end

    def call
      user = @dividend_payment.dividends.first&.company_investor&.user
      return unless user

      user.bank_account_for_dividends&.update!(deleted_at: Time.current)
      @dividend_payment.dividends.update!(status: "Issued", paid_at: nil)

      CompanyInvestorMailer.with(user: user).dividend_payment_failed.deliver_later
    end
  end
end