# frozen_string_literal: true

class TenderOfferBidPresenter
  def initialize(bid)
    @bid = bid
  end

  def props
    {
      id: bid.external_id,
      number_of_shares: bid.number_of_shares,
      share_price_cents: bid.share_price_cents,
      share_class: bid.share_class,
      accepted_shares: bid.accepted_shares,
      investor: investor_info,
      created_at: bid.created_at,
    }
  end

  private
    attr_reader :bid

    def investor_info
      return nil unless bid.company_investor

      {
        id: bid.company_investor.external_id,
        name: bid.company_investor.user.name,
      }
    end
end
