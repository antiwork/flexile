# frozen_string_literal: true

RSpec.describe LiquidationScenarioCalculation do
  describe '#process' do
    context 'with simple common stock' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor1) { create(:company_investor, company:) }
      let(:investor2) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 100_00) }

      before do
        create(:share_holding, company_investor: investor1, share_class: common_class, number_of_shares: 60)
        create(:share_holding, company_investor: investor2, share_class: common_class, number_of_shares: 40)
        described_class.new(scenario).process
      end

      it 'creates a payout per investor' do
        expect(scenario.liquidation_payouts.count).to eq(2)
      end

      it 'distributes the entire exit amount' do
        expect(scenario.liquidation_payouts.sum(:payout_amount_cents)).to eq(100_00)
      end

      it 'pays investor1 pro rata' do
        payout = scenario.liquidation_payouts.find_by(company_investor: investor1)
        expect(payout.payout_amount_cents).to eq(60_00)
      end

      it 'pays investor2 pro rata' do
        payout = scenario.liquidation_payouts.find_by(company_investor: investor2)
        expect(payout.payout_amount_cents).to eq(40_00)
      end

      it 'records equity security type' do
        expect(scenario.liquidation_payouts.pluck(:security_type).uniq).to eq(['equity'])
      end
    end

    context 'with preferred stock' do
      let(:company) { create(:company) }
      let(:preferred_class) { create(:share_class, :preferred, company:, original_issue_price_in_dollars: 1.0) }
      let(:common_class) { create(:share_class, company:) }
      let(:pref_investor) { create(:company_investor, company:) }
      let(:common_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 150_00) }

      before do
        create(:share_holding, company_investor: pref_investor, share_class: preferred_class, number_of_shares: 100)
        create(:share_holding, company_investor: common_investor, share_class: common_class, number_of_shares: 100)
        described_class.new(scenario).process
      end

      it 'creates payouts for both investors' do
        expect(scenario.liquidation_payouts.count).to eq(2)
      end

      it 'gives preferred investor preference first' do
        payout = scenario.liquidation_payouts.find_by(company_investor: pref_investor)
        expect(payout.liquidation_preference_amount.to_i).to eq(100_00)
      end

      it 'common investor receives remainder' do
        payout = scenario.liquidation_payouts.find_by(company_investor: common_investor)
        expect(payout.payout_amount_cents).to eq(50_00)
      end

      it 'totals to exit amount' do
        expect(scenario.liquidation_payouts.sum(:payout_amount_cents)).to eq(150_00)
      end
    end

    context 'with participating preferred with cap' do
      let(:company) { create(:company) }
      let(:preferred_class) do
        create(:share_class, :preferred, :participating, company:, original_issue_price_in_dollars: 1.0, participation_cap_multiple: 2.0)
      end
      let(:common_class) { create(:share_class, company:) }
      let(:pref_investor) { create(:company_investor, company:) }
      let(:common_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 300_00) }

      before do
        create(:share_holding, company_investor: pref_investor, share_class: preferred_class, number_of_shares: 100)
        create(:share_holding, company_investor: common_investor, share_class: common_class, number_of_shares: 100)
        described_class.new(scenario).process
      end

      it 'pays liquidation preference' do
        payout = scenario.liquidation_payouts.find_by(company_investor: pref_investor)
        expect(payout.liquidation_preference_amount.to_i).to eq(100_00)
      end

      it 'pays participation up to cap' do
        payout = scenario.liquidation_payouts.find_by(company_investor: pref_investor)
        expect(payout.participation_amount.to_i).to eq(100_00)
      end

      it 'pays common holder remaining amount' do
        payout = scenario.liquidation_payouts.find_by(company_investor: common_investor)
        expect(payout.common_proceeds_amount.to_i).to eq(100_00)
      end

      it 'sums to exit amount' do
        expect(scenario.liquidation_payouts.sum(:payout_amount_cents)).to eq(300_00)
      end
    end

  context 'with convertible securities' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor) { create(:company_investor, company:) }
      let(:convertible_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 40_000) }

      before do
        create(:share_holding, company_investor: investor, share_class: common_class, number_of_shares: 100)
        investment = create(:convertible_investment, company:)
        create(:convertible_security, company_investor: convertible_investor, convertible_investment: investment, principal_value_in_cents: 10_000, implied_shares: 100)
        described_class.new(scenario).process
      end

      it 'creates two payouts' do
        expect(scenario.liquidation_payouts.count).to eq(2)
      end

      it 'chooses conversion when beneficial' do
        payout = scenario.liquidation_payouts.find_by(company_investor: convertible_investor)
        expect(payout.payout_amount_cents).to eq(20_000)
      end

      it 'common investor receives remaining amount' do
        payout = scenario.liquidation_payouts.find_by(company_investor: investor)
        expect(payout.payout_amount_cents).to eq(20_000)
      end

      it 'records convertible security type' do
        payout = scenario.liquidation_payouts.find_by(company_investor: convertible_investor)
        expect(payout.security_type).to eq('convertible')
      end
    end

    context 'with valuation cap' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor) { create(:company_investor, company:) }
      let(:convertible_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 50_000) }

      before do
        create(:share_holding, company_investor: investor, share_class: common_class, number_of_shares: 100)
        investment = create(:convertible_investment, company:)
        create(:convertible_security, company_investor: convertible_investor, convertible_investment: investment,
                                       principal_value_in_cents: 10_000, implied_shares: 100,
                                       valuation_cap_cents: 2_000)
        described_class.new(scenario).process
      end

      it 'uses cap price for conversion' do
        payout = scenario.liquidation_payouts.find_by(company_investor: convertible_investor)
        expect(payout.payout_amount_cents).to be > 10_000
      end
    end

    context 'with discount rate' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor) { create(:company_investor, company:) }
      let(:convertible_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 50_000) }

      before do
        create(:share_holding, company_investor: investor, share_class: common_class, number_of_shares: 100)
        investment = create(:convertible_investment, company:)
        create(:convertible_security, company_investor: convertible_investor, convertible_investment: investment,
                                       principal_value_in_cents: 10_000, implied_shares: 100,
                                       discount_rate_percent: 20)
        described_class.new(scenario).process
      end

      it 'applies discount to conversion price' do
        payout = scenario.liquidation_payouts.find_by(company_investor: convertible_investor)
        expect(payout.payout_amount_cents).to be > 10_000
      end
    end

    context 'with interest accrual' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor) { create(:company_investor, company:) }
      let(:convertible_investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 20_000) }

      before do
        create(:share_holding, company_investor: investor, share_class: common_class, number_of_shares: 100)
        investment = create(:convertible_investment, company:)
        create(:convertible_security, company_investor: convertible_investor, convertible_investment: investment,
                                       principal_value_in_cents: 10_000, implied_shares: 50,
                                       interest_rate_percent: 10, issued_at: 1.year.ago, maturity_date: 1.day.ago)
        described_class.new(scenario).process
      end

      it 'includes accrued interest in payout' do
        payout = scenario.liquidation_payouts.find_by(company_investor: convertible_investor)
        expect(payout.payout_amount_cents).to be > 10_000
      end
    end

    context 'with multiple convertibles' do
      let(:company) { create(:company) }
      let(:common_class) { create(:share_class, company:) }
      let(:investor) { create(:company_investor, company:) }
      let(:convertible_1) { create(:company_investor, company:) }
      let(:convertible_2) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 100_000) }

      before do
        create(:share_holding, company_investor: investor, share_class: common_class, number_of_shares: 100)
        investment = create(:convertible_investment, company:)
        create(:convertible_security, company_investor: convertible_1, convertible_investment: investment,
                                       principal_value_in_cents: 10_000, implied_shares: 100)
        create(:convertible_security, company_investor: convertible_2, convertible_investment: investment,
                                       principal_value_in_cents: 20_000, implied_shares: 100)
        described_class.new(scenario).process
      end

      it 'creates payouts for all convertibles' do
        expect(scenario.liquidation_payouts.where(security_type: 'convertible').count).to eq(2)
      end
    end

    context 'with insufficient exit amount' do
      let(:company) { create(:company) }
      let(:preferred_class) { create(:share_class, :preferred, company:, original_issue_price_in_dollars: 1.0) }
      let(:investor) { create(:company_investor, company:) }
      let(:scenario) { create(:liquidation_scenario, company:, exit_amount_cents: 50_00) }

      before do
        create(:share_holding, company_investor: investor, share_class: preferred_class, number_of_shares: 100)
        described_class.new(scenario).process
      end

      it 'pays out only available amount' do
        payout = scenario.liquidation_payouts.first
        expect(payout.payout_amount_cents).to eq(50_00)
      end
    end
  end
end
