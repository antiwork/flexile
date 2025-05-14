# frozen_string_literal: true

RSpec.describe EquityBuybackRound do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:tender_offer) }
    it { is_expected.to have_many(:equity_buybacks) }
    # it { is_expected.to have_many(:investor_dividend_rounds) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:number_of_shareholders) }
    it { is_expected.to validate_numericality_of(:number_of_shareholders).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:total_amount_cents) }
    it { is_expected.to validate_numericality_of(:total_amount_cents).is_greater_than(0) }
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(%w(Issued Paid)) }
  end

  describe "scopes" do
    describe ".ready_for_payment" do
      let!(:ready_for_payment_equity_buyback_round) { create(:equity_buyback_round, ready_for_payment: true) }
      let!(:not_ready_for_payment_equity_buyback_round) { create(:equity_buyback_round, ready_for_payment: false) }

      it "returns equity buyback rounds with ready_for_payment true" do
        expect(described_class.ready_for_payment).to eq([ready_for_payment_equity_buyback_round])
      end
    end
  end
end
