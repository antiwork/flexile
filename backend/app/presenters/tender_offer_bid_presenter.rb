# frozen_string_literal: true

class TenderOfferBidPresenter
  delegate :external_id, :number_of_shares, :share_price_cents, :share_class,
           :accepted_shares, :created_at, to: :bid

  def initialize(bid)
    @bid = bid
  end

  def props
    {
      id: external_id,
      number_of_shares: number_of_shares,
      share_price_cents: share_price_cents,
      share_class: share_class,
      accepted_shares: accepted_shares,
      investor: investor_info,
      created_at: created_at,
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
