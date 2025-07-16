# frozen_string_literal: true

class TenderOffers::FinalizeBuyback
  def initialize(tender_offer:)
    @tender_offer = tender_offer
  end

  def perform
    ApplicationRecord.transaction do
      unless tender_offer.accepted_price_cents
        TenderOffers::CalculateEquilibriumPrice.new(tender_offer: tender_offer).perform
        tender_offer.reload
      end

      unless tender_offer.accepted_price_cents
        raise "No equilibrium price could be calculated. Please check if there are any bids or if the tender offer constraints are valid."
      end

      TenderOffers::GenerateEquityBuybacks.new(tender_offer: tender_offer).perform

      equity_buyback_round = tender_offer.equity_buyback_rounds.sole

      TenderOffers::UpdateCapTable.new(equity_buyback_round: equity_buyback_round).perform

      process_payments(equity_buyback_round)
    end

    send_investor_notifications

    { success: true }
  rescue => e
    { success: false, error_message: e.message }
  end

  private
    attr_reader :tender_offer

    def process_payments(equity_buyback_round)
      delay = 0
      equity_buyback_round.equity_buybacks.each do |equity_buyback|
        investor = equity_buyback.company_investor
        user = investor.user

        next if !user.has_verified_tax_id? ||
                user.restricted_payout_country_resident? ||
                user.sanctioned_country_resident? ||
                user.tax_information_confirmed_at.nil? ||
                !investor.completed_onboarding?

        InvestorEquityBuybacksPaymentJob.perform_in((delay * 2).seconds, equity_buyback.id)
        delay += 1
      end
    end

    def send_investor_notifications
      company_investors_with_bids = CompanyInvestor.joins(:tender_offer_bids)
                                                  .where(tender_offer_bids: { tender_offer_id: tender_offer.id })
                                                  .distinct

      company_investors_with_bids.each do |investor|
        CompanyInvestorMailer.tender_offer_closed(
          investor.id,
          tender_offer_id: tender_offer.id
        ).deliver_now
      end
    end
end
