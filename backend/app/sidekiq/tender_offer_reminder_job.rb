# frozen_string_literal: true

class TenderOfferReminderJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    tender_offers = TenderOffer.where(ends_at: 3.days.from_now.beginning_of_day..3.days.from_now.end_of_day)
    tender_offers.find_each do |tender_offer|
      eligible_investors = tender_offer.tender_offer_investors
        .includes(:company_investor)
        .where.not(company_investor_id: tender_offer.bids.select(:company_investor_id))

      eligible_investors.each do |tender_offer_investor|
        company_investor = tender_offer_investor.company_investor

        CompanyInvestorMailer.tender_offer_reminder(
          company_investor.id,
          tender_offer_id: tender_offer.id
        ).deliver_now
      end
    end
  end
end
