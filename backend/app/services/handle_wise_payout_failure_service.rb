
class HandleWisePayoutFailureService < ApplicationService
  def initialize(payload)
    @payload = payload
    @resource = @payload[:resource]
  end

  def call
    dividend_payment = DividendPayment.find_by(transfer_id: @resource[:id])
    return unless dividend_payment
    investor = dividend_payment.dividends.first&.company_investor
    return unless investor
    user = investor.user
    user.bank_account_for_dividends&.mark_deleted!
    dividend_payment.dividends.update!(status: "Issued", paid_at: nil)
    reason = @payload.dig(:error_details, :description)
    CompanyInvestorMailer.with(
      company_investor: investor,
      reason: reason
    ).dividend_payment_failed.deliver_later
  end
end