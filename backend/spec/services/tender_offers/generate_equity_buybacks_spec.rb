# frozen_string_literal: true

RSpec.describe TenderOffers::GenerateEquityBuybacks do
  let(:company) { create(:company) }
  let(:tender_offer) { create(:tender_offer, company:, accepted_price_cents: 10_00) }
  let(:service) { described_class.new(tender_offer:) }

  describe "#perform" do
    context "when there are multiple investors with multiple vested shares, different share classes" do
      let!(:option_pool) { create(:option_pool, company:) }
      let!(:share_class_a) { create(:share_class, company:, name: "Class A") }
      let!(:share_class_b) { create(:share_class, company:, name: "Class B") }

      let!(:company_investor1) { create(:company_investor, company:) }
      let!(:company_investor2) { create(:company_investor, company:) }
      let!(:company_investor3) { create(:company_investor, company:) }

      # Company Investor 1: Multiple equity grants and share holdings
      let!(:equity_grant1_1) { create(:equity_grant, company_investor: company_investor1, option_pool:, vested_shares: 100, number_of_shares: 100, exercise_price_usd: 1) }
      let!(:equity_grant1_2) { create(:equity_grant, company_investor: company_investor1, option_pool:, vested_shares: 50, number_of_shares: 50, exercise_price_usd: 2) }
      let!(:share_holding1_1) { create(:share_holding, company_investor: company_investor1, share_class: share_class_a, number_of_shares: 50, originally_acquired_at: 1.year.ago) }
      let!(:share_holding1_2) { create(:share_holding, company_investor: company_investor1, share_class: share_class_b, number_of_shares: 30, originally_acquired_at: 6.months.ago) }

      # Company Investor 2: Multiple equity grants and share holdings
      let!(:equity_grant2_1) { create(:equity_grant, company_investor: company_investor2, option_pool:, vested_shares: 200, number_of_shares: 200, exercise_price_usd: 1.5) }
      let!(:equity_grant2_2) { create(:equity_grant, company_investor: company_investor2, option_pool:, vested_shares: 100, number_of_shares: 100, exercise_price_usd: 2.5) }
      let!(:share_holding2_1) { create(:share_holding, company_investor: company_investor2, share_class: share_class_a, number_of_shares: 75, originally_acquired_at: 2.years.ago) }
      let!(:share_holding2_2) { create(:share_holding, company_investor: company_investor2, share_class: share_class_b, number_of_shares: 60, originally_acquired_at: 1.year.ago) }

      # Company Investor 3: Multiple share holdings (no equity grants)
      let!(:share_holding3_1) { create(:share_holding, company_investor: company_investor3, share_class: share_class_a, number_of_shares: 100, originally_acquired_at: 3.years.ago) }
      let!(:share_holding3_2) { create(:share_holding, company_investor: company_investor3, share_class: share_class_a, number_of_shares: 80, originally_acquired_at: 18.months.ago) }
      let!(:share_holding3_3) { create(:share_holding, company_investor: company_investor3, share_class: share_class_b, number_of_shares: 150, originally_acquired_at: 1.year.ago) }

      # Bids
      let!(:bid1) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor1, share_class: TenderOffer::VESTED_SHARES_CLASS, accepted_shares: 120) }
      let!(:bid2) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor1, share_class: "Class A", number_of_shares: 40, accepted_shares: 40) }
      let!(:bid3) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor1, share_class: "Class B", number_of_shares: 20, accepted_shares: 20) }
      let!(:bid4) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor2, share_class: TenderOffer::VESTED_SHARES_CLASS, accepted_shares: 250) }
      let!(:bid5) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor2, share_class: "Class A", number_of_shares: 60, accepted_shares: 60) }
      let!(:bid6) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor2, share_class: "Class B", number_of_shares: 40, accepted_shares: 40) }
      let!(:bid7) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor3, share_class: "Class A", number_of_shares: 150, accepted_shares: 150) }
      let!(:bid8) { create(:tender_offer_bid, tender_offer:, company_investor: company_investor3, share_class: "Class B", number_of_shares: 100, accepted_shares: 100) }

      it "creates EquityBuyback records for each company investor and type of holding" do
        expect { service.perform }.to change(EquityBuyback, :count).by(11)

        # Company Investor 1 buybacks
        company_investor1_buybacks = EquityBuyback.where(company_investor: company_investor1).order(:created_at)
        expect(company_investor1_buybacks.size).to eq(4)
        expect(company_investor1_buybacks[0]).to have_attributes(
          share_class: TenderOffer::VESTED_SHARES_CLASS,
          number_of_shares: 100,
          exercise_price_cents: 1_00,
          total_amount_cents: 90_000, # (10_00 - 1_00) * 100
          security: equity_grant1_1
        )
        expect(company_investor1_buybacks[1]).to have_attributes(
          share_class: TenderOffer::VESTED_SHARES_CLASS,
          number_of_shares: 20,
          exercise_price_cents: 2_00,
          total_amount_cents: 16_000, # (10_00 - 2_00) * 20
          security: equity_grant1_2
        )
        expect(company_investor1_buybacks[2]).to have_attributes(
          share_class: "Class A",
          number_of_shares: 40,
          total_amount_cents: 40_000, # 10_00 * 40
          exercise_price_cents: 0,
          security: share_holding1_1
        )
        expect(company_investor1_buybacks[3]).to have_attributes(
          share_class: "Class B",
          number_of_shares: 20,
          total_amount_cents: 20_000, # 10_00 * 20
          exercise_price_cents: 0,
          security: share_holding1_2
        )

        # Company Investor 2 buybacks
        company_investor2_buybacks = EquityBuyback.where(company_investor: company_investor2).order(:created_at)
        expect(company_investor2_buybacks.size).to eq(4)
        expect(company_investor2_buybacks[0]).to have_attributes(
          share_class: TenderOffer::VESTED_SHARES_CLASS,
          number_of_shares: 200,
          exercise_price_cents: 1_50,
          total_amount_cents: 170_000, # (10_00 - 1_50) * 200
          security: equity_grant2_1
        )
        expect(company_investor2_buybacks[1]).to have_attributes(
          share_class: TenderOffer::VESTED_SHARES_CLASS,
          number_of_shares: 50,
          exercise_price_cents: 2_50,
          total_amount_cents: 37_500, # (10_00 - 2_50) * 50
          security: equity_grant2_2
        )
        expect(company_investor2_buybacks[2]).to have_attributes(
          share_class: "Class A",
          number_of_shares: 60,
          total_amount_cents: 60_000, # 10_00 * 60
          exercise_price_cents: 0,
          security: share_holding2_1
        )
        expect(company_investor2_buybacks[3]).to have_attributes(
          share_class: "Class B",
          number_of_shares: 40,
          total_amount_cents: 40_000, # 10_00 * 40
          exercise_price_cents: 0,
          security: share_holding2_2
        )

        # Company Investor 3 buybacks
        company_investor3_buybacks = EquityBuyback.where(company_investor: company_investor3).order(:created_at)
        expect(company_investor3_buybacks.size).to eq(3)
        expect(company_investor3_buybacks[0]).to have_attributes(
          share_class: "Class A",
          number_of_shares: 100,
          total_amount_cents: 100_000, # 10_00 * 100
          exercise_price_cents: 0,
          security: share_holding3_1
        )
        expect(company_investor3_buybacks[1]).to have_attributes(
          share_class: "Class A",
          number_of_shares: 50,
          total_amount_cents: 50_000, # 10_00 * 50
          exercise_price_cents: 0,
          security: share_holding3_2
        )
        expect(company_investor3_buybacks[2]).to have_attributes(
          share_class: "Class B",
          number_of_shares: 100,
          total_amount_cents: 100_000, # 10_00 * 100
          exercise_price_cents: 0,
          security: share_holding3_3
        )
      end

      it "creates an EquityBuybackRound with correct attributes" do
        service.perform

        expect(EquityBuybackRound.count).to eq(1)
        round = EquityBuybackRound.last
        expect(round).to have_attributes(
          number_of_shares: 780,
          total_amount_cents: 7_235_00,
          number_of_shareholders: 3,
          status: "Issued"
        )
        expect(round.issued_at).to be_present
      end
    end
  end
end
