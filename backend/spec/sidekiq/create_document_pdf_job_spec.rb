# frozen_string_literal: true

RSpec.describe CreateDocumentPdfJob, type: :job do
  include ActiveJob::TestHelper

  let(:company) { create(:company) }

  it "generates and attaches a PDF to the document" do
    document = company.documents.create!(
      document_type: Document.document_types[:consulting_contract],
      text: %Q{<h1>Test</h1><script>alert('x')</script><img src="x" onerror="alert('y')">},
      year: Time.current.year
    )

    sanitized_text = ActionController::Base.helpers.sanitize(document.text)
    expect(sanitized_text).to eq("<h1>Test</h1>alert('x')<img src=\"x\">")

    expect { described_class.new.perform(document.id, document.text) }
      .to change { document.reload.attachments.attached? }.from(false).to(true)

    attachment = document.reload.attachments.first
    expect(attachment.filename.to_s).to eq("#{document.name}.pdf")
    expect(attachment.content_type).to eq("application/pdf")
  end
end
