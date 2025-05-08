# frozen_string_literal: true

RSpec.describe TaxDocument do
  describe "concerns" do
    it "includes Deletable" do
      expect(described_class.ancestors.include?(Deletable)).to eq(true)
    end

    it "includes Serializable" do
      expect(described_class.ancestors.include?(Serializable)).to eq(true)
    end
  end

  describe "associations" do
    it { is_expected.to belong_to(:user_compliance_info) }
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_one_attached(:attachment) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:attachment) }
    it { is_expected.to validate_numericality_of(:tax_year).only_integer.is_less_than_or_equal_to(Date.today.year) }
    it { is_expected.to validate_inclusion_of(:name).in_array(described_class::ALL_SUPPORTED_TAX_FORM_NAMES) }
    it { is_expected.to define_enum_for(:status)
                          .with_values(initialized: "initialized", submitted: "submitted", deleted: "deleted")
                          .backed_by_column_of_type(:enum)
                          .with_prefix(:status) }

    context "when another record exists" do
      context "when the record is alive" do
        let!(:tax_document) { create(:tax_document) }

        it "does not allow creating another record with the same name, tax year and user compliance info" do
          expect do
            create(:tax_document, user_compliance_info: tax_document.user_compliance_info)
          end.to raise_error(ActiveRecord::RecordInvalid, "Validation failed: A tax form with the same name and tax year already exists for this user")
        end

        it "allows creating another record with the same name and different tax year" do
          expect do
            create(:tax_document, tax_year: tax_document.tax_year - 1)
          end.to change { described_class.count }.by(1)
        end

        it "allows creating another record with the same name and different user compliance info" do
          expect do
            create(:tax_document, user_compliance_info: create(:user_compliance_info))
          end.to change { described_class.count }.by(1)
        end
      end

      context "when the record is deleted" do
        let!(:tax_document) { create(:tax_document, :deleted) }

        it "allows creating another record with the same name, tax year and user compliance info" do
          expect do
            create(:tax_document, user_compliance_info: tax_document.user_compliance_info)
          end.to change { described_class.count }.by(1)
        end
      end
    end
  end

  describe "scopes" do
    describe ".irs_tax_forms" do
      let!(:form_1099nec) { create(:tax_document, :form_1099nec) }
      let!(:form_1099div) { create(:tax_document, :form_1099div) }
      let!(:form_1042s) { create(:tax_document, :form_1042s) }

      before do
        create(:tax_document, :form_w9)
        create(:tax_document, :form_w8ben)
        create(:tax_document, :form_w8bene)
      end

      it "returns only IRS tax documents" do
        expect(described_class.irs_tax_forms).to match_array([form_1099nec, form_1099div, form_1042s])
      end
    end
  end

  describe "#mark_deleted!" do
    let(:tax_document) { create(:tax_document) }

    it "marks the tax document as deleted and updates its status" do
      tax_document.mark_deleted!
      expect(tax_document.reload.status).to eq("deleted")
      expect(tax_document.deleted_at).to be_present
    end
  end

  describe "#fetch_serializer" do
    it "returns the correct serializer for the W-9 tax document" do
      expect(build(:tax_document, :form_w9).fetch_serializer).to be_a(TaxDocuments::FormW9Serializer)
    end

    it "returns the correct serializer for the W-8BEN tax document" do
      expect(build(:tax_document, :form_w8ben).fetch_serializer).to be_a(TaxDocuments::FormW8benSerializer)
    end

    it "returns the correct serializer for the W-8BEN-E tax document" do
      expect(build(:tax_document, :form_w8bene).fetch_serializer).to be_a(TaxDocuments::FormW8beneSerializer)
    end

    it "returns the correct serializer for the 1099-DIV tax document" do
      expect(build(:tax_document, :form_1099div).fetch_serializer).to be_a(TaxDocuments::Form1099divSerializer)
    end
  end
end
