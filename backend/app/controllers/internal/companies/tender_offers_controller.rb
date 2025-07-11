# frozen_string_literal: true

class Internal::Companies::TenderOffersController < Internal::Companies::BaseController
  before_action :load_tender_offer!, only: [:show]

  def index
    authorize TenderOffer

    tender_offers = Current.company.tender_offers.order(created_at: :desc)
    render json: {
      tender_offers: tender_offers.map { |offer| TenderOfferPresenter.new(offer).props(user: Current.user, company: Current.company) },
    }
  end

  def show
    authorize @tender_offer
    render json: {
      tender_offer: TenderOfferPresenter.new(@tender_offer).props(user: Current.user, company: Current.company),
    }
  end

  def create
    authorize TenderOffer

    result = CreateTenderOffer.new(
      company: Current.company,
      attributes: tender_offer_params
    ).perform

    if result[:success]
      render json: {
        tender_offer: TenderOfferPresenter.new(result[:tender_offer]).props(current_user: Current.user, company: Current.company),
      }, status: :created
    else
      render json: { success: false, error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end

  private
    def load_tender_offer!
      @tender_offer = Current.company.tender_offers.find_by!(external_id: params[:id])
    end

    def tender_offer_params
      params.require(:tender_offer).permit(:name, :starts_at, :ends_at, :minimum_valuation, :starting_price_per_share_cents, :attachment, :letter_of_transmittal)
    end
end
