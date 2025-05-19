# frozen_string_literal: true

class PayAllEquityBuybacksJob
  include Sidekiq::Job
  sidekiq_options retry: 0

  def perform
    delay = 0
    EquityBuyback.where(status: [EquityBuyback::ISSUED, EquityBuyback::RETAINED])
                 .select(:company_investor_id)
                 .joins(:equity_buyback_round)
                 .merge(EquityBuybackRound.ready_for_payment)
                 .distinct
                 .each do |company_investor_id|
      InvestorEquityBuybacksPaymentJob.perform_in((delay * 2).seconds, company_investor_id)
      delay += 1
    end
  end
end
