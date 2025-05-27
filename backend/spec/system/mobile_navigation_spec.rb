# frozen_string_literal: true

RSpec.describe "Mobile navigation" do
  let(:company) { create(:company) }
  let(:administrator) { create(:company_administrator, company:).user }
  let!(:contractor) { create(:company_worker, company:).user }

  before do
    @default_size = page.driver.browser.manage.window.size
    page.driver.browser.manage.window.resize_to(640, 800)
  end

  after do
    page.driver.browser.manage.window.resize_to(@default_size.width, @default_size.height)
  end

  context "when user is a contractor" do
    before do
      sign_in contractor
    end

    it "allows navigating through pages via the mobile nav menu", :vcr do
      visit root_path

      expect(page).to have_selector("h1", text: "Invoicing")

      click_on "Toggle Main Menu"

      expect(page).to have_link("Invoices")
      expect(page).to have_link("Documents")
      expect(page).to have_link("Account")

      click_on "Account"
      expect(page).to have_selector("h1", text: "Profile")
      expect(page).to_not have_link("Invoices")
      expect(page).to_not have_link("Documents")
      expect(page).to_not have_link("Account")

      click_on "Toggle Main Menu"
      click_on "Documents"
      expect(page).to have_selector("h1", text: "Documents")
      expect(page).to_not have_link("Invoices")
      expect(page).to_not have_link("Documents")
      expect(page).to_not have_link("Account")
    end
  end

  context "when user is a company administrator" do
    before do
      sign_in administrator
    end

    it "allows navigating through pages via the mobile nav menu" do
      visit spa_company_workers_path(company.external_id)

      expect(page).to have_selector("h1", text: "People")

      click_on "Toggle Main Menu"

      expect(page).to have_link("Invoices")
      expect(page).to have_link("People")
      expect(page).to have_link("Analytics")

      click_on "Invoices"
      expect(page).to have_selector("h1", text: "Invoicing")
      expect(page).to_not have_link("Invoices")
      expect(page).to_not have_link("People")
      expect(page).to_not have_link("Analytics")

      click_on "Toggle Main Menu"
      click_on "Analytics"
      expect(page).to have_selector("h1", text: "Analytics")
      expect(page).to_not have_link("Invoices")
      expect(page).to_not have_link("People")
      expect(page).to_not have_link("Analytics")

      click_on "Toggle Main Menu"
      click_on "People"
      expect(page).to have_selector("h1", text: "People")
    end
  end
end
