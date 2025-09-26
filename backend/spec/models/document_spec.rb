# frozen_string_literal: true

RSpec.describe Document do
  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors.include?(Deletable)).to eq(true)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user_compliance_info).optional(true) }
    it { is_expected.to belong_to(:equity_grant).optional(true) }
    it { is_expected.to have_many_attached(:attachments) }
    it { is_expected.to have_many(:signatures).class_name("DocumentSignature") }
    it { is_expected.to have_many(:signatories).through(:signatures).source(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:document_type) }
    it { is_expected.to validate_presence_of(:year) }
    it { is_expected.to validate_numericality_of(:year).only_integer.is_less_than_or_equal_to(Date.today.year) }

    context "signatures" do
      subject(:document) { build(:document) }

      it "is invalid when signatures are invalid" do
        document.signatures.build(user: nil, title: "Signer")
        expect(document).to be_invalid
      end

      it "is valid when signatures are valid" do
        document.signatures.build(user: create(:user), title: "Signer")
        expect(document).to be_valid
      end
    end

    context "when document is a tax document" do
      subject { build(:document, document_type: :form_1099div) }

      it { is_expected.to validate_presence_of(:user_compliance_info_id) }

      context "when another record exists" do
        context "when the record is alive" do
          let!(:tax_doc) { create(:document, document_type: :form_1099div) }

          it "does not allow creating another record with the same type, tax year and user compliance info" do
            new_tax_doc = build(:document, document_type: :form_1099div, user_compliance_info: tax_doc.user_compliance_info, company: tax_doc.company)

            expect(new_tax_doc.valid?).to eq(false)
            expect(new_tax_doc.errors.full_messages).to eq(["A tax form with the same type, company, and year already exists " \
                                                            "for this user"])
          end

          it "allows creating another record with the same type and company, but a different tax year" do
            expect do
              create(:document, document_type: :form_1099div, year: tax_doc.year - 1, company: tax_doc.company)
            end.to change { described_class.count }.by(1)
          end

          it "allows creating another record with the same type and company, but different user compliance info" do
            expect do
              create(:document, document_type: :form_1099div, user_compliance_info: create(:user_compliance_info), company: tax_doc.company)
            end.to change { described_class.count }.by(1)
          end

          it "allows creating another record with the same type and tax year, but different company" do
            expect do
              create(:document, document_type: :form_1099div, year: tax_doc.year, company: create(:company))
            end.to change { described_class.count }.by(1)
          end
        end

        context "when the record is deleted" do
          let!(:tax_doc) { create(:document, document_type: :form_1099div, deleted_at: Time.current) }

          it "allows creating another record with the same type, tax year and user compliance info" do
            expect do
              create(:document, document_type: :form_1099div, user_compliance_info: tax_doc.user_compliance_info, company: tax_doc.company)
            end.to change { described_class.count }.by(1)
          end
        end
      end
    end

    context "when type is equity_plan_contract" do
      subject { build(:equity_plan_contract_doc) }

      it { is_expected.to validate_presence_of(:equity_grant_id) }
    end
  end

  describe ".irs_tax_forms" do
    let!(:form_1099nec) { create(:document, document_type: :form_1099nec) }
    let!(:form_1099div) { create(:document, document_type: :form_1099div) }
    let!(:form_1042s) { create(:document, document_type: :form_1042s) }

    before do
      create(:document, document_type: :form_w9)
      create(:document, document_type: :form_w8ben)
      create(:document, document_type: :form_w8bene)
    end

    it "returns only IRS tax documents" do
      expect(described_class.irs_tax_forms).to match_array([form_1099nec, form_1099div, form_1042s])
    end
  end

  describe "#fetch_serializer" do
    it "returns the correct serializer for the W-9 tax document" do
      expect(build(:document, document_type: :form_w9).fetch_serializer).to be_a(TaxDocuments::FormW9Serializer)
    end

    it "returns the correct serializer for the W-8BEN tax document" do
      expect(build(:document, document_type: :form_w8ben).fetch_serializer).to be_a(TaxDocuments::FormW8benSerializer)
    end

    it "returns the correct serializer for the W-8BEN-E tax document" do
      expect(build(:document, document_type: :form_w8bene).fetch_serializer).to be_a(TaxDocuments::FormW8beneSerializer)
    end

    it "returns the correct serializer for the 1099-DIV tax document" do
      expect(build(:document, document_type: :form_1099div).fetch_serializer).to be_a(TaxDocuments::Form1099divSerializer)
    end

    it "raises an exception when the document is not a tax form" do
      expect do
        build(:document).fetch_serializer
      end.to raise_error("Document type not supported")
    end
  end

  describe "#tax_document?" do
    it "returns whether the document is a tax form" do
      Document.document_types.each do |document_type, _|
        expect(build(:document, document_type:).tax_document?).to eq(Document::TAX_FORM_TYPES.include?(document_type))
      end
    end
  end

  describe "#live_attachment" do
    let(:document) do
      create(:document, attachments: [{
        io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")),
        filename: "first.pdf",
        content_type: "application/pdf",
      }, {
        io: File.open(Rails.root.join("spec/fixtures/files/sample.pdf")),
        filename: "last.pdf",
        content_type: "application/pdf",
      }])
    end

    it "returns the most recent attachment, if one exists" do
      expect(document.live_attachment.filename).to eq("last.pdf")

      document.live_attachment.destroy!
      expect(document.reload.live_attachment.filename).to eq("first.pdf")

      document.live_attachment.destroy!
      expect(document.reload.live_attachment).to be_nil
    end
  end
end
