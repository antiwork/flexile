# frozen_string_literal: true

RSpec.describe EquityBuyback do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:equity_buyback_round) }
    it { is_expected.to belong_to(:company_investor) }
    it { is_expected.to belong_to(:security) }
    it { is_expected.to have_and_belong_to_many(:equity_buyback_payments).join_table(:equity_buybacks_equity_buyback_payments) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:total_amount_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:share_price_cents) }
    it { is_expected.to validate_numericality_of(:share_price_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:exercise_price_cents) }
    it { is_expected.to validate_numericality_of(:exercise_price_cents).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_presence_of(:share_class) }
    it { is_expected.to validate_inclusion_of(:status)
                          .in_array(["Issued", "Retained", "Processing", "Paid"]) }
    it { is_expected.to validate_inclusion_of(:retained_reason)
                          .in_array(%w[ofac_sanctioned_country]) }
  end

  describe "scopes" do
    describe ".paid" do
      let!(:paid_equity_buyback) { create(:equity_buyback, :paid) }

      before do
        create(:equity_buyback)
        create(:equity_buyback, :retained)
      end

      it "returns equity buybacks with status 'Paid'" do
        expect(described_class.paid).to eq([paid_equity_buyback])
      end
    end
  end

  describe "#external_status" do
    context "when status is 'Processing'" do
      subject { build(:equity_buyback, status: "Processing").external_status }

      it { is_expected.to eq("Issued") }
    end

    context "when status is not 'Processing'" do
      subject { build(:equity_buyback, status: "Issued").external_status }

      it { is_expected.to eq("Issued") }
    end
  end

  describe "#issued?" do
    context "when status is 'Issued'" do
      subject { build(:equity_buyback).issued? }

      it { is_expected.to eq(true) }
    end

    context "when status is not 'Issued'" do
      subject { build(:equity_buyback, :paid).issued? }

      it { is_expected.to eq(false) }
    end
  end

  describe "#retained?" do
    context "when status is 'Retained'" do
      subject { build(:equity_buyback, :retained).retained? }

      it { is_expected.to eq(true) }
    end

    context "when status is not 'Retained'" do
      subject { build(:equity_buyback, :paid).retained? }

      it { is_expected.to eq(false) }
    end
  end

  describe "#mark_retained!" do
    let(:equity_buyback) { create(:equity_buyback) }
    let(:reason) { EquityBuyback::RETAINED_REASONS.sample }

    it "updates the status to 'Retained' and sets the retained reason" do
      equity_buyback.mark_retained!(reason)

      expect(equity_buyback.status).to eq("Retained")
      expect(equity_buyback.retained_reason).to eq(reason)
    end
  end
end
