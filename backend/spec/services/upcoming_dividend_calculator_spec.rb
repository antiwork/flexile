# frozen_string_literal: true

RSpec.describe UpcomingDividendCalculator do
  let(:company) { create(:company) }

  before do
    seed_class = create(:share_class, company:, name: "Seed", original_issue_price_in_dollars: 1.1234, hurdle_rate: 12)
    a_class = create(:share_class, company:, name: "Series A", original_issue_price_in_dollars: 1.2389, hurdle_rate: 7)
    common_class = create(:share_class, company:, name: "Common", original_issue_price_in_dollars: nil, hurdle_rate: nil)

    @seed_investor = create(:company_investor, user: create(:user, legal_name: "Seed Investor"), company:)
    create(:share_holding, company_investor: @seed_investor, share_class: seed_class, number_of_shares: 99_283)
    create(:share_holding, company_investor: @seed_investor, share_class: seed_class, number_of_shares: 12_123)

    @series_A_investor = create(:company_investor, user: create(:user, legal_name: "Series A Investor"), company:)
    create(:share_holding, company_investor: @series_A_investor, share_class: a_class, number_of_shares: 32_123)
    create(:share_holding, company_investor: @series_A_investor, share_class: a_class, number_of_shares: 1_346)

    @seed_and_series_A_investor = create(:company_investor,
                                         user: create(:user, legal_name: "Seed & Series A Investor"),
                                         company:)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: seed_class, number_of_shares: 3_098)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: seed_class, number_of_shares: 4_820)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: a_class,
                           number_of_shares: 2_934)
    create(:share_holding, company_investor: @seed_and_series_A_investor, share_class: a_class,
                           number_of_shares: 1_589)

    @common_investor = create(:company_investor, user: create(:user, legal_name: "Common Investor"), company:)
    create(:share_holding, company_investor: @common_investor, share_class: common_class, number_of_shares: 123)
    create(:share_holding, company_investor: @common_investor, share_class: common_class, number_of_shares: 768)

    @all_class_investor = create(:company_investor, user: create(:user, legal_name: "All class Investor"), company:)
    create(:share_holding, company_investor: @all_class_investor, share_class: seed_class, number_of_shares: 9_876)
    create(:share_holding, company_investor: @all_class_investor, share_class: seed_class, number_of_shares: 5_432)
    create(:share_holding, company_investor: @all_class_investor, share_class: a_class, number_of_shares: 1_987)
    create(:share_holding, company_investor: @all_class_investor, share_class: a_class, number_of_shares: 6_543)
    create(:share_holding, company_investor: @all_class_investor, share_class: common_class, number_of_shares: 210)
    create(:share_holding, company_investor: @all_class_investor, share_class: common_class, number_of_shares: 987)

    @safe1 = create(:convertible_investment, company:, entity_name: "Richie Rich LLC", implied_shares: 987_632,
                                             amount_in_cents: 1_000_000_00)
    @safe2 = create(:convertible_investment, company:, entity_name: "Wefunder", implied_shares: 497_092,
                                             amount_in_cents: 2_000_000_00)
  end

  # The outputs should be similar to those from method `DividendComputation#dividends_info`
  it "calculates the upcoming dividends for the company investors" do
    expect do
      UpcomingDividendCalculator.new(company, amount_in_usd: 1_000_000).process
    end.not_to change(DividendComputation, :count)

    [@seed_investor, @series_A_investor, @seed_and_series_A_investor, @common_investor,
     @all_class_investor, @safe1, @safe2].each { _1.reload }

    service = DividendComputationGeneration.new(company, amount_in_usd: 1_000_000, return_of_capital: false)
    dividend_computation = service.process
    share_dividends, safe_dividends = dividend_computation.dividends_info

    expect(@seed_investor.upcoming_dividend_cents).to eq(
      (share_dividends[@seed_investor.id][:total_amount] * 100.to_d).to_i
    )
    expect(@series_A_investor.upcoming_dividend_cents).to eq(
      (share_dividends[@series_A_investor.id][:total_amount] * 100.to_d).to_i
    )
    expect(@seed_and_series_A_investor.upcoming_dividend_cents).to eq(
      (share_dividends[@seed_and_series_A_investor.id][:total_amount] * 100.to_d).to_i
    )
    expect(@common_investor.upcoming_dividend_cents).to eq(
      (share_dividends[@common_investor.id][:total_amount] * 100.to_d).to_i
    )
    expect(@all_class_investor.upcoming_dividend_cents).to eq(
      (share_dividends[@all_class_investor.id][:total_amount] * 100.to_d).to_i
    )

    expect(@safe1.upcoming_dividend_cents).to eq((safe_dividends[@safe1.entity_name][:total_amount] * 100.to_d).to_i)
    expect(@safe2.upcoming_dividend_cents).to eq((safe_dividends[@safe2.entity_name][:total_amount] * 100.to_d).to_i)
  end
end
