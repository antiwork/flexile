# frozen_string_literal: true

class Internal::Companies::DocumentsController < Internal::Companies::BaseController
  def create
    authorize Document
    document = Current.company.documents.build(**document_params, year: Time.current.year)
    document.signatures.build(user: User.find_by(external_id: params[:recipient]), title: "Signer")
    document.save!

    CreateDocumentPdfJob.perform_async(document.id, document.text)
    head :created
  end

  private
    def document_params
      params.require(:document).permit(:name, :document_type, :text)
    end
end
