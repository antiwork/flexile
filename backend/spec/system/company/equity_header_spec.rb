# frozen_string_literal: true

RSpec.describe "Equity section navigation" do
  let(:company) { create(:company) }
  let(:company_administrator) { create(:company_administrator, company:) }
  let(:company_lawyer) { create(:company_lawyer, company:) }
  let(:company_worker) { create(:company_worker, company:) }
  let(:company_investor) do
    investor = create(:company_investor, company:)
    # Create records so the respective tabs are shown.
    # If and how tabs are hidden based on the presence of records is tested in the specs for the pages under "Equity"
    create(:equity_grant, company_investor: investor)
    create(:convertible_security, company_investor: investor)
    create(:share_holding, company_investor: investor)
    investor
  end

  shared_examples "nav items for administrator roles" do
    before { sign_in user }

    it "does not show the nav item if no features are enabled" do
      visit root_path

      expect(page).to_not have_link("Equity")
    end

    it "shows the expected nav link and tabs if feature dividends is enabled" do
      Flipper.enable(:cap_table, company) if equity_path == spa_company_cap_table_path(company.external_id)

      visit root_path

      click_on "Equity"
      expect(page).to have_current_path(equity_path)
      expect(page).to_not have_link("Options")
      expect(page).to_not have_link("Shares")
      expect(page).to_not have_link("Convertibles")
      expect(page).to_not have_link("Option pools")
      expect(page).to_not have_link("Rounds")
      expect(page).to have_link("Dividends", href: spa_company_dividend_rounds_path(company.external_id))
    end

    it "shows the expected nav link and tabs if all features are enabled" do
      Flipper.enable(:cap_table, company)
      company.update!(equity_grants_enabled: true)

      visit root_path

      click_on "Equity"
      expect(page).to have_current_path(spa_company_cap_table_path(company.external_id))
      expect(page).to have_link("Options", href: spa_company_equity_grants_path(company.external_id))
      expect(page).to_not have_link("Shares")
      expect(page).to_not have_link("Convertibles")
      expect(page).to have_link("Dividends", href: spa_company_dividend_rounds_path(company.external_id))
      expect(page).to have_link("Option pools", href: spa_company_option_pools_path(company.external_id))
      expect(page).to have_link("Cap table", href: spa_company_cap_table_path(company.external_id))
    end
  end

  context "when a company administrator is signed in" do
    let(:user) { company_administrator.user }
    let(:equity_path) { spa_company_dividend_rounds_path(company.external_id) }

    it_behaves_like "nav items for administrator roles"

    it "shows the expected nav link and tabs if the tender_offers feature is enabled" do
      sign_in user
      Flipper.enable(:cap_table, company)
      company.update!(tender_offers_enabled: true)

      visit root_path
      click_on "Equity"

      expect(page).to have_link("Tender offers", href: spa_company_tender_offers_path(company.external_id))
    end
  end

  context "when a company lawyer is signed in" do
    let(:user) { company_lawyer.user }
    let(:equity_path) { spa_company_cap_table_path(company.external_id) }

    it_behaves_like "nav items for administrator roles"
  end

  context "when a company worker is signed in" do
    before { sign_in company_worker.user }

    it "does not show the nav link irrespective of enabled features" do
      company.update!(equity_grants_enabled: true)

      visit root_path

      expect(page).to_not have_link("Equity")
    end
  end

  context "when a company investor is signed in" do
    before { sign_in company_investor.user }

    it "show the expected nav items if no features are enabled" do
      visit root_path

      expect(page).to_not have_link("Options")
      expect(page).to have_link("Shares", href: spa_company_shares_path(company.external_id))
      expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
      expect(page).to have_link("Dividends", href: spa_company_dividends_path(company.external_id))
      click_on "Equity"
      expect(page).to have_current_path(spa_company_dividends_path(company.external_id))
    end

    it "shows the expected nav link and tabs if the equity_grants and tender_offers features are enabled" do
      company.update!(equity_grants_enabled: true, tender_offers_enabled: true)

      visit root_path

      click_on "Equity"
      expect(page).to have_current_path(spa_company_dividends_path(company.external_id))
      expect(page).to have_link("Options", href: spa_company_equity_grants_path(company.external_id))
      expect(page).to have_link("Shares", href: spa_company_shares_path(company.external_id))
      expect(page).to have_link("Convertibles", href: spa_company_convertibles_path(company.external_id))
      expect(page).to have_link("Dividends", href: spa_company_dividends_path(company.external_id))
      expect(page).to have_link("Tender offers", href: spa_company_tender_offers_path(company.external_id))
      expect(page).not_to have_link("Option pools")
    end
  end
end
