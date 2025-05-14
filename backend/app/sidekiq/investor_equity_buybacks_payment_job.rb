# frozen_string_literal: true

class InvestorEquityBuybacksPaymentJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  def perform(company_investor_id)
    company_investor = CompanyInvestor.find(company_investor_id)

    equity_buybacks_eligible_for_payment =
      company_investor.equity_buybacks.where(status: [EquityBuyback::ISSUED, EquityBuyback::RETAINED])
    PayInvestorEquityBuybacks.new(company_investor, equity_buybacks_eligible_for_payment).process
  end
end

=begin
# Sample code to pay all pending equity buybacks

delay = 0
EquityBuyback.where(status: [EquityBuyback::ISSUED, EquityBuyback::RETAINED]).pluck(:company_investor_id).uniq.each do |company_investor_id|
  print "."
  InvestorEquityBuybacksPaymentJob.perform_in((delay * 2).seconds, company_investor_id)
  delay += 1
end
=end
