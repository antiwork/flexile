# frozen_string_literal: true

RSpec.describe "Tender offer listing page" do
  let(:company) { create(:company, equity_enabled: true) }
  let(:starts_at_1) { Time.current.beginning_of_day }
  let(:ends_at_1) { starts_at_1 + 3.weeks }
  let(:starts_at_2) { 1.year.ago.beginning_of_day }
  let(:ends_at_2) { starts_at_1 + 3.weeks }
  let!(:tender_offer_1) do
    create(:tender_offer, starts_at: starts_at_1, ends_at: ends_at_1, company:, minimum_valuation: 100_000_000)
  end
  let!(:tender_offer_2) do
    create(:tender_offer, starts_at: starts_at_2, ends_at: ends_at_2, company:, minimum_valuation: 200_000_000)
  end

  def common_assertions
    expect(page).to have_table(with_rows: [
                                 {
                                   "Start date" => starts_at_1.strftime("%b %-d, %Y"),
                                   "End date" => ends_at_1.strftime("%b %-d, %Y"),
                                   "Minimum valuation" => "$100,000,000",
                                 },
                                 {
                                   "Start date" => starts_at_2.strftime("%b %-d, %Y"),
                                   "End date" => ends_at_2.strftime("%b %-d, %Y"),
                                   "Minimum valuation" => "$200,000,000",
                                 },
                               ])

    expect(page).to have_link(starts_at_1.strftime("%b %-d, %Y"),
                              href: spa_company_tender_offer_path(company.external_id, tender_offer_1.external_id))
    expect(page).to have_link(starts_at_2.strftime("%b %-d, %Y"),
                              href: spa_company_tender_offer_path(company.external_id, tender_offer_2.external_id))
  end

  context "when logged in as a company administrator" do
    before do
      sign_in create(:company_administrator, company:).user
    end

    it "renders a table of tender offers" do
      visit spa_company_tender_offers_path(company.external_id)

      common_assertions

      expect(page).to have_link("New tender offer", href: new_spa_company_tender_offer_path(company.external_id))
    end
  end

  context "when logged in as a company investor" do
    before do
      sign_in create(:company_investor, company:).user
    end

    it "renders a table of tender offers" do
      visit spa_company_tender_offers_path(company.external_id)

      common_assertions

      expect(page).not_to have_link("New tender offer")
    end
  end
end
