# frozen_string_literal: true

RSpec.describe "Dividend Round details page" do
  let(:company) { create(:company, equity_enabled: true) }

  shared_examples "a user with access" do
    it "shows all relevant information" do
      dividend_round1 = create(:dividend_round, issued_at: Time.utc(2021, 8, 20),
                                                number_of_shareholders: 9_123,
                                                number_of_shares: 18_093,
                                                total_amount_in_cents: 184_548_60,
                                                company:)
      create(:dividend_round, issued_at: Time.utc(2022, 9, 13),
                              number_of_shareholders: 99,
                              number_of_shares: 629,
                              total_amount_in_cents: 13_089_49,
                              company:)
      dividend1 = create(:dividend, :paid, dividend_round: dividend_round1, number_of_shares: 100,
                                           total_amount_in_cents: 10_20 * 100)
      dividend2 = create(:dividend, dividend_round: dividend_round1, number_of_shares: 1032,
                                    total_amount_in_cents: 10_20 * 1032)
      dividend3 = create(:dividend, :pending, dividend_round: dividend_round1, number_of_shares: 167,
                                              total_amount_in_cents: 10_20 * 167)
      dividend4 = create(:dividend, :retained, retained_reason: "ofac_sanctioned_country",
                                               total_amount_in_cents: 10_20 * 224,
                                               dividend_round: dividend_round1, number_of_shares: 224)
      dividend5 = create(:dividend, :retained, retained_reason: "below_minimum_payment_threshold",
                                               total_amount_in_cents: 10_20 * 371,
                                               dividend_round: dividend_round1, number_of_shares: 371)

      sign_in user
      visit spa_company_dividend_round_path(company.external_id, dividend_round1.id)

      expect(page).to have_text("Dividend")

      # Stats
      expect(page).to have_text("$184,548.60 Dividend amount", normalize_ws: true)
      expect(page).to have_text("9,123 Shareholders", normalize_ws: true)
      expect(page).to have_text("Aug 20, 2021 Date", normalize_ws: true)

      # Table
      within(:table_row, { "Shares" => "371", "Amount" => "$3,784.20" }) do
        expect(page).to have_text(dividend5.company_investor.user.display_name)
        expect(find_button("Retained")).to have_tooltip "This dividend doesn't meet the payout threshold set by the investor."
      end
      within(:table_row, { "Shares" => "224", "Amount" => "$2,284.80" }) do
        expect(page).to have_text(dividend4.company_investor.user.display_name)
        expect(find_button("Retained")).to have_tooltip "This dividend is retained due to sanctions imposed on the investor's residence country."
      end
      within(:table_row, { "Shares" => "167", "Amount" => "$1,703.40", "Status" => "Pending signup" }) do
        expect(page).to have_text(dividend3.company_investor.user.display_name)
      end
      within(:table_row, { "Shares" => "1,032", "Amount" => "$10,526.40", "Status" => "Issued" }) do
        expect(page).to have_text(dividend2.company_investor.user.display_name)
      end
      within(:table_row, { "Shares" => "100", "Amount" => "$1,020", "Status" => "Paid" }) do
        expect(page).to have_text(dividend1.company_investor.user.display_name)
      end

      # Pagination
      stub_const("Internal::Companies::DividendRoundsController::RECORDS_PER_PAGE", 1)
      visit spa_company_dividend_round_path(company.external_id, dividend_round1.id)
      expect(page).to have_text("Showing 1-1 of 5")
    end
  end

  context "when authenticated as a company administrator" do
    let(:user) { create(:company_administrator, company:).user }

    it_behaves_like "a user with access"
  end

  context "when authenticated as a company lawyer" do
    let(:user) { create(:company_lawyer, company:).user }

    it_behaves_like "a user with access"
  end
end
