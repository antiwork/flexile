# frozen_string_literal: true

class CreateDocumentPdfJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(document_id, document_text)
    document = Document.find(document_id)
    body_html = ApplicationController.render template: "templates/signed_document",
                                             locals: { body_html: ActionController::Base.helpers.sanitize(document_text), document: },
                                             layout: false,
                                             formats: [:html]
    pdf = CreatePdf.new(body_html:).perform
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "#{document.name}.pdf",
      content_type: "application/pdf",
    )
    document.save!
  end
end
