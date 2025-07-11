# frozen_string_literal: true

class Internal::Companies::TenderOfferBidsController < Internal::Companies::BaseController
  before_action :load_tender_offer!
  before_action :load_bid!, only: [:destroy]

  def index
    authorize TenderOfferBid

    bids_query = @tender_offer.bids
    unless Current.company_administrator?
      bids_query = bids_query.where(company_investor: Current.company_investor)
    end

    bids = bids_query.includes(company_investor: :user).order(created_at: :desc)
    render json: {
      bids: bids.map { |bid| TenderOfferBidPresenter.new(bid).props },
    }
  end

  def create
    authorize TenderOfferBid

    # TODO test validations here
    @bid = @tender_offer.bids.build(
      company_investor: Current.company_investor,
      **bid_params
    )

    @bid.save!

    render json: {
      bid: TenderOfferBidPresenter.new(@bid).props,
    }, status: :created
  end

  def destroy
    authorize @bid

    @bid.destroy!
    head :no_content
  end

  private
    def load_tender_offer!
      @tender_offer = Current.company.tender_offers.find_by!(external_id: params[:tender_offer_id])
    end

    def load_bid!
      @bid = @tender_offer.bids.find_by!(external_id: params[:id])
    end

    def bid_params
      params.require(:bid).permit(:number_of_shares, :share_price_cents, :share_class)
    end
end
