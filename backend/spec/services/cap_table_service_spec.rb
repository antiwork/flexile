# frozen_string_literal: true

RSpec.describe CapTableService do
  let(:company) { create(:company, fully_diluted_shares: 12_000_000) }
  let(:service) { described_class.new(company:, new_schema: false) }

  let!(:share_class_a) { create(:share_class, company:, name: "Class A") }
  let!(:share_class_b) { create(:share_class, company:, name: "Class B") }
  let!(:share_class_common) { create(:share_class, company:, name: "Common") }

  let!(:option_pool) { create(:option_pool, company:, share_class: share_class_common, name: "2021 Equity Incentive Plan", authorized_shares: 11_000_000, issued_shares: 1_000_000, available_shares: 10_000_000) }

  let!(:user1) { create(:user, legal_name: "Company Founder", email: "founder@example.com") }
  let!(:user2) { create(:user, legal_name: "Partner Example", email: "partner@example.com") }
  let!(:user3) { create(:user, legal_name: "John Doe", email: "contractor+1@example.com") }
  let!(:user4) { create(:user, legal_name: "Jane Snow", email: "contractor+2@example.com") }

  let!(:company_investor1) { create(:company_investor, company:, user: user1) }
  let!(:company_investor2) { create(:company_investor, company:, user: user2) }
  let!(:company_investor3) { create(:company_investor, company:, user: user3) }
  let!(:company_investor4) { create(:company_investor, company:, user: user4) }

  let!(:share_holding1) { create(:share_holding, company_investor: company_investor1, share_class: share_class_a, number_of_shares: 500_123) }

  let!(:share_holding2) { create(:share_holding, company_investor: company_investor2, share_class: share_class_b, number_of_shares: 400_000) }

  let!(:share_holding3) { create(:share_holding, company_investor: company_investor2, share_class: share_class_common, number_of_shares: 99_877) }

  let!(:equity_grant1) { create(:equity_grant, company_investor: company_investor3, option_pool:, exercise_price_usd: BigDecimal("4.64"), number_of_shares: 378_987, vested_shares: 192_234, unvested_shares: 186_753) }

  let!(:equity_grant2) { create(:equity_grant, company_investor: company_investor4, option_pool:, exercise_price_usd: BigDecimal("10.00"), number_of_shares: 621_013, vested_shares: 398_234, unvested_shares: 222_779) }

  let!(:convertible_investment) { create(:convertible_investment, company:, entity_name: "Republic.co", convertible_type: "Crowd SAFE", implied_shares: 1_000_000) }

  before do
    company_investor3.update!(total_options: 378_987)
    company_investor4.update!(total_options: 621_013)
  end

  describe "#generate" do
    let(:result) { service.generate }

    it "returns structured data with all required keys" do
      expect(result).to have_key(:investors)
      expect(result).to have_key(:option_pools)
      expect(result).to have_key(:share_classes)
      expect(result).to have_key(:exercise_prices)
      expect(result).to have_key(:outstanding_shares)
      expect(result).to have_key(:fully_diluted_shares)
    end

    it "returns correct investors data" do
      investors = result[:investors]

      # 1 founder + 1 partner + 2 contractors + 1 SAFE + 1 option pool
      expect(investors.length).to eq(6)

      expect(investors.map { |i| i[:name] }).to contain_exactly("Company Founder", "Partner Example", "John Doe", "Jane Snow", "Republic.co Crowd SAFE", "Options available (2021 Equity Incentive Plan)")

      founder = result[:investors].find { |i| i[:name] == "Company Founder" }
      expect(founder[:id]).to eq(company_investor1.external_id)
      expect(founder[:email]).to eq("founder@example.com")
      expect(founder[:outstanding_shares]).to eq(500_123)
      expect(founder[:fully_diluted_shares]).to eq(500_123)
      expect(founder[:shares_by_class]["Class A"]).to eq(500_123)
      expect(founder[:shares_by_class]["Class B"]).to eq(0)
      expect(founder[:shares_by_class]["Common"]).to eq(0)
      expect(founder[:options_by_strike][BigDecimal("4.64")]).to eq(0)
      expect(founder[:options_by_strike][BigDecimal("10.00")]).to eq(0)

      partner = result[:investors].find { |i| i[:name] == "Partner Example" }
      expect(partner[:id]).to eq(company_investor2.external_id)
      expect(partner[:email]).to eq("partner@example.com")
      expect(partner[:outstanding_shares]).to eq(499_877) # 400_000 + 99_877
      expect(partner[:fully_diluted_shares]).to eq(499_877)
      expect(partner[:shares_by_class]["Class A"]).to eq(0)
      expect(partner[:shares_by_class]["Class B"]).to eq(400_000)
      expect(partner[:shares_by_class]["Common"]).to eq(99_877)
      expect(partner[:options_by_strike][BigDecimal("4.64")]).to eq(0)
      expect(partner[:options_by_strike][BigDecimal("10.00")]).to eq(0)

      john = result[:investors].find { |i| i[:name] == "John Doe" }
      expect(john[:id]).to eq(company_investor3.external_id)
      expect(john[:email]).to eq("contractor+1@example.com")
      expect(john[:outstanding_shares]).to eq(0)
      expect(john[:fully_diluted_shares]).to eq(378_987)
      expect(john[:shares_by_class]["Class A"]).to eq(0)
      expect(john[:shares_by_class]["Class B"]).to eq(0)
      expect(john[:shares_by_class]["Common"]).to eq(0)
      expect(john[:options_by_strike][BigDecimal("4.64")]).to eq(192_234)
      expect(john[:options_by_strike][BigDecimal("10.00")]).to eq(0)

      jane = result[:investors].find { |i| i[:name] == "Jane Snow" }
      expect(jane[:id]).to eq(company_investor4.external_id)
      expect(jane[:email]).to eq("contractor+2@example.com")
      expect(jane[:outstanding_shares]).to eq(0)
      expect(jane[:fully_diluted_shares]).to eq(621_013)
      expect(jane[:shares_by_class]["Class A"]).to eq(0)
      expect(jane[:shares_by_class]["Class B"]).to eq(0)
      expect(jane[:shares_by_class]["Common"]).to eq(0)
      expect(jane[:options_by_strike][BigDecimal("4.64")]).to eq(0)
      expect(jane[:options_by_strike][BigDecimal("10.00")]).to eq(398_234)

      safe = result[:investors].find { |i| i[:name]&.include?("Republic.co") }
      expect(safe[:name]).to eq("Republic.co Crowd SAFE")
      expect(safe).not_to have_key(:id)
      expect(safe).not_to have_key(:email)
      expect(safe[:outstanding_shares]).to eq(0)
      expect(safe[:fully_diluted_shares]).to eq(0)
      expect(safe[:shares_by_class]).to be_present
      expect(safe[:options_by_strike]).to be_present
      expect(safe[:shares_by_class]["Class A"]).to eq(0)
      expect(safe[:shares_by_class]["Class B"]).to eq(0)
      expect(safe[:shares_by_class]["Common"]).to eq(0)
      expect(safe[:options_by_strike][BigDecimal("4.64")]).to eq(0)
      expect(safe[:options_by_strike][BigDecimal("10.00")]).to eq(0)

      option_pool_investor = result[:investors].find { |i| i[:name]&.include?("Options available") }
      expect(option_pool_investor[:name]).to eq("Options available (2021 Equity Incentive Plan)")
      expect(option_pool_investor).not_to have_key(:id)
      expect(option_pool_investor).not_to have_key(:email)
      expect(option_pool_investor[:outstanding_shares]).to eq(0)
      expect(option_pool_investor[:fully_diluted_shares]).to eq(10_000_000)
      expect(option_pool_investor[:shares_by_class]).to be_present
      expect(option_pool_investor[:options_by_strike]).to be_present
    end

    it "returns correct option pools data" do
      expect(result[:option_pools].first).to include(
        name: "2021 Equity Incentive Plan",
        available_shares: 10_000_000
      )
    end

    it "returns correct share classes data" do
      share_class_names = result[:share_classes].map { |sc| sc[:name] }
      expect(share_class_names).to contain_exactly("Class A", "Class B", "Common")

      expect(result[:share_classes].first).to include(
        name: "Class A",
        outstanding_shares: 500_123,
        fully_diluted_shares: 500_123
      )
      expect(result[:share_classes].second).to include(
        name: "Class B",
        outstanding_shares: 400_000,
        fully_diluted_shares: 400_000
      )
      expect(result[:share_classes].third).to include(
        name: "Common",
        outstanding_shares: 99_877,
        fully_diluted_shares: 1_099_877  # 99_877 shares + 1_000_000 options
      )
    end

    it "returns correct exercise prices" do
      expect(result[:exercise_prices]).to contain_exactly(
        BigDecimal("4.64"),
        BigDecimal("10.00")
      )
    end

    it "returns correct totals" do
      expect(result[:outstanding_shares]).to eq(1_000_000)
      expect(result[:fully_diluted_shares]).to eq(12_000_000)
    end

    context "when new_schema is true" do
      let(:service) { described_class.new(company:, new_schema: true) }

      it "uses new schema table metadata" do
        meta = service.send(:company_investors_table_meta)
        expect(meta[:table_name]).to eq("company_investor_entities")
        expect(meta[:id_column_name]).to eq("company_investor_entity_id")
      end
    end

    context "when no equity grants exist" do
      before do
        EquityGrant.destroy_all
      end

      it "returns empty exercise_prices" do
        expect(result[:exercise_prices]).to be_empty
      end

      it "sets empty options_by_strike for all investors" do
        expect(result[:investors].map { |i| i[:options_by_strike] }).to all(be_empty)
      end
    end

    context "when no share holdings exist" do
      before do
        ShareHolding.destroy_all
      end

      it "sets zero shares_by_class for all investors" do
        expect(result[:investors].map { |i| i[:shares_by_class] }).to all(eq({
          "Class A" => 0,
          "Class B" => 0,
          "Common" => 0,
        }))
      end

      it "returns zero outstanding_shares" do
        expect(result[:outstanding_shares]).to eq(0)
      end
    end

    context "when no convertible investments exist" do
      before do
        ConvertibleInvestment.destroy_all
      end

      it "does not include convertible investments" do
        expect(result[:investors].map { |i| i[:name] }.join(",")).not_to include("SAFE")
      end
    end

    context "when company has no option pools" do
      before do
        OptionPool.destroy_all
      end

      it "returns empty option_pools" do
        expect(result[:option_pools]).to be_empty
      end

      it "does not include option pool investor item" do
        expect(result[:investors].map { |i| i[:name] }).not_to include("Options available (2021 Equity Incentive Plan)")
      end
    end

    context "when company has no investors" do
      before do
        CompanyInvestor.delete_all
        ShareHolding.delete_all
        EquityGrant.delete_all
        ConvertibleInvestment.delete_all
      end

      it "returns empty investors array except for option pools" do
        expect(result[:investors].sole[:name]).to eq("Options available (2021 Equity Incentive Plan)")
      end

      it "returns zero outstanding_shares" do
        expect(result[:outstanding_shares]).to eq(0)
      end
    end
  end
end
