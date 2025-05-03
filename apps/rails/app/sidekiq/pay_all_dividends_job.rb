# frozen_string_literal: true

class PayAllDividendsJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  def perform
    schedule_dividend_payments
    send_retained_dividend_emails
  end

  private
    def schedule_dividend_payments
      delay = 0
      CompanyInvestor.joins(dividends: :dividend_round)
                     .includes(:user)
                     .where(dividends: { status: [Dividend::ISSUED, Dividend::RETAINED] })
                     .merge(DividendRound.ready_for_payment)
                     .group(:id)
                     .find_each do |investor|
        user = investor.user
        next if !user.has_verified_tax_id? ||
                user.restricted_payout_country_resident? ||
                user.sanctioned_country_resident? ||
                user.tax_information_confirmed_at.nil? ||
                !(user.wallet.present? || user.bank_accounts.present?)

        InvestorDividendsPaymentJob.perform_in((delay * 2).seconds, investor.id)
        delay += 1
      end
    end

    def send_retained_dividend_emails
      DividendRound.ready_for_payment.find_each do |dividend_round|
        dividend_round.investor_dividend_rounds.find_each do |investor_dividend_round|
          dividends = dividend_round.dividends.where(company_investor_id: investor_dividend_round.company_investor_id)
          next unless dividends.pluck(:status).uniq == [Dividend::RETAINED]

          retained_reason = dividends.pluck(:retained_reason).uniq

          case retained_reason
          when [Dividend::RETAINED_REASON_COUNTRY_SANCTIONED]
            investor_dividend_round.send_sanctioned_country_email
          when [Dividend::RETAINED_REASON_BELOW_THRESHOLD]
            investor_dividend_round.send_payout_below_threshold_email
          end
        end
      end
    end
end
