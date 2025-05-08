# frozen_string_literal: true

RSpec.describe "Share holdings page" do
  let!(:share_holding1) do
    share_class = create(:share_class, name: "Pre-seed stock")
    create(:share_holding, company_investor:, issued_at: Time.utc(2019, 1, 1), number_of_shares: 1_000_000,
                           share_price_usd: 0.00003, share_class:)
  end
  let!(:share_holding2) do
    share_class = create(:share_class, name: "Common")
    create(:share_holding, company_investor:, issued_at: Time.utc(2020, 1, 3), number_of_shares: 9_123,
                           share_price_usd: 10.20, share_class:)
  end
  let!(:share_holding3) do
    share_class = create(:share_class, name: "Preferred stock (Series Seed)")
    create(:share_holding, company_investor:, issued_at: Time.utc(2021, 5, 9), number_of_shares: 99,
                           share_price_usd: 20.81, share_class:)
  end
  let!(:share_holding4) do
    share_class = create(:share_class, name: "Preferred stock (Series C)")
    create(:share_holding, company_investor:, issued_at: Time.utc(2022, 11, 24), number_of_shares: 92,
                           share_price_usd: 2.41, share_class:)
  end

  let(:company) { create(:company, valuation_in_dollars: 100_000_000, fully_diluted_shares: 2_000_000, equity_grants_enabled: true) }
  let(:company_investor) { create(:company_investor, company:) }

  before do
    sign_in company_investor.user
  end

  it "shows the share holding list" do
    visit spa_company_shares_path(company.external_id)

    # Tab heading
    expect(page).not_to have_link("Options")
    expect(page).not_to have_link("Convertibles")

    # Stats
    expect(page).to have_text("1,009,314 Total shares", normalize_ws: true) # 1M + 9_123 + 99 + 92

    # 100_000_000.0 / 2_000_000 * (1M + 9_123 + 99 + 92)
    expect(page).to have_text("$50,465,700 Equity value ($100M valuation)", normalize_ws: true)

    expect(page).to have_text("50.466% Ownership", normalize_ws: true) # (1_009_314 / 2_000_000 * 100) with 3 decimals

    # Table
    expect(page).to have_table(with_rows: [
                                 {
                                   "Issue date" => "Jan 1, 2019",
                                   "Type" => "Pre-seed stock",
                                   "Number of shares" => "1,000,000",
                                   "Share price" => "$0.00003",
                                   "Cost" => "$30", # 1M * 0.00003
                                 },
                                 {
                                   "Issue date" => "Jan 3, 2020",
                                   "Type" => "Common",
                                   "Number of shares" => "9,123",
                                   "Share price" => "$10.20",
                                   "Cost" => "$93,054.60", # 9_123 * 10.20
                                 },
                                 {
                                   "Issue date" => "May 9, 2021",
                                   "Type" => "Preferred stock (Series Seed)",
                                   "Number of shares" => "99",
                                   "Share price" => "$20.81",
                                   "Cost" => "$2,060.19", # 99 * 20.81
                                 },
                                 {
                                   "Issue date" => "Nov 24, 2022",
                                   "Type" => "Preferred stock (Series C)",
                                   "Number of shares" => "92",
                                   "Share price" => "$2.41",
                                   "Cost" => "$221.72", # 92 * 2.41
                                 }
                               ])

    # Pagination
    stub_const("Internal::Companies::ShareHoldingsController::RECORDS_PER_PAGE", 1)
    visit spa_company_shares_path(company.external_id)
    expect(page).to have_text("Showing 1-1 of 4")
  end

  it "shows the 'Options' and 'Convertibles' tabs if records exist" do
    create(:equity_grant, company_investor:)
    create(:convertible_security, company_investor:)

    visit spa_company_shares_path(company.external_id)

    expect(page).to have_link("Options", href: spa_company_equity_path(company.external_id))
    expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
  end
end
