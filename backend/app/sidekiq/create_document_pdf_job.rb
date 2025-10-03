# frozen_string_literal: true

class CreateDocumentPdfJob
  include Sidekiq::Job
  sidekiq_options retry: 3

  def perform(document_id)
    document = Document.find(document_id)
    pdf = CreatePdf.new(body_html: ActionController::Base.helpers.sanitize(document.text)).perform
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "#{document.name}.pdf",
      content_type: "application/pdf",
    )
    document.save!
  end
end
