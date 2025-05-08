# frozen_string_literal: true

RSpec.describe DividendComputationGeneration do
  let(:company) { create(:company) }

  def seed_data
    @seed_class = create(:share_class, company:, name: "Seed", original_issue_price_in_dollars: 1.1234, hurdle_rate: 12, preferred: true)
    @A_class = create(:share_class, company:, name: "Series A", original_issue_price_in_dollars: 1.2389, hurdle_rate: 7, preferred: true)
    @common_class = create(:share_class, company:, name: "Common", original_issue_price_in_dollars: nil, hurdle_rate: nil)

    @seed_investor = create(:company_investor, user: create(:user, legal_name: "Seed Investor"), company:)
    create(:share_holding, company_investor: @seed_investor, share_class: @seed_class, number_of_shares: 99_283, originally_acquired_at: 91.days.ago)
    create(:share_holding, company_investor: @seed_investor, share_class: @seed_class, number_of_shares: 12_123, originally_acquired_at: 89.days.ago)

    @series_A_investor = create(:company_investor, user: create(:user, legal_name: "Series A Investor"), company:)
    create(:share_holding, company_investor: @series_A_investor, share_class: @A_class, number_of_shares: 32_123)
    create(:share_holding, company_investor: @series_A_investor, share_class: @A_class, number_of_shares: 1_346)

    @seed_and_series_A_investor = create(:company_investor,
                                         user: create(:user, legal_name: "Seed & Series A Investor"),
                                         company:)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @seed_class, number_of_shares: 3_098)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @seed_class, number_of_shares: 4_820)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @A_class,
                           number_of_shares: 2_934)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: @A_class,
                           number_of_shares: 1_589)

    @common_investor = create(:company_investor, user: create(:user, legal_name: "Common Investor"), company:)
    create(:share_holding, company_investor: @common_investor, share_class: @common_class, number_of_shares: 123, originally_acquired_at: 30.days.ago)
    create(:share_holding, company_investor: @common_investor, share_class: @common_class, number_of_shares: 768, originally_acquired_at: 31.days.ago)

    @all_class_investor = create(:company_investor, user: create(:user, legal_name: "All class Investor"), company:)
    create(:share_holding, company_investor: @all_class_investor, share_class: @seed_class, number_of_shares: 9_876)
    create(:share_holding, company_investor: @all_class_investor, share_class: @seed_class, number_of_shares: 5_432)
    create(:share_holding, company_investor: @all_class_investor, share_class: @A_class, number_of_shares: 1_987)
    create(:share_holding, company_investor: @all_class_investor, share_class: @A_class, number_of_shares: 6_543)
    create(:share_holding, company_investor: @all_class_investor, share_class: @common_class, number_of_shares: 210)
    create(:share_holding, company_investor: @all_class_investor, share_class: @common_class, number_of_shares: 987)

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
  end

  it "generates records as expected" do
    seed_data

    dividend_computation = nil
    expect do
      dividend_computation = described_class.new(company, amount_in_usd: 1_000_000, return_of_capital: false).process
    end.to change { company.dividend_computations.count }.by(1)
       .and change { DividendComputationOutput.count }.by(10) # 1 record per investor per share class

    expect(dividend_computation.company).to eq(company)
    expect(dividend_computation.total_amount_in_usd).to eq(1_000_000)
    expect(dividend_computation.return_of_capital).to eq(false)
    expect(dividend_computation.dividend_computation_outputs.count).to eq(10)

    # $ Available after paying dividend to preferred shares
    #   = Total - Sum of all preferred dividends
    #   = 1,000,000 - 22,184.03
    #   = $977,815.97
    # Total shares considered
    #   = company.convertible_investments.sum(:implied_shares) + company.share_holdings.sum(:number_of_shares)
    #   = 183,242 + (987,632 + 497,092)
    #   = 1,667,966

    # Seed Investor
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @seed_investor.id,
             share_class: "Seed",
             number_of_shares: 111_406, # 99_283 + 12_123,
             hurdle_rate: 12,
             original_issue_price_in_usd: 1.1234,
             preferred_dividend_amount_in_usd: 15_018.43, # ROUNDUP((12 / 100) * 1.1234 * 111406, 2)
             dividend_amount_in_usd: 65_309.83, # ROUNDUP(977815.97 * (111406 / 1667966), 2)
             qualified_dividend_amount_usd: 71_587.08, # ROUNDUP((12 / 100) * 1.1234 * 99283, 2) + ROUNDUP(977815.97 * (99283 / 1667966), 2)
             total_amount_in_usd: 80_328.26
           )).to eq(true)

    # Series A Investor
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @series_A_investor.id,
             share_class: "Series A",
             number_of_shares: 33_469, # 32_123 + 1_346
             hurdle_rate: 7,
             original_issue_price_in_usd: 1.2389,
             preferred_dividend_amount_in_usd: 2_902.54, # ROUNDUP((7 / 100) * 1.2389 * 33469, 2)
             dividend_amount_in_usd: 19_620.62, # ROUNDUP(977815.97 * (33469 / 1667966), 2)
             qualified_dividend_amount_usd: 22_523.16, # ROUNDUP((7 / 100) * 1.2389 * 33469, 2) + ROUNDUP(977815.97 * (33469 / 1667966), 2)
             total_amount_in_usd: 22_523.16
           )).to eq(true)

    # Seed and Series A investor
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @seed_and_series_A_investor.id,
             share_class: "Seed",
             number_of_shares: 7_918, # 3_098 + 4_820
             hurdle_rate: 12,
             original_issue_price_in_usd: 1.1234,
             preferred_dividend_amount_in_usd: 1_067.41, # ROUNDUP((12 / 100) * 1.1234 * 7918, 2)
             dividend_amount_in_usd: 4_641.79, # ROUNDUP(977815.97 * (7918 / 1667966), 2)
             qualified_dividend_amount_usd: 5_709.20, # ROUNDUP((12 / 100) * 1.1234 * 7918, 2) + ROUNDUP(977815.97 * (7918 / 1667966), 2)
             total_amount_in_usd: 5_709.20
           )).to eq(true)
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @seed_and_series_A_investor.id,
             share_class: "Series A",
             number_of_shares: 4_523, # 2_934 + 1_589
             hurdle_rate: 7,
             original_issue_price_in_usd: 1.2389,
             preferred_dividend_amount_in_usd: 392.25, # ROUNDUP((7 / 100) * 1.2389 * 4523, 2)
             dividend_amount_in_usd: 2_651.53, # ROUNDUP(977815.97 * (4523 / 1667966), 2)
             qualified_dividend_amount_usd: 3_043.78, # ROUNDUP((7 / 100) * 1.2389 * 4523, 2) + ROUNDUP(977815.97 * (4523 / 1667966), 2)
             total_amount_in_usd: 3_043.78
           )).to eq(true)

    # Common Investor
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @common_investor.id,
             share_class: "Common",
             number_of_shares: 891, # 123 + 768
             hurdle_rate: nil,
             original_issue_price_in_usd: nil,
             preferred_dividend_amount_in_usd: 0,
             dividend_amount_in_usd: 522.34, # ROUNDUP(977815.97 * (891 / 1667966), 2)
             qualified_dividend_amount_usd: 0, # No eligible shares for qualified dividends
             total_amount_in_usd: 522.34
           )).to eq(true)

    # Investor with all share classes
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @all_class_investor.id,
             share_class: "Seed",
             number_of_shares: 15_308, # 9_876 + 5_432
             hurdle_rate: 12,
             original_issue_price_in_usd: 1.1234,
             preferred_dividend_amount_in_usd: 2_063.65, # ROUNDUP((12 / 100) * 1.1234 * 15308, 2)
             dividend_amount_in_usd: 8_974.05, # ROUNDUP(977815.97 * (15308 / 1667966), 2)
             qualified_dividend_amount_usd: 11_037.70, # ROUNDUP((12 / 100) * 1.1234 * 15308, 2) + ROUNDUP(977815.97 * (15308 / 1667966), 2)
             total_amount_in_usd: 11_037.70
           )).to eq(true)
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @all_class_investor.id,
             share_class: "Series A",
             number_of_shares: 8_530, # 1_987 + 6_543
             hurdle_rate: 7,
             original_issue_price_in_usd: 1.2389,
             preferred_dividend_amount_in_usd: 739.75, # ROUNDUP((7 / 100) * 1.2389 * 8530, 2)
             dividend_amount_in_usd: 5_000.57, # ROUNDUP(977815.97 * (8530 / 1667966), 2)
             qualified_dividend_amount_usd: 5_740.32, # ROUNDUP((7 / 100) * 1.2389 * 8530, 2) + ROUNDUP(977815.97 * (8530 / 1667966), 2)
             total_amount_in_usd: 5_740.32
           )).to eq(true)
    expect(dividend_computation.dividend_computation_outputs.exists?(
             company_investor_id: @all_class_investor.id,
             share_class: "Common",
             number_of_shares: 1_197, # 210 + 987
             hurdle_rate: nil,
             original_issue_price_in_usd: nil,
             preferred_dividend_amount_in_usd: 0,
             dividend_amount_in_usd: 701.73, # ROUNDUP(977815.97 * (1197 / 1667966), 2)
             qualified_dividend_amount_usd: 701.73, # ROUNDUP(977815.97 * (1197 / 1667966), 2)
             total_amount_in_usd: 701.73
           )).to eq(true)

    # SAFE 1 - "Richie Rich LLC"
    expect(dividend_computation.dividend_computation_outputs.exists?(
             investor_name: "Richie Rich LLC",
             share_class: @safe1.identifier,
             number_of_shares: 987_632,
             hurdle_rate: nil,
             original_issue_price_in_usd: nil,
             preferred_dividend_amount_in_usd: 0,
             dividend_amount_in_usd: 578_982.04, # ROUNDUP(977815.97 * (987632 / 1667966), 2)
             qualified_dividend_amount_usd: 578_982.04, # ROUNDUP(977815.97 * (987632 / 1667966), 2)
             total_amount_in_usd: 578_982.04
           )).to eq(true)

    # SAFE 2 - "Wefunder"
    expect(dividend_computation.dividend_computation_outputs.exists?(
             investor_name: "Wefunder",
             share_class: @safe2.identifier,
             number_of_shares: 497_092,
             hurdle_rate: nil,
             original_issue_price_in_usd: nil,
             preferred_dividend_amount_in_usd: 0,
             dividend_amount_in_usd: 291_411.52, # ROUNDUP(977815.97 * (497092 / 1667966), 2)
             qualified_dividend_amount_usd: 291_411.52, # ROUNDUP(977815.97 * (497092 / 1667966), 2)
             total_amount_in_usd: 291_411.52
           )).to eq(true)

    # Assert sum of all computed dividends
    # It's more than the input that is 1M because of rounding up. This was the case when Cooley did the calculation too.
    expect(dividend_computation.dividend_computation_outputs.sum(:total_amount_in_usd)).to eq(1_000_000.05)
  end
end
