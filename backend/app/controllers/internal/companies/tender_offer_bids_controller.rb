# frozen_string_literal: true

class Internal::Companies::TenderOfferBidsController < Internal::Companies::BaseController
  before_action :load_buyback!
  before_action :load_bid!, only: [:destroy]

  def index
    authorize TenderOfferBid

    bids_query = @buyback.bids
    unless Current.company_administrator?
      bids_query = bids_query.where(company_investor: Current.company_investor)
    end

    bids = bids_query.includes(company_investor: :user).order(created_at: :desc)
    render json: {
      bids: bids.map { |bid| TenderOfferBidPresenter.new(bid).props },
    }
  end

  def create
    authorize @bid = @buyback.bids.build(
      company_investor: Current.company_investor,
      **bid_params
    )

    @bid.save!

    render json: {
      bid: TenderOfferBidPresenter.new(@bid).props,
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, error_message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def destroy
    authorize @bid

    @bid.destroy!
    head :no_content
  end

  private
    def load_buyback!
      @buyback = Current.company.tender_offers.find_by!(external_id: params[:tender_offer_id])
    end

    def load_bid!
      @bid = @buyback.bids.find_by!(external_id: params[:id])
    end

    def bid_params
      params.permit(:number_of_shares, :share_price_cents, :share_class)
    end
end
