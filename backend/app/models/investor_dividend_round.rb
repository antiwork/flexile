# frozen_string_literal: true

class InvestorDividendRound < ApplicationRecord
  belongs_to :company_investor
  belongs_to :dividend_round

  validates :company_investor_id, uniqueness: { scope: :dividend_round_id }

  def send_sanctioned_country_email
    return if sanctioned_country_email_sent?

    dividend_amount_in_cents = dividend_round.dividends.where(company_investor_id:).sum(:total_amount_in_cents)
    CompanyInvestorMailer.sanctioned_dividends(company_investor_id, dividend_amount_in_cents:).deliver_later
    update!(sanctioned_country_email_sent: true)
  end

  def send_payout_below_threshold_email
    return if payout_below_threshold_email_sent?

    eligible_dividends = dividend_round.dividends.where(company_investor_id:)
    total_cents = eligible_dividends.sum(:total_amount_in_cents)
    net_cents = eligible_dividends.sum(:net_amount_in_cents)
    withholding_percentage = eligible_dividends.first.withholding_percentage
    CompanyInvestorMailer.retained_dividends(company_investor_id, total_cents:, net_cents:, withholding_percentage:)
                         .deliver_later
    update!(payout_below_threshold_email_sent: true)
  end

  def send_dividend_issued_email
    return if dividend_issued_email_sent?

    if dividend_round.return_of_capital?
      CompanyInvestorMailer.return_of_capital_issued(investor_dividend_round_id: id).deliver_later
    else
      CompanyInvestorMailer.dividend_issued(investor_dividend_round_id: id).deliver_later
    end

    update!(dividend_issued_email_sent: true)
  end
end
