# frozen_string_literal: true

class Internal::Companies::DividendsController < Internal::Companies::BaseController
  include ActionView::Helpers::NumberHelper
  include ActionView::Helpers::SanitizeHelper
  def show
    dividend = Current.company_investor.dividends.find(params[:id])
    authorize dividend
    render json: DividendPresenter.new(dividend).props
  end

  def sign
    dividend = Current.company_investor.dividends.joins(:dividend_round).where(signed_release_at: nil).where.not(dividend_round: { release_document: nil }).find(params[:id])
    e404 unless dividend.present?
    authorize dividend

    ActiveRecord::Base.transaction do
      dividend.update!(signed_release_at: Time.current)
      html = dividend.dividend_round.release_document.gsub("{{investor}}", Current.user.legal_name).gsub!("{{amount}}", number_to_currency(dividend.total_amount_in_cents))
      pdf = CreatePdf.new(body_html: sanitize(html)).perform
      document = Document.release_agreement.create!(company: Current.company, name: "Release agreement", year: Date.today.year)
      Current.user.document_signatures.create!(document:, title: "Signer")
      document.attachments.attach(
        io: StringIO.new(pdf),
        filename: "Release agreement.pdf",
        content_type: "application/pdf",
      )
    end
  end
end
