# frozen_string_literal: true

class ProcessTenderOfferEquilibriumPriceJob
  include Sidekiq::Job

  def perform
    tender_offers = TenderOffer
      .where("ends_at < ?", Time.current)
      .where(accepted_price_cents: nil)

    Rails.logger.info "Processing #{tender_offers.count} ended tender offer(s) for equilibrium price calculation"

    tender_offers.find_each do |tender_offer|
      Rails.logger.info "Calculating equilibrium price for tender offer #{tender_offer.id}"

      equilibrium_price = TenderOffers::CalculateEquilibriumPrice.new(tender_offer: tender_offer).perform

      if equilibrium_price
        Rails.logger.info "Equilibrium price calculated for tender offer #{tender_offer.id}: #{equilibrium_price} cents"
      else
        Rails.logger.info "No equilibrium price calculated for tender offer #{tender_offer.id} (no bids or other constraints)"
      end
    end
  end
end
