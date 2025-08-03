# frozen_string_literal: true

class CreateDocumentAttachmentJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform(document_id)
    document = Document.find(id: document_id)
    html = document.text_content
    pdf = CreatePdf.new(body_html: sanitize(html)).perform
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "#{document.name.parameterize}.pdf",
      content_type: "application/pdf",
    )
  end
end
