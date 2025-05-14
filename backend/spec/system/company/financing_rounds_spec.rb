# frozen_string_literal: true

RSpec.describe "Financing rounds page", skip: "Feature removed" do
  let(:company) do
    company = create(:company, fully_diluted_shares: 12_000_000)
    Flipper.enable(:financing_rounds, company)
    company
  end

  shared_examples "a user with access" do
    context "when records exist" do
      let!(:financing_round1) do
        create(:financing_round, company:, name: "Seed", shares_issued: 1_000,
                                 price_per_share_cents: 5_00, amount_raised_cents: 500_000_00,
                                 issued_at: 30.days.ago, post_money_valuation_cents: 5_000_000_00,
                                 investors: [
                                   { name: "John Doe", amount_invested_cents: 250_000_00 },
                                   { name: "Jane Smith", amount_invested_cents: 250_000_00 }
                                 ])
      end
      let!(:financing_round2) do
        create(:financing_round, company:, name: "Series A", shares_issued: 500,
                                 price_per_share_cents: 10_00, amount_raised_cents: 500_000_00,
                                 issued_at: 90.days.ago, post_money_valuation_cents: 10_000_000_00,
                                 investors: [
                                   { name: "ABC Ventures", amount_invested_cents: 300_000_00 },
                                   { name: "XYZ Capital", amount_invested_cents: 200_000_00 }
                                 ])
      end

      before do
        sign_in user
        visit spa_company_financing_rounds_path(company.external_id)
      end

      it "shows the financing rounds for the company" do
        expect(page).to have_table(with_rows: [
                                     { "Round" => "Seed" },
                                     { "Date" => financing_round1.issued_at.strftime("%b %-d, %Y") },
                                     { "Shares issued" => "1,000" },
                                     { "Price per share" => "$5" },
                                     { "Amount raised" => "$500,000" },
                                     { "Post-money valuation" => "$5,000,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "John Doe" },
                                     { "Amount raised" => "$250,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "Jane Smith" },
                                     { "Amount raised" => "$250,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "Series A" },
                                     { "Date" => financing_round2.issued_at.strftime("%b %-d, %Y") },
                                     { "Shares issued" => "500" },
                                     { "Price per share" => "$10" },
                                     { "Amount raised" => "$500,000" },
                                     { "Post-money valuation" => "$10,000,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "ABC Ventures" },
                                     { "Amount raised" => "$300,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "XYZ Capital" },
                                     { "Amount raised" => "$200,000" },
                                   ])

        expect(page).to have_table(with_rows: [
                                     { "Round" => "Total" },
                                     { "Shares issued" => "1,500" },
                                     { "Amount raised" => "$1,000,000" },
                                   ])
      end
    end

    it "shows a message when there are no records" do
      sign_in user
      visit spa_company_financing_rounds_path(company.external_id)
      expect(page).to have_text("There are no financing rounds recorded yet.")
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

  context "when authenticated as an investor" do
    let(:user) { create(:company_investor, company:).user }
    it_behaves_like "a user with access"
  end
end
