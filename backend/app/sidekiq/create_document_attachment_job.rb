# frozen_string_literal: true

class CreateDocumentAttachmentJob
  include Sidekiq::Job
  include ActionView::Helpers::SanitizeHelper
  sidekiq_options retry: 5

  def perform(document_id)
    document = Document.find(document_id)
    html = document.text_content
    return if html.blank?
    pdf = CreatePdf.new(body_html: sanitize(html)).perform
    document.attachments.each { |a| a.purge if a.filename.to_s == "#{document.name.parameterize}.pdf" }
    document.attachments.attach(
      io: StringIO.new(pdf),
      filename: "#{document.name.parameterize}.pdf",
      content_type: "application/pdf",
    )
  end
end
