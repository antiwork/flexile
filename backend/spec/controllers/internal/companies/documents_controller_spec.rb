# frozen_string_literal: true

RSpec.describe Internal::Companies::DocumentsController, type: :controller do
  describe "#create" do
    let(:company) { create(:company) }
    let(:company_administrator) { create(:company_administrator, company: company) }
    let(:recipient) { create(:user) }

    let(:valid_params) do
      {
        document: {
          name: "Test Document",
          document_type: "consulting_contract",
          text: "<p>Test content</p>",
        },
        recipient: recipient.external_id,
      }
    end

    before do
      allow(controller).to receive(:current_context) do
        Current.user = company_administrator.user
        Current.company = company
        Current.company_administrator = company_administrator
        CurrentContext.new(user: company_administrator.user, company: company)
      end
    end

    it "creates a document and queues PDF creation job" do
      expect do
        post :create, params: valid_params.merge(company_id: company.id)
      end.to change(Document, :count).by(1)
        .and change(DocumentSignature, :count).by(1)

      expect(response).to have_http_status(:created)

      document = Document.last
      expect(document.name).to eq("Test Document")
      expect(document.document_type).to eq("consulting_contract")
      expect(document.text).to eq("<p>Test content</p>")
      expect(document.company).to eq(company)

      signature = document.signatures.first
      expect(signature.user).to eq(recipient)
      expect(signature.title).to eq("Signer")

      expect(CreateDocumentPdfJob).to have_enqueued_sidekiq_job(document.id)
    end
  end
end
