# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  def create
    authorize Document
    document = Current.company.documents.build(**document_params, year: Time.current.year)
    pdf = CreatePdf.new(body_html: ActionController::Base.helpers.sanitize(document.text)).perform
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "#{document.name}.pdf",
      content_type: "application/pdf",
    )
    document.signatures.build(user: User.find_by(external_id: params[:recipient]), title: "Signer")
    document.save!
    head :created
  end

  private
    def document_params
      params.require(:document).permit(:name, :document_type, :text)
    end
end
