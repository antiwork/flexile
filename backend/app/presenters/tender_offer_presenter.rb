# frozen_string_literal: true

class TenderOfferPresenter
  delegate :external_id, :name, :starts_at, :ends_at, :minimum_valuation,
           :accepted_price_cents, :status, :open?, :total_value_cents, :attachment, to: :tender_offer

  def initialize(tender_offer)
    @tender_offer = tender_offer
  end

  def props(current_user: nil)
    {
      id: external_id,
      name: name,
      starts_at: starts_at,
      ends_at: ends_at,
      minimum_valuation: minimum_valuation,
      accepted_price_cents: accepted_price_cents,
      status: status,
      open: open?,
      total_value_cents: total_value_cents,
      bid_count: bid_count(current_user),
      participation: participation(current_user),
      attachment: attachment_data,
      equity_buyback_rounds: tender_offer.equity_buyback_rounds.select(:status),
    }
  end

  private
    attr_reader :tender_offer

    def bid_count(current_user)
      if current_user&.company_administrator?
        tender_offer.bids.count
      elsif current_user&.company_investor
        tender_offer.bids.where(company_investor: current_user.company_investor).count
      else
        0
      end
    end

    def participation(current_user)
      if current_user&.company_administrator?
        tender_offer.bids.sum { |bid| bid.accepted_shares * tender_offer.accepted_price_cents }
      elsif current_user&.company_investor
        tender_offer.bids
          .where(company_investor: current_user.company_investor)
          .sum { |bid| bid.accepted_shares * tender_offer.accepted_price_cents }
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
