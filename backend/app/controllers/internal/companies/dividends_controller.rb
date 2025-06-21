# frozen_string_literal: true

class Internal::DividendsController < Internal::Companies::BaseController
  def show
    dividend = Current.company_investor.dividends.find(params[:id])
    render json: DividendPresenter.new(dividend).props
  end

  def sign
    dividend = Current.company_investor.dividends.where(release_signed_at: nil).where.not(dividend_round: { release_document: nil }).find(params[:id])
    e404 unless dividend.present?
    dividend.update!(release_signed_at: Time.current)
    pdf = CreatePdf.new(body_html: dividend.dividend_round.release_document.replace("{{investor}}", Current.user.name).replace("{{amount}}", number_to_currency(dividend.total_amount_in_cents))).perform
    document = Current.user.documents.create!()
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "Release agreement.pdf",
      content_type: "application/pdf",
    )
  end
end
