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
    it { is_expected.to validate_presence_of(:name) }
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

    context "when type is tax_document" do
      subject { build(:tax_doc) }

      it { is_expected.to validate_presence_of(:user_compliance_info_id) }
      it { is_expected.to validate_inclusion_of(:name).in_array(Document::ALL_SUPPORTED_TAX_FORM_NAMES) }

      context "when another record exists" do
        context "when the record is alive" do
          let!(:tax_doc) { create(:tax_doc) }

          it "does not allow creating another record with the same name, tax year and user compliance info" do
            new_tax_doc = build(:tax_doc, name: tax_doc.name, user_compliance_info: tax_doc.user_compliance_info, company: tax_doc.company)

            expect(new_tax_doc.valid?).to eq(false)
            expect(new_tax_doc.errors.full_messages).to eq(["A tax form with the same name, company, and year already exists " \
                                                            "for this user"])
          end

          it "allows creating another record with the same name and company, but a different tax year" do
            expect do
              create(:tax_doc, name: tax_doc.name, year: tax_doc.year - 1, company: tax_doc.company)
            end.to change { described_class.count }.by(1)
          end

          it "allows creating another record with the same name and company, but different user compliance info" do
            expect do
              create(:tax_doc, name: tax_doc.name, user_compliance_info: create(:user_compliance_info), company: tax_doc.company)
            end.to change { described_class.count }.by(1)
          end

          it "allows creating another record with the same name and tax year, but different company" do
            expect do
              create(:tax_doc, name: tax_doc.name, year: tax_doc.year, company: create(:company))
            end.to change { described_class.count }.by(1)
          end
        end

        context "when the record is deleted" do
          let!(:tax_doc) { create(:tax_doc, deleted_at: Time.current) }

          it "allows creating another record with the same name, tax year and user compliance info" do
            expect do
              create(:tax_doc, name: tax_doc.name, user_compliance_info: tax_doc.user_compliance_info, company: tax_doc.company)
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
    let!(:form_1099nec) { create(:tax_doc, :form_1099nec) }
    let!(:form_1099div) { create(:tax_doc, :form_1099div) }
    let!(:form_1042s) { create(:tax_doc, :form_1042s) }

    before do
      create(:tax_doc, :form_w9)
      create(:tax_doc, :form_w8ben)
      create(:tax_doc, :form_w8bene)
    end

    it "returns only IRS tax documents" do
      expect(described_class.irs_tax_forms).to match_array([form_1099nec, form_1099div, form_1042s])
    end
  end

  describe "#fetch_serializer" do
    it "returns the correct serializer for the W-9 tax document" do
      expect(build(:tax_doc, :form_w9).fetch_serializer).to be_a(TaxDocuments::FormW9Serializer)
    end

    it "returns the correct serializer for the W-8BEN tax document" do
      expect(build(:tax_doc, :form_w8ben).fetch_serializer).to be_a(TaxDocuments::FormW8benSerializer)
    end

    it "returns the correct serializer for the W-8BEN-E tax document" do
      expect(build(:tax_doc, :form_w8bene).fetch_serializer).to be_a(TaxDocuments::FormW8beneSerializer)
    end

    it "returns the correct serializer for the 1099-DIV tax document" do
      expect(build(:tax_doc, :form_1099div).fetch_serializer).to be_a(TaxDocuments::Form1099divSerializer)
    end

    it "raises an exception when the document is not a tax form" do
      expect do
        build(:document).fetch_serializer
      end.to raise_error("Document type not supported")
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
