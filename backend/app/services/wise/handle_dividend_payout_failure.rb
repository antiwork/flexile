module Wise
  class HandleDividendPayoutFailure < ApplicationService
    def initialize(dividend_payment, webhook_params)
      @dividend_payment = dividend_payment
      @params = webhook_params
    end

    def call
      user = @dividend_payment.dividends.first&.company_investor&.user
      return unless user

      user.bank_account_for_dividends&.update!(deleted_at: Time.current)
      @dividend_payment.dividends.update!(status: "Issued", paid_at: nil)

      failure_reason = @params.dig('data', 'failure_description')

      CompanyInvestorMailer.with(user: user, reason: failure_reason)
                           .dividend_payment_failed
                           .deliver_later
    end
  end
end