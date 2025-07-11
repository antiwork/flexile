# frozen_string_literal: true

class TenderOfferPresenter
  delegate :external_id, :name, :starts_at, :ends_at, :minimum_valuation, :implied_valuation,
           :accepted_price_cents, :open?, :attachment, to: :tender_offer

  def initialize(tender_offer)
    @tender_offer = tender_offer
  end

  def props(user:, company:)
    {
      id: external_id,
      name: name,
      starts_at: starts_at,
      ends_at: ends_at,
      minimum_valuation: minimum_valuation,
      implied_valuation: implied_valuation,
      accepted_price_cents: accepted_price_cents,
      open: open?,
      bid_count: bid_count(user: user, company: company),
      investor_count: investor_count(user: user, company: company),
      participation: participation(user: user, company: company),
      attachment: attachment_data,
      equity_buyback_rounds: tender_offer.equity_buyback_rounds.select(:status), # TODO
    }
  end

  private
    attr_reader :tender_offer

    def investor_count(user: user, company: company)
      return nil unless user.company_administrator_for?(company)

      tender_offer.bids.select(:company_investor_id).distinct.count
    end

    def bid_count(user: user, company: company)
      if user.company_administrator_for?(company)
        tender_offer.bids.count
      elsif user.company_investor_for?(company)
        tender_offer.bids.where(company_investor: user.company_investor).count
      else
        0
      end
    end

    def participation(user: user, company: company)
      if user.company_administrator_for?(company)
        tender_offer.bids.sum { |bid| bid.accepted_shares.to_i * tender_offer.accepted_price_cents.to_i }
      elsif user.company_investor_for?(company)
        tender_offer.bids
          .where(company_investor: user.company_investor)
          .sum { |bid| bid.accepted_shares.to_i * tender_offer.accepted_price_cents.to_i }
      else
        0
      end
    end

    def attachment_data
      return nil unless attachment&.attached?

      {
        key: attachment.key,
        filename: attachment.filename.to_s,
      }
    end
end
