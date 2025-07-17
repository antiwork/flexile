# frozen_string_literal: true

class Internal::Companies::TenderOffersController < Internal::Companies::BaseController
  include ActionView::Helpers::SanitizeHelper

  before_action :load_buyback!, only: [:show, :finalize]

  def index
    authorize TenderOffer

    buybacks = Current.company.tender_offers.order(created_at: :desc)
    render json: {
      buybacks: buybacks.map { |buyback| TenderOfferPresenter.new(buyback).props(user: Current.user, company: Current.company) },
    }
  end

  def show
    authorize @buyback
    render json: {
      buyback: TenderOfferPresenter.new(@buyback).props(user: Current.user, company: Current.company),
    }
  end

  def create
    authorize TenderOffer

    attachment = nil
    if buyback_params[:attachment_key].present?
      attachment = ActiveStorage::Blob.find_by(key: buyback_params[:attachment_key])
      raise "Attachment not found for provided key" unless attachment
    end

    letter_of_transmittal = nil
    if buyback_params[:letter_of_transmittal].present?
      file = nil
      content_type = "application/pdf"

      if buyback_params[:letter_of_transmittal][:type] == "link"
        url = buyback_params[:letter_of_transmittal][:data]
        raise "Invalid URL" unless url&.match?(URI::DEFAULT_PARSER.make_regexp)

        file = URI.open(url)
        content_type = file.content_type

        raise "URL must point to a PDF file" unless content_type == "application/pdf"
      end

      if buyback_params[:letter_of_transmittal][:type] == "text"
        html = buyback_params[:letter_of_transmittal][:data]
        pdf = CreatePdf.new(body_html: sanitize(html)).perform
        file = StringIO.new(pdf)
        content_type = "application/pdf"
      end

      raise "No letter of transmittal found" unless file

      letter_of_transmittal = ActiveStorage::Blob.create_and_upload!(
        io: file,
        filename: "#{buyback_params[:name]} Letter of transmittal.pdf",
        content_type: content_type
      )

      raise "No letter of transmittal found" unless letter_of_transmittal
    end

    result = CreateTenderOffer.new(
      company: Current.company,
      attributes: buyback_params.except(:attachment_key, :letter_of_transmittal).merge!(attachment: attachment, letter_of_transmittal: letter_of_transmittal)
    ).perform

    if result[:success]
      render json: {
        buyback: TenderOfferPresenter.new(result[:tender_offer]).props(user: Current.user, company: Current.company),
      }, status: :created
    else
      render json: { success: false, error_message: result[:error_message] }, status: :unprocessable_entity
    end
  end

  def finalize
    authorize @buyback

    result = TenderOffers::FinalizeBuyback.new(tender_offer: @buyback).perform

    if result[:success]
      render json: {
        success: true,
        buyback: TenderOfferPresenter.new(@buyback.reload).props(user: Current.user, company: Current.company),
      }
    else
      render json: {
        success: false,
        error_message: result[:error_message],
      }, status: :unprocessable_entity
    end
  end

  private
    def load_buyback!
      @buyback = Current.company.tender_offers.find_by!(external_id: params[:id])
    end

    def buyback_params
      params.permit(:name, :type, :starts_at, :ends_at, :minimum_valuation, :starting_price_per_share_cents, :total_amount_in_cents, :attachment_key, investors: [], letter_of_transmittal: [:type, :data])
    end
end
