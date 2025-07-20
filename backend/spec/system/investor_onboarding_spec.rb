# frozen_string_literal: true

RSpec.describe "Onboarding for a user with investor role", :vcr do
  include WiseHelpers

  let(:company) { create(:company, :completed_onboarding) }
  let(:user) do
    user = create(:user, :pre_onboarding, country_code: "US")
    create(:company_investor, user:, company:)
    user
  end

  before { sign_in user }

  let(:legal_name) { "Isaac Mohr" }
  let(:zip_code_label) do
    user.reload.country_code == "US" ? "Zip code" : "Postal code"
  end

  def fill_in_personal_details
    expect(page).to have_current_path(spa_company_investor_onboarding_path(company.external_id))
    expect(page).to have_selector("h1", text: "Let's get to know you")
    expect(page).to have_select("Country of residence", selected: "United States")
    expect(page).to have_select("Country of citizenship", selected: "United States")
    fill_in "Full legal name", with: legal_name
    fill_in "Preferred name (visible to others)", with: legal_name.split.first
    select "Australia", from: "Country of citizenship"
  end

  it "uses the investor flow for onboarding" do
    visit root_path

    fill_in_personal_details
    click_on "Continue"

    expect(page).to have_current_path(spa_company_dividends_path(company.external_id))
    expect(page).to have_text("Equity")
  end

  context "when user is from a sanctioned country" do
    it "uses the contractor flow for onboarding and skips the bank account step" do
      visit root_path

      fill_in_personal_details
      select "Cuba", from: "Country of residence"
      click_on "Continue"
      within_modal do
        expect(page).to have_text("Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.")
        expect(page).to have_text("You can still use Flexile's features such as receiving equity, but you won't be able to set a payout method or receive any payments.")
        click_on "Proceed"
      end

      # Skips the bank account step
      expect(page).to have_current_path(spa_settings_payouts_path)
      expect(page).to have_text("Payout method")
      expect(page).to have_selector("strong", text: "Payouts are disabled")
      expect(page).to have_text("Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.")
    end
  end
end
