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
      document = Current.company.documents.release_agreement.create!(name: "Release agreement", year: Time.current.year)
      Current.user.document_signatures.create!(document:, title: "Signer", signed_at: Time.current)
      CreateDocumentPdfJob.perform_async(document.id, html)
      head :no_content
    end
  end
end
