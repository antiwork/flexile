# frozen_string_literal: true

RSpec.describe "People header navigation" do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company:, user:) }
  let(:company_lawyer) { create(:company_lawyer, company:, user:) }

  let(:company_worker) { create(:company_worker, company:) }
  let(:company_investor) { create(:company_investor, company:, user: company_worker.user) }

  before do
    Flipper.enable(:cap_table, company)

    convertible_investment = create(:convertible_investment, company:)
    create(:convertible_security, company_investor:, convertible_investment:)
    create(:document, company:, user: company_investor.user)
    create(:share_holding, company_investor:, share_class: create(:share_class, company:))
    create(:equity_grant_exercise, :signed, company_investor:)
    create(:dividend, company:, company_investor:)
  end

  context "when signed in as a lawyer" do
    before { sign_in company_lawyer.user }

    it "shows the expected tabs" do
      visit spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "options")
      expect(page).not_to have_link("Details")
      expect(page).not_to have_link("Invoices")
      expect(page).to have_link("Options", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "options"))
      expect(page).to have_link("Shares", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "shares"))
      expect(page).to have_link("Convertibles", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "convertibles"))
      expect(page).not_to have_link("Exercises")
      expect(page).to have_link("Dividends", href: spa_company_investor_path(company.external_id, company_investor.external_id))
      expect(page).not_to have_link("Documents", href: spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "documents"))
    end
  end

  context "when signed in as a company administrator" do
    before { sign_in company_administrator.user }

    it "shows the expected tabs" do
      visit spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "options")

      expect(page).to have_link("Details", href: spa_company_worker_path(company.external_id, company_worker.external_id))
      expect(page).to have_link("Invoices", href: spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "invoices"))
      expect(page).to have_link("Options", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "options"))
      expect(page).to have_link("Shares", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "shares"))
      expect(page).to have_link("Convertibles", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "convertibles"))
      expect(page).to have_link("Exercises", href: spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "exercises"))
      expect(page).to have_link("Dividends", href: spa_company_investor_path(company.external_id, company_investor.external_id))
      expect(page).to have_link("Documents", href: spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "documents"))
      expect(page).not_to have_link("Updates", href: spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "updates"))

      company.update!(team_updates_enabled: true)
      visit spa_company_investor_path(company.external_id, company_investor.external_id, selectedTab: "options")
      expect(page).to have_link("Updates", href: spa_company_worker_path(company.external_id, company_worker.external_id, selectedTab: "updates"))
    end
  end
end
