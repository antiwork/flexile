# frozen_string_literal: true

class Internal::Companies::TenderOffersController < Internal::Companies::BaseController
  include ActionView::Helpers::SanitizeHelper

  before_action :load_buyback!, only: [:show, :finalize]

  def index
    authorize TenderOffer

    buybacks_query = Current.company.tender_offers
    unless Current.company_administrator?
      buybacks_query = buybacks_query.joins(:tender_offer_investors).where(tender_offer_investors: { company_investor: Current.company_investor })
    end

    buybacks = buybacks_query.order(created_at: :desc)

    render json: {
      buybacks: TenderOffersPresenter.new(buybacks).props(user: Current.user, company: Current.company),
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
      unless attachment
        return render json: { success: false, error_message: "Attachment not found for provided key" }, status: :unprocessable_entity
      end
    end

    letter_of_transmittal = nil
    if buyback_params[:letter_of_transmittal].present?
      file = nil
      content_type = "application/pdf"

      if buyback_params[:letter_of_transmittal][:type] == "link"
        url = buyback_params[:letter_of_transmittal][:data]
        unless url&.match?(URI::DEFAULT_PARSER.make_regexp)
          return render json: { success: false, error_message: "Invalid URL" }, status: :unprocessable_entity
        end

        url = url.to_s
        url = "https:#{url}" if url.starts_with?("//")
        url = Addressable::URI.escape(url) unless URI::ABS_URI.match?(url)
        url = URI.parse(url)
        unless url.scheme.in?(["http", "https"])
          return render json: { success: false, error_message: "URL must be a web URL" }, status: :unprocessable_entity
        end
        unless url.host === DOMAIN
          ip = IPAddr.new(Resolv.getaddress(url.host))
          if ip.private? || ip.loopback? || ip.link_local?
            return render json: { success: false, error_message: "URL must be a public web URL" }, status: :unprocessable_entity
          end
        end
        url = url.to_s

        max_file_size = 10.megabytes
        file_data = StringIO.new
        file_size = 0

        uri = URI.parse(url)
        Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|
          response = http.get(uri.request_uri) do |chunk|
            file_size += chunk.bytesize
            if file_size > max_file_size
              return render json: { success: false, error_message: "File size exceeds maximum allowed size of #{max_file_size / 1.megabyte}MB" }, status: :unprocessable_entity
            end
            file_data.write(chunk)
          end

          file_data.rewind
          file = file_data
          content_type = response["content-type"]
        end

        unless content_type&.start_with?("application/pdf")
          return render json: { success: false, error_message: "URL must point to a PDF file" }, status: :unprocessable_entity
        end
      end

      if buyback_params[:letter_of_transmittal][:type] == "text"
        html = buyback_params[:letter_of_transmittal][:data]
        pdf = CreatePdf.new(body_html: sanitize(html)).perform
        file = StringIO.new(pdf)
        content_type = "application/pdf"
      end

      unless file
        return render json: { success: false, error_message: "No letter of transmittal found" }, status: :unprocessable_entity
      end

      letter_of_transmittal = ActiveStorage::Blob.create_and_upload!(
        io: file,
        filename: "#{buyback_params[:name]} Letter of transmittal.pdf",
        content_type: content_type
      )

      unless letter_of_transmittal
        return render json: { success: false, error_message: "Failed to create letter of transmittal" }, status: :unprocessable_entity
      end
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
  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, error_message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  def finalize
    authorize @buyback

    unless @buyback.accepted_price_cents
      return render json: {
        success: false,
        error_message: "No equilibrium price could be calculated. Please check if there are any bids or if the tender offer constraints are valid.",
      }, status: :unprocessable_entity
    end

    TenderOffers::FinalizeBuyback.new(tender_offer: @buyback).perform

  rescue ActiveRecord::RecordInvalid => e
    render json: { success: false, error_message: e.record.errors.full_messages.to_sentence }, status: :unprocessable_entity
  end

  private
    def load_buyback!
      @buyback = Current.company.tender_offers.find_by!(external_id: params[:id])
    end

    def buyback_params
      params.permit(:name, :buyback_type, :starts_at, :ends_at, :minimum_valuation, :accepted_price_cents, :total_amount_in_cents, :attachment_key, investors: [], letter_of_transmittal: [:type, :data])
    end
end
