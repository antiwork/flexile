# frozen_string_literal: true

class Internal::Companies::DividendsController < Internal::Companies::BaseController
  include ActionView::Helpers::SanitizeHelper
  include ApplicationHelper

  def show
    dividend = Current.company_investor.dividends.find(params[:id])
    authorize dividend
    render json: DividendPresenter.new(dividend).props
  end

  def sign
    ActiveRecord::Base.transaction do
      dividend = Current.company_investor.dividends.joins(:dividend_round).where(signed_release_at: nil).where.not(dividend_round: { release_document: nil }).find(params[:id])
      authorize dividend
      dividend.update!(signed_release_at: Time.current)
      html = dividend.dividend_round.release_document.gsub("{{investor}}", Current.user.legal_name).gsub("{{amount}}", cents_format(dividend.total_amount_in_cents, no_cents_if_whole: false))
      pdf = CreatePdf.new(body_html: sanitize(html)).perform
      document = Current.company.documents.release_agreement.create!(name: "Release agreement", year: Time.current.year)
      Current.user.document_signatures.create!(document:, title: "Signer", signed_at: Time.current)
      document.attachments.attach(
        io: StringIO.new(pdf),
        filename: "Release agreement.pdf",
        content_type: "application/pdf",
      )
      head :no_content
    end
  end

  def mark_ready
    dividend = find_dividend_for_admin
    authorize dividend, :update?
    
    # Mark dividend as ready for payment
    dividend.update!(status: Dividend::ISSUED)
    
    render json: { 
      success: true, 
      dividend_id: dividend.id,
      status: dividend.status
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend not found" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: "Failed to mark dividend ready: #{e.message}" }, status: :unprocessable_entity
  end

  def retry_payment
    dividend = find_dividend_for_admin
    authorize dividend, :update?
    
    # Reset failed dividend and retry payment
    dividend.update!(status: Dividend::ISSUED, retained_reason: nil)
    
    # Queue the payment job for this specific investor
    InvestorDividendsPaymentJob.perform_async(dividend.company_investor_id)
    
    render json: { 
      success: true, 
      dividend_id: dividend.id,
      status: dividend.status,
      message: "Payment retry queued"
    }
  rescue ActiveRecord::RecordNotFound
    render json: { error: "Dividend not found" }, status: :not_found
  rescue ActiveRecord::RecordInvalid => e
    render json: { error: "Failed to retry payment: #{e.message}" }, status: :unprocessable_entity
  rescue StandardError => e
    Rails.logger.error "Failed to retry payment for dividend #{params[:id]}: #{e.message}"
    render json: { error: "Failed to retry payment" }, status: :internal_server_error
  end

  private

  def find_dividend_for_admin
    # For admin actions, find dividend by company, not company_investor
    Current.company.dividends.find(params[:id])
  end
end
