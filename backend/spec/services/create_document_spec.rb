# frozen_string_literal: true

RSpec.describe CreateDocument do
  let(:company) { create(:company) }
  let(:user) { create(:company_administrator, company:).user }
  let(:attachment) { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/sample.pdf"), "application/pdf") }

  context "with valid text_content" do
    it "creates a document" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].name).to eq("Doc")
      expect(result[:document].text_content).to eq("abc")
      expect(result[:document].year).to eq(Date.current.year)
    end
  end

  context "with valid attachment" do
    it "creates a document with attachment" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], attachment: }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].attachments.attached?).to be true
      expect(result[:document].year).to eq(Date.current.year)
    end
  end

  context "with both text_content and attachment" do
    it "returns error" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", attachment: }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to eq("Invalid parameters")
    end
  end

  context "with neither text_content nor attachment" do
    it "returns error" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract] }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to eq("Invalid parameters")
    end
  end

  context "with invalid params (missing name)" do
    it "returns error" do
      params = { document_type: Document.document_types[:consulting_contract], text_content: "abc" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to include("Name can't be blank")
    end
  end

  context "with invalid params (missing document_type)" do
    it "returns error" do
      params = { name: "Doc", text_content: "abc" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to include("Document type can't be blank").or include("Document type is not included in the list")
    end
  end

  context "with signed param true" do
    it "sets signed_at for signatures" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", signed: true }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].signatures).not_to be_empty
      expect(result[:document].signatures.all? { |s| s.signed_at.present? }).to be true
    end
  end

  context "with signed param false" do
    it "does not set signed_at for signatures" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", signed: false }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].signatures).not_to be_empty
      expect(result[:document].signatures.all? { |s| s.signed_at.nil? }).to be true
    end
  end

  context "with recipient param" do
    it "adds a signer signature" do
      worker = create(:company_worker, company:)
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", recipient: worker.external_id }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].signatures.map(&:user_id)).to include(worker.user.id)
    end
  end

  context "with invalid attachment type" do
    it "returns error" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], attachment: "not_a_file" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to eq("Invalid attachment parameter")
    end
  end

  context "with year param" do
    it "sets the year on the document to current year" do
      params = {
        name: "Doc",
        document_type: Document.document_types[:consulting_contract],
        text_content: "abc",
        year: 2022,
      }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].year).to eq(Date.current.year)
    end
  end

  context "with recipient param that does not match any worker" do
    it "does not add a signer signature" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", recipient: "nonexistent" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].signatures.size).to eq(1) # Only company rep
    end
  end

  context "when document save fails" do
    it "returns error on model save failure" do
      allow_any_instance_of(Document).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(Document.new))
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
    end
  end
end
