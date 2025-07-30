# frozen_string_literal: true

RSpec.describe "Dividends page" do
  let(:company_investor) do
    investor = create(:company_investor, company:)
    create(:convertible_security, company_investor: investor)
    investor
  end
  let(:company) { create(:company, equity_enabled: true) }

  before do
    sign_in company_investor.user
  end

  let!(:dividend1) do
    dividend_round = create(:dividend_round, issued_at: Time.utc(2021, 1, 1))
    create(:dividend, :paid, company_investor:, dividend_round:, number_of_shares: 100,
                             total_amount_in_cents: 987_567_12)
  end
  let!(:dividend2) do
    dividend_round = create(:dividend_round, issued_at: Time.utc(2022, 3, 30))
    create(:dividend, company_investor:, dividend_round:, number_of_shares: 1032,
                      total_amount_in_cents: 193_12)
  end
  let!(:dividend3) do
    dividend_round = create(:dividend_round, issued_at: Time.utc(2023, 11, 9))
    create(:dividend, :pending, company_investor:, dividend_round:, number_of_shares: 167,
                                total_amount_in_cents: 1_234_56)
  end
  let!(:dividend4) do
    dividend_round = create(:dividend_round, issued_at: Time.utc(2024, 10, 8))
    create(:dividend, :retained, company_investor:, dividend_round:, number_of_shares: 224,
                                 total_amount_in_cents: 567_213_90, retained_reason: "ofac_sanctioned_country")
  end
  let!(:dividend5) do
    dividend_round = create(:dividend_round, issued_at: Time.utc(2025, 8, 13))
    create(:dividend, :retained, company_investor:, dividend_round:, number_of_shares: 983,
                                 total_amount_in_cents: 987_213_90, retained_reason: "below_minimum_payment_threshold")
  end

  it "shows all dividend details" do
    visit spa_company_dividends_path(company.external_id)

    # Header
    expect(page).to have_text("Equity")

    # Tab title
    expect(page).to have_text("Dividends")
    expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
    expect(page).not_to have_link("Options")
    expect(page).not_to have_link("Shares")

    # Table
    expect(page).to have_table(with_rows: [
                                 {
                                   "Issue date" => "Aug 13, 2025",
                                   "Shares" => "983",
                                   "Amount" => "$987,213.90",
                                   "Status" => "Retained",
                                 },
                                 {
                                   "Issue date" => "Oct 8, 2024",
                                   "Shares" => "224",
                                   "Amount" => "$567,213.90",
                                   "Status" => "Retained",
                                 },
                                 {
                                   "Issue date" => "Nov 9, 2023",
                                   "Shares" => "167",
                                   "Amount" => "$1,234.56",
                                   "Status" => "Pending signup",
                                 },
                                 {
                                   "Issue date" => "Mar 30, 2022",
                                   "Shares" => "1,032",
                                   "Amount" => "$193.12",
                                   "Status" => "Issued",
                                 },
                                 {
                                   "Issue date" => "Jan 1, 2021",
                                   "Shares" => "100",
                                   "Amount" => "$987,567.12",
                                   "Status" => "Paid",
                                 },
                               ])
    within(:table_row, { "Shares" => "983" }) do
      expect(find_button("Retained")).to have_tooltip "This dividend doesn't meet the payout threshold set in your settings."
    end
    within(:table_row, { "Shares" => "224" }) do
      expect(find_button("Retained")).to have_tooltip "This dividend is retained due to sanctions imposed on your residence country."
    end

    # Pagination
    stub_const("Internal::Companies::DividendsController::RECORDS_PER_PAGE", 1)
    visit spa_company_dividends_path(company.external_id)
    expect(page).to have_text("Showing 1-1 of 5")
  end

  it "shows the 'Options' and 'Shares' and 'Convertibles' tabs if records exist" do
    create(:equity_grant, company_investor:)
    create(:share_holding, company_investor:)

    visit spa_company_dividends_path(company.external_id)

    expect(page).to have_link("Options", href: spa_company_equity_grants_path(company.external_id))
    expect(page).to have_link("Shares", href: spa_company_shares_path(company.external_id))
    expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
  end
end
