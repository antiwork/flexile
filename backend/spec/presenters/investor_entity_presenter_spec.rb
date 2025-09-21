# frozen_string_literal: true

RSpec.describe InvestorEntityPresenter do
  let(:company) { create(:company) }
  let(:investor_entity) { create(:company_investor_entity, company: company, name: "Test Investor") }
  let(:presenter) { described_class.new(investor_entity) }

  describe "#props" do
    it "returns the correct structure" do
      result = presenter.props

      expect(result).to include(
        id: investor_entity.external_id,
        name: "Test Investor",
        grants: be_an(Array),
        shares: be_an(Array)
      )
    end

    context "with equity grants" do
      let!(:grant) do
        create(:equity_grant,
               company_investor_entity: investor_entity,
               number_of_shares: 150,
               vested_shares: 100,
               unvested_shares: 50,
               exercised_shares: 0)
      end

      it "includes grant data" do
        result = presenter.props

        expect(result[:grants].first).to include(
          issuedAt: grant.issued_at,
          numberOfShares: 150,
          vestedShares: 100,
          unvestedShares: 50,
          exercisedShares: 0,
          exercisePriceUsd: grant.exercise_price_usd
        )
      end

      it "limits grants to RECORDS_PER_SECTION" do
        create_list(:equity_grant, described_class::RECORDS_PER_SECTION, company_investor_entity: investor_entity)

        result = presenter.props

        expect(result[:grants].length).to eq(described_class::RECORDS_PER_SECTION)
      end
    end

    context "with multiple equity grants" do
      it "orders grants by issued_at desc" do
        older_grant = create(:equity_grant,
                             company_investor_entity: investor_entity,
                             issued_at: 10.days.ago,
                             number_of_shares: 100,
                             vested_shares: 50,
                             unvested_shares: 50,
                             exercised_shares: 0)
        newer_grant = create(:equity_grant,
                             company_investor_entity: investor_entity,
                             issued_at: 1.day.ago,
                             number_of_shares: 100,
                             vested_shares: 50,
                             unvested_shares: 50,
                             exercised_shares: 0)

        result = presenter.props

        expect(result[:grants].first[:issuedAt]).to eq(newer_grant.issued_at)
        expect(result[:grants].second[:issuedAt]).to eq(older_grant.issued_at)
      end
    end

    context "with share holdings" do
      let!(:share) do
        create(:share_holding,
               company_investor_entity: investor_entity,
               name: "Common Stock",
               number_of_shares: 1000)
      end

      it "includes share data" do
        result = presenter.props

        expect(result[:shares].first).to include(
          issuedAt: share.issued_at,
          shareType: "Common Stock",
          numberOfShares: 1000,
          sharePriceUsd: share.share_price_usd,
          totalAmountInCents: share.total_amount_in_cents
        )
      end

      it "limits shares to RECORDS_PER_SECTION" do
        create_list(:share_holding, described_class::RECORDS_PER_SECTION, company_investor_entity: investor_entity)

        result = presenter.props

        expect(result[:shares].length).to eq(described_class::RECORDS_PER_SECTION)
      end
    end
  end
end
