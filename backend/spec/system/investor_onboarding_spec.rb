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

  def fill_in_legal_details
    expect(page).to have_current_path(spa_company_investor_onboarding_legal_path(company.external_id))
    expect(page).to have_selector("h1", text: "What's your legal entity?")
    fill_in user.reload.requires_w9? ? "Tax identification number (SSN or ITIN)" : "Foreign tax identification number", with: "123-45-6789"
    fill_in "Date of birth", with: "06/07/1980"
    fill_in "Residential address (street name, number, apartment)", with: "123 Main St"
    fill_in "City", with: "New York"
    fill_in zip_code_label, with: "10001"
  end

  it "uses the investor flow for onboarding" do
    visit root_path

    fill_in_personal_details
    click_on "Continue"

    fill_in_legal_details
    select "New York", from: "State"
    wait_for_ajax
    click_on "Continue"
    within_modal do
      click_on "Save"
    end

    click_on "Set up"
    select_wise_field "USD (United States Dollar)", from: "Currency"
    expect(page).to have_field("Full name of the account holder", with: legal_name)
    fill_in "ACH routing number", with: "026009593"
    fill_in "Account number", with: "12345678"
    within_modal do
      click_on "Continue"
    end
    select_wise_field "United States", from: "Country"
    fill_in "City", with: "San Francisco"
    fill_in "Street address, apt number", with: "59-720 Kamehameha Hwy"
    select "Hawaii", from: "State"
    fill_in "ZIP code", with: "96712"

    click_on "Save bank account"
    wait_for_ajax

    expect(page).to have_text("Account ending in 5678")

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

      fill_in_legal_details
      select "Pinar del Río", from: "State"
      click_on "Continue"
      within_modal do
        click_on "Save"
      end

      # Skips the bank account step
      expect(page).to have_current_path(spa_settings_payouts_path)
      expect(page).to have_text("Payout method")
      expect(page).to have_selector("strong", text: "Payouts are disabled")
      expect(page).to have_text("Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.")
    end
  end
end
