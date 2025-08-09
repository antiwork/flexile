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
    end
  end

  context "with valid attachment" do
    it "creates a document" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], attachment: }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].attachments.attached?).to be true
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

  context "with invalid params" do
    it "returns error" do
      params = { name: "", document_type: Document.document_types[:consulting_contract], text_content: "abc" }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be false
      expect(result[:error_message]).to include("Name can't be blank")
    end
  end

  context "with signed param true" do
    it "sets signed_at for signatures" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", signed: true }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].signatures.all? { |s| s.signed_at.present? }).to be true
    end
  end

  context "with signed param false" do
    it "does not set signed_at for signatures" do
      params = { name: "Doc", document_type: Document.document_types[:consulting_contract], text_content: "abc", signed: false }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
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
    end
  end

  context "with equity_plan_contract type and equity_grant" do
    it "creates a document with equity_grant" do
      equity_grant = create(:equity_grant, company_investor: create(:company_investor, company:))
      params = {
        name: "Equity Plan",
        document_type: Document.document_types[:equity_plan_contract],
        text_content: "plan",
        equity_grant_id: equity_grant.id,
      }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].equity_grant_id).to eq(equity_grant.id)
    end
  end

  context "with tax_document type and user_compliance_info" do
    it "creates a tax document" do
      user_compliance_info = create(:user_compliance_info)
      params = {
        name: Document::FORM_W_9,
        document_type: Document.document_types[:tax_document],
        text_content: "tax",
        user_compliance_info_id: user_compliance_info.id,
      }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].user_compliance_info_id).to eq(user_compliance_info.id)
    end
  end

  context "with deleted_at param" do
    it "creates a deleted document" do
      params = {
        name: "Doc",
        document_type: Document.document_types[:consulting_contract],
        text_content: "abc",
        deleted_at: Time.current,
      }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].deleted_at).not_to be_nil
    end
  end

  context "with year param" do
    it "creates a document with a specific year" do
      params = {
        name: "Doc",
        document_type: Document.document_types[:consulting_contract],
        text_content: "abc",
        year: 2022,
      }
      result = described_class.new(user:, company:, params:).perform!
      expect(result[:success]).to be true
      expect(result[:document].year).to eq(2022)
    end
  end
end
