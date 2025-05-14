# frozen_string_literal: true

class RemindOrPayDividends
end

=begin
# Assert that Company.is_gumroad.sole.dividend_rounds.count is 2
dividend_round = Company.is_gumroad.sole.dividend_rounds.order(id: :desc).first
dividend_round_id = dividend_round.id

# Send dividend issued emails to investors part of the dividend round
CompanyInvestor.joins(:dividends).where(dividends: { dividend_round_id: }).group(:id).each do |investor|
  investor_dividend_round = investor.investor_dividend_rounds.find_or_create_by!(dividend_round_id:)

  investor_dividend_round.send_dividend_issued_email
end; nil

# Mark the dividend round as ready for automatic scheduled payment
dividend_round.update!(ready_for_payment: true)

# Attempt to pay all investors part of the dividend round
delay = 0
CompanyInvestor.joins(:dividends).
                includes(:user).
                where(dividends: { dividend_round_id:, status: [Dividend::ISSUED, Dividend::RETAINED] }).
                group(:id).
                each do |investor|
  print "."
  user = investor.user
  next if !user.has_verified_tax_id? ||
            user.restricted_payout_country_resident? ||
            user.sanctioned_country_resident? ||
            user.tax_information_confirmed_at.nil? ||
            !investor.completed_onboarding?

  InvestorDividendsPaymentJob.perform_in((delay * 2).seconds, investor.id)
  delay += 1
end; nil

# After all `InvestorDividendsPaymentJob` jobs have completed, run this to send emails to investors with retained dividends
dividend_round.investor_dividend_rounds.each do |investor_dividend_round|
  dividends = dividend_round.dividends.where(company_investor_id: investor_dividend_round.company_investor_id)
  status = dividends.pluck(:status).uniq
  next unless status == [Dividend::RETAINED]

  retained_reason = dividends.pluck(:retained_reason).uniq

  if retained_reason == [Dividend::RETAINED_REASON_COUNTRY_SANCTIONED]
    investor_dividend_round.send_sanctioned_country_email
  elsif retained_reason == [Dividend::RETAINED_REASON_BELOW_THRESHOLD]
    investor_dividend_round.send_payout_below_threshold_email
  end
end; nil
=end
