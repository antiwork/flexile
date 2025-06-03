# frozen_string_literal: true

RSpec.describe "Dividend Rounds listing page" do
  let(:company) { create(:company) }

  shared_examples "a user with access" do
    context "when records exist" do
      let!(:dividend_round1) do
        create(:dividend_round, issued_at: Time.utc(2021, 8, 20),
                                number_of_shareholders: 9_123,
                                number_of_shares: 18_093,
                                total_amount_in_cents: 184_548_60,
                                company:)
      end

      let!(:dividend_round2) do
        create(:dividend_round, issued_at: Time.utc(2022, 9, 13),
                                number_of_shareholders: 99,
                                number_of_shares: 629,
                                total_amount_in_cents: 13_089_49,
                                company:)
      end

      it "lists the company's dividend rounds" do
        sign_in user
        visit spa_company_dividend_rounds_path(company.external_id)

        # Tab heading
        expect(page).to have_text("Dividends")
        expect(page).to_not have_link("Options")

        # Table
        expect(page).to have_table(with_rows: [
                                     { "Issue date" => "Aug 20, 2021", "Dividend amount" => "$184,548.60", "Shareholders" => "9,123" },
                                     { "Issue date" => "Sep 13, 2022", "Dividend amount" => "$13,089.49", "Shareholders" => "99" }
                                   ])

        expect(page).to have_link("Aug 20, 2021", href: spa_company_dividend_round_path(company.external_id, dividend_round1.id))
        expect(page).to have_link("Sep 13, 2022", href: spa_company_dividend_round_path(company.external_id, dividend_round2.id))

        # Pagination
        stub_const("Internal::Companies::DividendRoundsController::RECORDS_PER_PAGE", 1)
        visit spa_company_dividend_rounds_path(company.external_id)
        expect(page).to have_text("Showing 1-1 of 2")
      end
    end

    it "shows a message when there are no records" do
      sign_in user
      visit spa_company_dividend_rounds_path(company.external_id)

      expect(page).to have_text("You have not issued any dividends yet.")
    end

    it "shows the 'Grants' tab when the relevant feature is enabled" do
      company.update!(equity_grants_enabled: true)
      sign_in user

      visit spa_company_dividend_rounds_path(company.external_id)

      expect(page).to have_link("Options", href: spa_company_equity_grants_path(company.external_id))
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
