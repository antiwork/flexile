# frozen_string_literal: true

RSpec.describe "Convertible securities page" do
  let!(:security1) do
    convertible_investment = create(:convertible_investment, company_valuation_in_dollars: 100_000_000,
                                                             convertible_type: "Crowd SAFE")
    create(:convertible_security, company_investor:, issued_at: Time.utc(2020, 1, 3), implied_shares: 9923.23456789,
                                  convertible_investment:, principal_value_in_cents: 500_000_00)
  end
  let!(:security2) do
    convertible_investment = create(:convertible_investment, company_valuation_in_dollars: 200_000_000,
                                                             convertible_type: "RUV SAFE")
    create(:convertible_security, company_investor:, issued_at: Time.utc(2021, 5, 9), implied_shares: 8280.67567567,
                                  convertible_investment:, principal_value_in_cents: 1_000_000_00)
  end

  let(:company) { create(:company, valuation_in_dollars: 150_000_000, fully_diluted_shares: 9_000_000, equity_grants_enabled: true) }
  let(:company_investor) { create(:company_investor, company:) }

  before do
    sign_in company_investor.user
  end

  it "shows the convertible securities list" do
    visit spa_company_convertibles_path(company.external_id)

    # Tab heading
    expect(page).to have_text("Convertibles")
    expect(page).not_to have_link("Options")
    expect(page).not_to have_link("Shares")

    # Stats
    expect(page).to have_text("$1,500,000 Investment amount", normalize_ws: true) # 1M + 1.5M
    expect(page).to have_text("$150M Public valuation cap", normalize_ws: true)
    expect(page).to have_text("0.202% Implied ownership", normalize_ws: true) # ((9923.23456789 + 8280.67567567) / 9M) * 100

    # Table
    expect(page).to have_table(with_rows: [
                                 {
                                   "Issue date" => "Jan 3, 2020",
                                   "Type" => "Crowd SAFE",
                                   "Pre-money valuation cap" => "$100,000,000",
                                   "Investment amount" => "$500,000",
                                 },
                                 {
                                   "Issue date" => "May 9, 2021",
                                   "Type" => "RUV SAFE",
                                   "Pre-money valuation cap" => "$200,000,000",
                                   "Investment amount" => "$1,000,000",
                                 },
                               ])

    # Pagination
    stub_const("Internal::Companies::ConvertibleSecuritiesController::RECORDS_PER_PAGE", 1)
    visit spa_company_convertibles_path(company.external_id)
    expect(page).to have_text("Showing 1-1 of 2")
  end

  it "shows the 'Options' and 'Shares' tabs if records exist" do
    create(:equity_grant, company_investor:)
    create(:share_holding, company_investor:)

    visit spa_company_convertibles_path(company.external_id)

    expect(page).to have_link("Options", href: spa_company_equity_path(company.external_id))
    expect(page).to have_link("Shares", href: spa_company_shares_path(company.external_id))
  end
end
