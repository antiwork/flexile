# frozen_string_literal: true

RSpec.describe Dividend do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:dividend_round) }
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:user_compliance_info).optional(true) }
    it { is_expected.to have_and_belong_to_many(:dividend_payments).join_table(:dividends_dividend_payments) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:total_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_in_cents).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than(0).allow_nil }
    it { is_expected.to validate_numericality_of(:withheld_tax_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_numericality_of(:withholding_percentage).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_numericality_of(:net_amount_in_cents).is_greater_than_or_equal_to(0).only_integer.allow_nil }
    it { is_expected.to validate_numericality_of(:qualified_amount_cents).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status)
                          .in_array(["Pending signup", "Issued", "Retained", "Processing", "Paid"]) }
    it { is_expected.to validate_inclusion_of(:retained_reason)
                          .in_array(%w[ofac_sanctioned_country below_minimum_payment_threshold]) }
  end

  describe "scopes" do
    describe ".pending_signup" do
      let!(:pending_signup_dividend) { create(:dividend, :pending) }
      let!(:issued_dividend) { create(:dividend) }
      let!(:paid_dividend) { create(:dividend, :paid) }

      it "returns dividends with status 'Pending signup'" do
        expect(described_class.pending_signup).to eq([pending_signup_dividend])
      end
    end

    describe ".paid" do
      let!(:paid_dividend) { create(:dividend, :paid) }

      before do
        create(:dividend)
        create(:dividend, :pending)
        create(:dividend, :retained)
      end

      it "returns dividends with status 'Paid'" do
        expect(described_class.paid).to eq([paid_dividend])
      end
    end

    describe ".for_tax_year" do
      let(:tax_year) { 2020 }
      let!(:dividend_in_tax_year) { create(:dividend, :paid, paid_at: "#{tax_year}-01-01") }
      let!(:dividend_not_in_tax_year) { create(:dividend, :paid, paid_at: "2021-01-01") }

      it "returns dividends paid in the given tax year" do
        expect(described_class.for_tax_year(tax_year)).to eq([dividend_in_tax_year])
      end
    end
  end

  describe "#external_status" do
    context "when status is 'Processing'" do
      subject { build(:dividend, status: "Processing").external_status }

      it { is_expected.to eq("Issued") }
    end

    context "when status is not 'Processing'" do
      subject { build(:dividend, status: "Issued").external_status }

      it { is_expected.to eq("Issued") }
    end
  end

  describe "#issued?" do
    context "when status is 'Issued'" do
      subject { build(:dividend).issued? }

      it { is_expected.to eq(true) }
    end

    context "when status is not 'Issued'" do
      subject { build(:dividend, :paid).issued? }

      it { is_expected.to eq(false) }
    end
  end

  describe "#retained?" do
    context "when status is 'Retained'" do
      subject { build(:dividend, :retained).retained? }

      it { is_expected.to eq(true) }
    end

    context "when status is not 'Retained'" do
      subject { build(:dividend, :paid).retained? }

      it { is_expected.to eq(false) }
    end
  end

  describe "#mark_retained!" do
    let(:dividend) { create(:dividend) }
    let(:reason) { Dividend::RETAINED_REASONS.sample }

    it "updates the status to 'Retained' and sets the retained reason" do
      dividend.mark_retained!(reason)

      expect(dividend.status).to eq("Retained")
      expect(dividend.retained_reason).to eq(reason)
    end
  end
end
