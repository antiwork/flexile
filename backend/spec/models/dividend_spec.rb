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

  describe "#company_charged?" do
    context "when dividend round has no consolidated invoice" do
      let(:dividend) { create(:dividend) }

      it "returns false" do
        expect(dividend.company_charged?).to eq(false)
      end
    end

    context "when dividend round has a consolidated invoice that is paid or pending payment" do
      let(:consolidated_invoice) { create(:consolidated_invoice, status: ConsolidatedInvoice::SENT) }
      let(:dividend_round) { create(:dividend_round, consolidated_invoice:) }
      let(:dividend) { create(:dividend, dividend_round:) }

      it "returns true" do
        expect(dividend.company_charged?).to eq(true)
      end
    end

    context "when dividend round has a consolidated invoice that is not paid or pending payment" do
      let(:consolidated_invoice) { create(:consolidated_invoice, status: ConsolidatedInvoice::FAILED) }
      let(:dividend_round) { create(:dividend_round, consolidated_invoice:) }
      let(:dividend) { create(:dividend, dividend_round:) }

      it "returns false" do
        expect(dividend.company_charged?).to eq(false)
      end
    end
  end

  describe "#company_paid?" do
    context "when dividend round has no consolidated invoice" do
      let(:dividend) { create(:dividend) }

      it "returns false" do
        expect(dividend.company_paid?).to eq(false)
      end
    end

    context "when dividend round has a paid consolidated invoice" do
      let(:consolidated_invoice) { create(:consolidated_invoice, :paid) }
      let(:dividend_round) { create(:dividend_round, consolidated_invoice:) }
      let(:dividend) { create(:dividend, dividend_round:) }

      it "returns true" do
        expect(dividend.company_paid?).to eq(true)
      end
    end

    context "when dividend round has an unpaid consolidated invoice" do
      let(:consolidated_invoice) { create(:consolidated_invoice, status: ConsolidatedInvoice::SENT) }
      let(:dividend_round) { create(:dividend_round, consolidated_invoice:) }
      let(:dividend) { create(:dividend, dividend_round:) }

      it "returns false" do
        expect(dividend.company_paid?).to eq(false)
      end
    end
  end

  describe "#calculate_flexile_fee_cents" do
    context "single dividend yielding a fee under the $30 cap" do
      it "calculates correct fee for small dividend amount" do
        dividend = create(:dividend, total_amount_in_cents: 1000)

        expected_fee = ((1000 * 2.9 / 100) + 30).round
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end

      it "calculates correct fee for moderate dividend amount" do
        dividend = create(:dividend, total_amount_in_cents: 50_000)

        expected_fee = ((50_000 * 2.9 / 100) + 30).round
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end
    end

    context "single dividend yielding a fee over the cap" do
      it "caps the fee at $30.00 for large dividend amounts" do
        dividend = create(:dividend, total_amount_in_cents: 200_000)

        calculated_fee = ((200_000 * 2.9 / 100) + 30).round
        expect(calculated_fee).to be > 3000
        expect(dividend.calculate_flexile_fee_cents).to eq(3000)
      end

      it "caps the fee at $30.00 for very large dividend amounts" do
        dividend = create(:dividend, total_amount_in_cents: 1_000_000)

        calculated_fee = ((1_000_000 * 2.9 / 100) + 30).round
        expect(calculated_fee).to be > 3000
        expect(dividend.calculate_flexile_fee_cents).to eq(3000)
      end
    end

    context "rounding behavior and $0.30 addition" do
      it "rounds fees correctly for amounts that result in fractional cents" do
        dividend = create(:dividend, total_amount_in_cents: 1234)

        calculated_fee = (1234 * 2.9 / 100) + 30
        expected_fee = calculated_fee.round
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end

      it "handles rounding edge cases correctly" do
        dividend = create(:dividend, total_amount_in_cents: 1724)

        calculated_fee = (1724 * 2.9 / 100) + 30
        expected_fee = calculated_fee.round
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end
    end

    context "edge cases" do
      it "handles very small amounts that would result in sub-penny fees" do
        dividend = create(:dividend, total_amount_in_cents: 1)

        calculated_fee = (1 * 2.9 / 100) + 30
        expected_fee = calculated_fee.round
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end

      it "handles the threshold amount where fee equals cap" do
        threshold_amount = ((3000 - 30) / 0.029).round
        dividend = create(:dividend, total_amount_in_cents: threshold_amount)

        calculated_fee = ((threshold_amount * 2.9 / 100) + 30).round
        expected_fee = [3000, calculated_fee].min
        expect(dividend.calculate_flexile_fee_cents).to eq(expected_fee)
      end
    end
  end
end
