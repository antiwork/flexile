# frozen_string_literal: true

RSpec.describe DividendRound do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:consolidated_invoice).optional }
    it { is_expected.to have_many(:dividends) }
    it { is_expected.to have_many(:investor_dividend_rounds) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:issued_at) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:number_of_shareholders) }
    it { is_expected.to validate_numericality_of(:number_of_shareholders).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:total_amount_in_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_in_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w(Issued Paid)) }
  end

  describe "scopes" do
    describe ".ready_for_payment" do
      let!(:ready_for_payment_dividend_round) { create(:dividend_round, ready_for_payment: true) }
      let!(:not_ready_for_payment_dividend_round) { create(:dividend_round, ready_for_payment: false) }

      it "returns dividend rounds with ready_for_payment true" do
        expect(described_class.ready_for_payment).to eq([ready_for_payment_dividend_round])
      end
    end
  end

  describe "#flexile_fees_in_cents" do
    let(:dividend_round) { create(:dividend_round) }

    it "returns 0 when there are no dividends" do
      expect(dividend_round.flexile_fees_in_cents).to eq(0)
    end

    it "sums fees from multiple dividends" do
      dividend1 = create(:dividend, dividend_round: dividend_round, total_amount_in_cents: 5_000)
      dividend2 = create(:dividend, dividend_round: dividend_round, total_amount_in_cents: 10_000)
      dividend3 = create(:dividend, dividend_round: dividend_round, total_amount_in_cents: 200_000)

      expected_total = dividend1.calculate_flexile_fee_cents +
                      dividend2.calculate_flexile_fee_cents +
                      dividend3.calculate_flexile_fee_cents

      expect(dividend_round.flexile_fees_in_cents).to eq(expected_total)
    end

    it "handles single dividend" do
      dividend = create(:dividend, dividend_round: dividend_round, total_amount_in_cents: 50_000)

      expect(dividend_round.flexile_fees_in_cents).to eq(dividend.calculate_flexile_fee_cents)
    end
  end
end
