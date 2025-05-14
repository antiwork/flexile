# frozen_string_literal: true

RSpec.describe "Root path" do
  it "redirects to the login page when unauthenticated" do
    visit root_path

    expect(page).to have_current_path(spa_login_path)
  end

  it "redirects to the invoices page when logged in as a contractor" do
    company_worker = create(:company_worker)
    sign_in company_worker.user

    visit root_path

    expect(page).to have_current_path(spa_company_invoices_path(company_worker.company.external_id))
  end

  it "redirects to the invoices page when logged in as a company admin" do
    company_administrator = create(:company_administrator)
    sign_in company_administrator.user

    visit root_path

    expect(page).to have_current_path(spa_company_invoices_path(company_administrator.company.external_id))
  end

  context "when logged in as an investor" do
    let!(:company_investor) { create(:company_investor) }

    before do
      sign_in company_investor.user
    end

    it "redirects to the dividends page" do
      visit root_path

      expect(page).to have_current_path(spa_company_dividends_path(company_investor.company.external_id))
    end
  end

  it "redirects to the settings page for a user with an unknown role", :vcr do
    sign_in create(:user)

    visit root_path

    expect(page).to have_text("Password")
    expect(page).to have_current_path(spa_settings_path())
  end
end
