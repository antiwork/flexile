# frozen_string_literal: true

RSpec.describe DividendComputation do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:dividend_computation_outputs).dependent(:destroy) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:total_amount_in_usd) }
    it { is_expected.to validate_presence_of(:dividends_issuance_date) }
  end

  let(:company) { create(:company) }

  before do
    @seed_class = create(:share_class, company:, name: "Seed", original_issue_price_in_dollars: 1.1234, hurdle_rate: 12, preferred: true)
    @A_class = create(:share_class, company:, name: "Series A", original_issue_price_in_dollars: 1.2389, hurdle_rate: 7, preferred: true)
    @common_class = create(:share_class, company:, name: "Common", original_issue_price_in_dollars: nil, hurdle_rate: nil)

    @seed_investor = create(:company_investor, user: create(:user, legal_name: "Seed Investor"), company:)
    create(:share_holding, company_investor: @seed_investor, share_class: @seed_class, number_of_shares: 99_283, originally_acquired_at: 91.days.ago, total_amount_in_cents: 111_406_00)
    create(:share_holding, company_investor: @seed_investor, share_class: @seed_class, number_of_shares: 12_123, originally_acquired_at: 89.days.ago, total_amount_in_cents: 13_625_00)

    @series_A_investor = create(:company_investor, user: create(:user, legal_name: "Series A Investor"), company:)
    create(:share_holding, company_investor: @series_A_investor, share_class: @A_class, number_of_shares: 32_123, total_amount_in_cents: 39_768_00)
    create(:share_holding, company_investor: @series_A_investor, share_class: @A_class, number_of_shares: 1_346, total_amount_in_cents: 1_666_00)

    @seed_and_series_A_investor = create(:company_investor,
                                         user: create(:user, legal_name: "Seed & Series A Investor"),
                                         company:)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @seed_class, number_of_shares: 3_098, total_amount_in_cents: 3_480_00)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @seed_class, number_of_shares: 4_820, total_amount_in_cents: 5_417_00)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @A_class,
                           number_of_shares: 2_934, total_amount_in_cents: 3_632_00)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @A_class,
                           number_of_shares: 1_589, total_amount_in_cents: 1_967_00)

    @common_investor = create(:company_investor, user: create(:user, legal_name: "Common Investor"), company:)
    create(:share_holding, company_investor: @common_investor, share_class: @common_class, number_of_shares: 123, originally_acquired_at: 30.days.ago, total_amount_in_cents: 138_00)
    create(:share_holding, company_investor: @common_investor, share_class: @common_class, number_of_shares: 768, originally_acquired_at: 31.days.ago, total_amount_in_cents: 863_00)
    @all_class_investor = create(:company_investor, user: create(:user, legal_name: "All class Investor"), company:)
    create(:share_holding, company_investor: @all_class_investor, share_class: @seed_class, number_of_shares: 9_876, total_amount_in_cents: 11_100_00)
    create(:share_holding, company_investor: @all_class_investor, share_class: @seed_class, number_of_shares: 5_432, total_amount_in_cents: 6_105_00)
    create(:share_holding, company_investor: @all_class_investor, share_class: @A_class, number_of_shares: 1_987, total_amount_in_cents: 2_460_00)
    create(:share_holding, company_investor: @all_class_investor, share_class: @A_class, number_of_shares: 6_543, total_amount_in_cents: 8_103_00)
    create(:share_holding, company_investor: @all_class_investor, share_class: @common_class, number_of_shares: 210, total_amount_in_cents: 236_00)
    create(:share_holding, company_investor: @all_class_investor, share_class: @common_class, number_of_shares: 987, total_amount_in_cents: 1_109_00)

    @entire_safe_owner = create(:company_investor, company:, user: create(:user, legal_name: "Richie Rich LLC"))
    @safe1 = create(:convertible_investment, company:, entity_name: "Richie Rich LLC", implied_shares: 987_632,
                                             amount_in_cents: 1_000_000_00)
    create(:convertible_security, company_investor: @entire_safe_owner, convertible_investment: @safe1,
                                  implied_shares: 987_632, principal_value_in_cents: 1_000_000_00)

    @safe2 = create(:convertible_investment, company:, entity_name: "Wefunder", implied_shares: 497_092,
                                             amount_in_cents: 2_000_000_00)
    @partial_safe_owner1 = create(:company_investor, company:,)
    @partial_safe_owner2 = create(:company_investor, company:,)
    @partial_safe_owner3 = create(:company_investor, company:,)
    create(:convertible_security, company_investor: @partial_safe_owner1, convertible_investment: @safe2,
                                  implied_shares: 497_092.to_d / 2_000_000_00.to_d * 123_456_78.to_d,
                                  principal_value_in_cents: 123_456_78)
    create(:convertible_security, company_investor: @partial_safe_owner2, convertible_investment: @safe2,
                                  implied_shares: 497_092.to_d / 2_000_000_00.to_d * 910_234_56.to_d,
                                  principal_value_in_cents: 910_234_56)
    create(:convertible_security, company_investor: @partial_safe_owner3, convertible_investment: @safe2,
                                  implied_shares: 497_092.to_d / 2_000_000_00.to_d * 966_308_66.to_d,
                                  principal_value_in_cents: 966_308_66)

    @dividend_computation = DividendComputationGeneration.new(company, amount_in_usd: 1_000_000, return_of_capital: false).process
  end

  describe "#to_csv" do
    it "generates CSV data as expected" do
      expected_result = +"Investor,Share class,Number of shares,Hurdle rate,Original issue price (USD)," \
                         "Common dividend amount (USD),Preferred dividend amount (USD),Total amount (USD)\n"
      expected_result << "Seed Investor,Seed,111406,12.0,1.1234,65309.83,15018.43,80328.26\n"
      expected_result << "Series A Investor,Series A,33469,7.0,1.2389,19620.62,2902.54,22523.16\n"
      expected_result << "Seed & Series A Investor,Seed,7918,12.0,1.1234,4641.79,1067.41,5709.2\n"
      expected_result << "Seed & Series A Investor,Series A,4523,7.0,1.2389,2651.53,392.25,3043.78\n"
      expected_result << "Common Investor,Common,891,,,522.34,0.0,522.34\n"
      expected_result << "All class Investor,Seed,15308,12.0,1.1234,8974.05,2063.65,11037.7\n"
      expected_result << "All class Investor,Series A,8530,7.0,1.2389,5000.57,739.75,5740.32\n"
      expected_result << "All class Investor,Common,1197,,,701.73,0.0,701.73\n"
      expected_result << "Richie Rich LLC,#{@safe1.identifier},987632,,,578982.04,0.0,578982.04\n"
      expected_result << "Wefunder,#{@safe2.identifier},497092,,,291411.52,0.0,291411.52\n"

      expect(@dividend_computation.to_csv).to eq(expected_result)
    end
  end

  describe "#to_per_investor_csv" do
    it "generates CSV data as expected" do
      expected_result = +"Investor,Investor ID,Number of shares,Amount (USD)\n"
      expected_result << "Seed Investor,#{@seed_investor.id},111406,80328.26\n"
      expected_result << "Series A Investor,#{@series_A_investor.id},33469,22523.16\n"
      expected_result << "Seed & Series A Investor,#{@seed_and_series_A_investor.id},12441,8752.98\n"
      expected_result << "Common Investor,#{@common_investor.id},891,522.34\n"
      expected_result << "All class Investor,#{@all_class_investor.id},25035,17479.75\n"
      expected_result << "Richie Rich LLC,,987632,578982.04\n"
      expected_result << "Wefunder,,497092,291411.52\n"

      expect(@dividend_computation.to_per_investor_csv).to eq(expected_result)
    end
  end

  describe "#to_final_csv" do
    it "generates CSV data as expected" do
      expected_result = +"Investor,Investor ID,Number of shares,Amount (USD)\n"
      expected_result << "Seed Investor,#{@seed_investor.id},111406,80328.26\n"
      expected_result << "Series A Investor,#{@series_A_investor.id},33469,22523.16\n"
      expected_result << "Seed & Series A Investor,#{@seed_and_series_A_investor.id},12441,8752.98\n"
      expected_result << "Common Investor,#{@common_investor.id},891,522.34\n"
      expected_result << "All class Investor,#{@all_class_investor.id},25035,17479.75\n"
      expected_result << "Richie Rich LLC,#{@entire_safe_owner.id},,578982.04\n"

      # ROUND(291411.52/2000000 * 123456.78, 2)
      #   $291,411.52 is dividend for the whole SAFE
      #   $2,000,000 is total investment amount for the whole SAFE
      #   $123,456.78 is the investment amount for the partial SAFE owner
      expected_result << "#{@partial_safe_owner1.user.legal_name},#{@partial_safe_owner1.id},,17988.36\n"
      # ROUND(291411.52/2000000 * 910234.56, 2)
      expected_result << "#{@partial_safe_owner2.user.legal_name},#{@partial_safe_owner2.id},,132626.42\n"
      # ROUND(291411.52/2000000 * 966308.66, 2)
      expected_result << "#{@partial_safe_owner3.user.legal_name},#{@partial_safe_owner3.id},,140796.74\n"

      expect(@dividend_computation.to_final_csv).to eq(expected_result)
    end
  end

  describe "#generate_dividends" do
    it "generates records as expected" do
      expect do
        @dividend_computation.generate_dividends
      end.to change { company.dividends.count }.by(9) # 1 record per investor
         .and change { company.dividend_rounds.count }.by(1)

      dividend_round = company.dividend_rounds.last
      expect(dividend_round.issued_at).to eq(@dividend_computation.dividends_issuance_date)
      expect(dividend_round.number_of_shares).to eq(183_242) # 111406 + 33469 + 12441 + 891 + 25035; SAFEs are not counted
      expect(dividend_round.number_of_shareholders).to eq(9)
      expect(dividend_round.status).to eq("Issued")
      expect(dividend_round.total_amount_in_cents).to eq(1_000_000_00)
      expect(dividend_round.return_of_capital).to eq(false)

      dividends_data = [
        { investor: @seed_investor, total_amount_in_cents: 80_328_26, qualified_amount_cents: 71_587_08, number_of_shares: 111_406, investment_amount_cents: 125_031_00 },
        { investor: @series_A_investor, total_amount_in_cents: 22_523_16, qualified_amount_cents: 22_523_16, number_of_shares: 33_469, investment_amount_cents: 41_434_00 },
        { investor: @seed_and_series_A_investor, total_amount_in_cents: 8_752_98, qualified_amount_cents: 8_752_98, number_of_shares: 12_441, investment_amount_cents: 14_496_00 },
        { investor: @common_investor, total_amount_in_cents: 522_34, qualified_amount_cents: 0, number_of_shares: 891, investment_amount_cents: 1_001_00 },
        { investor: @all_class_investor, total_amount_in_cents: 17_479_75, qualified_amount_cents: 17_479_75, number_of_shares: 25_035, investment_amount_cents: 29_113_00 },
        { investor: @entire_safe_owner, total_amount_in_cents: 57_8982_04, qualified_amount_cents: 57_8982_04, number_of_shares: nil, investment_amount_cents: 1_000_000_00 },
        { investor: @partial_safe_owner1, total_amount_in_cents: 17_988_36, qualified_amount_cents: 17_988_36, number_of_shares: nil, investment_amount_cents: 123_456_78 },
        { investor: @partial_safe_owner2, total_amount_in_cents: 13_2626_42, qualified_amount_cents: 13_2626_42, number_of_shares: nil, investment_amount_cents: 910_234_56 },
        { investor: @partial_safe_owner3, total_amount_in_cents: 14_0796_74, qualified_amount_cents: 14_0796_74, number_of_shares: nil, investment_amount_cents: 966_308_66 }
      ]

      dividends_data.each do |data|
        expect(
          company.dividends.exists?(
            dividend_round_id: dividend_round.id,
            company_investor_id: data[:investor].id,
            total_amount_in_cents: data[:total_amount_in_cents],
            qualified_amount_cents: data[:qualified_amount_cents],
            number_of_shares: data[:number_of_shares],
            investment_amount_cents: data[:investment_amount_cents],
            status: "Issued"
          )
        ).to eq(true)
      end
    end
  end

  describe "#dividends_info" do
    it "returns the expected data" do
      share_dividends, safe_dividends = @dividend_computation.dividends_info

      expect(share_dividends).to eq({
        @seed_investor.id => { number_of_shares: 111_406, total_amount: 80_328.26, qualified_dividends_amount: 71_587.08, investment_amount_cents: 125_031_00 },
        @series_A_investor.id => { number_of_shares: 33_469, total_amount: 22_523.16, qualified_dividends_amount: 22_523.16, investment_amount_cents: 41_434_00 },
        @seed_and_series_A_investor.id => { number_of_shares: 12_441, total_amount: 8_752.98, qualified_dividends_amount: 8_752.98, investment_amount_cents: 14_496_00 },
        @common_investor.id => { number_of_shares: 891, total_amount: 522.34, qualified_dividends_amount: 0, investment_amount_cents: 1_001_00 },
        @all_class_investor.id => { number_of_shares: 25_035, total_amount: 17_479.75, qualified_dividends_amount: 17_479.75, investment_amount_cents: 29_113_00 },
      })
      expect(safe_dividends).to eq({
        @safe1.entity_name => { number_of_shares: 987_632, total_amount: 578_982.04, qualified_dividends_amount: 578_982.04 },
        @safe2.entity_name => { number_of_shares: 497_092, total_amount: 291_411.52, qualified_dividends_amount: 291_411.52 },
      })
    end
  end

  describe "#broken_down_by_investor" do
    it "returns aggregated data for all investors" do
      result = @dividend_computation.broken_down_by_investor

      expect(result).to be_an(Array)
      expect(result.length).to eq(7) # 5 share investors + 2 SAFE investors

      expect(result.map { |r| r[:investor_name] }).to match_array([
                                                                    "Richie Rich LLC", "Wefunder", "Seed Investor", "Series A Investor",
                                                                    "All class Investor", "Seed & Series A Investor", "Common Investor"
                                                                  ])
    end

    it "correctly aggregates share-based investors" do
      result = @dividend_computation.broken_down_by_investor

      seed_investor_data = result.find { |r| r[:investor_name] == "Seed Investor" }
      expect(seed_investor_data).to include(
        investor_name: "Seed Investor",
        company_investor_id: @seed_investor.id,
        investor_external_id: @seed_investor.user.external_id,
        total_amount: 80_328.26,
        number_of_shares: 111_406
      )

      series_a_investor_data = result.find { |r| r[:investor_name] == "Series A Investor" }
      expect(series_a_investor_data).to include(
        investor_name: "Series A Investor",
        company_investor_id: @series_A_investor.id,
        investor_external_id: @series_A_investor.user.external_id,
        total_amount: 22_523.16,
        number_of_shares: 33_469
      )
    end

    it "correctly aggregates investors with multiple share classes" do
      result = @dividend_computation.broken_down_by_investor

      multi_class_investor_data = result.find { |r| r[:investor_name] == "Seed & Series A Investor" }
      expect(multi_class_investor_data).to include(
        investor_name: "Seed & Series A Investor",
        company_investor_id: @seed_and_series_A_investor.id,
        investor_external_id: @seed_and_series_A_investor.user.external_id,
        total_amount: 8_752.98,
        number_of_shares: 12_441
      )

      all_class_investor_data = result.find { |r| r[:investor_name] == "All class Investor" }
      expect(all_class_investor_data).to include(
        investor_name: "All class Investor",
        company_investor_id: @all_class_investor.id,
        investor_external_id: @all_class_investor.user.external_id,
        total_amount: 17_479.75,
        number_of_shares: 25_035
      )
    end

    it "correctly handles SAFE investors" do
      result = @dividend_computation.broken_down_by_investor

      richie_rich_data = result.find { |r| r[:investor_name] == "Richie Rich LLC" }
      expect(richie_rich_data).to include(
        investor_name: "Richie Rich LLC",
        company_investor_id: nil,
        investor_external_id: nil,
        total_amount: 578_982.04,
        number_of_shares: 987_632
      )

      wefunder_data = result.find { |r| r[:investor_name] == "Wefunder" }
      expect(wefunder_data).to include(
        investor_name: "Wefunder",
        company_investor_id: nil,
        investor_external_id: nil,
        total_amount: 291_411.52,
        number_of_shares: 497_092
      )
    end

    it "handles edge case with no dividend computation outputs" do
      empty_computation = create(:dividend_computation, company: company, total_amount_in_usd: 0, dividends_issuance_date: Date.current)

      result = empty_computation.broken_down_by_investor
      expect(result).to eq([])
    end
  end

  describe "#number_of_shareholders" do
    it "counts total unique shareholders" do
      # Share investors: 5 (seed, series A, seed & series A, common, all class)
      # SAFE investors: 4 (entire_safe_owner from safe1, plus 3 partial owners from safe2)

      # @safe2 (Wefunder) counts as 3 investors
      # because it has 3 convertible_securities for different company_investors

      # Total: 9
      expect(@dividend_computation.number_of_shareholders).to eq(9)
    end
  end
end
