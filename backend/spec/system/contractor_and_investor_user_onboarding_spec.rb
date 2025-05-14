# frozen_string_literal: true

RSpec.describe "Onboarding for a user with contractor and investor roles", :vcr do
  include WiseHelpers

  let(:company) { create(:company, :completed_onboarding) }
  let(:user) do
    company_administrator = create(:company_administrator, company:)
    user = create(:user, :pre_onboarding, country_code: "US", invited_by_id: company_administrator.user_id)
    create(:company_worker, user:, company:, without_contract: true)
    create(:company_investor, user:, company:)
    user
  end

  before { sign_in user }

  it "uses the contractor flow for onboarding" do
    # Personal details
    visit root_path
    expect(page).to have_current_path(spa_company_worker_onboarding_path(company.external_id))
    expect(page).to have_select("Country of residence", selected: "United States")
    expect(page).to have_select("Country of citizenship", selected: "United States")
    expect(page).to have_text("Let's get to know you")
    fill_in "Full legal name", with: "John Doe"
    fill_in "Preferred name (visible to others)", with: "John"
    select "United Kingdom", from: "Country of residence"
    select "Australia", from: "Country of citizenship"
    click_on "Continue"

    # Legal info
    expect(page).to have_current_path(spa_company_worker_onboarding_legal_path(company.external_id))
    expect(page).to have_text("How will you be billing?")
    choose "I'm a business"
    fill_in "Full legal name of entity", with: "Business Name"
    fill_in "Foreign tax identification number", with: "123-45-6789"
    fill_in "Date of birth", with: "06/07/1980"
    expect(page).to have_text("How will you be billing?")
    fill_in "Residential address (street name, number, apartment)", with: "123 Main St"
    fill_in "City", with: "London"
    select "London", from: "State"
    fill_in "Postal code", with: "E1 8RU"
    wait_for_ajax
    click_on "Continue"
    within_modal do
      click_on "Save"
    end

    # Bank account
    expect(page).to have_current_path(spa_company_worker_onboarding_bank_account_path(company.external_id))
    expect(page).to have_text("Get Paid Fast")
    user.reload
    click_on "Set up"
    select_wise_field "USD (United States Dollar)", from: "Currency"
    check "My bank account is in the US"
    fill_in "Name of the business / organisation", with: "John Doe"
    fill_in "ACH routing number", with: "026009593"
    fill_in "Account number", with: "12345678"
    within_modal do
      click_on "Continue"
    end
    select "United States", from: "Country"
    fill_in "City", with: "Haleiwa"
    fill_in "Street address, apt number", with: "59-720 Kamehameha Hwy"
    expect(page).to have_field("State", exact: true)
    select "Hawaii", from: "State"
    fill_in "ZIP code", with: "96712"
    click_on "Save bank account"
    expect(page).to have_text("Account ending in 5678")
    click_on "Continue"

    # Contract signing
    expect(page).to have_current_path(spa_company_worker_onboarding_contract_path(company.external_id))
    expect(page).to have_text("Consulting agreement")
    expect(page).to have_selector("h1", text: "CONSULTING AGREEMENT")
    expect(page).to have_selector("span", text: "United States")
    expect(page).to have_selector("span", text: "United Kingdom")
    expect(page).to have_text("invention assignment agreements from Contractor's employees")
    expect(page).to_not have_text("comply with current applicable legislation in Spain")
    expect(find_button("Click to add signature", disabled: true)).to have_tooltip "Have you read everything yet?"
    click_on "Discovery Procedures (Exhibit B)"
    click_on "Click to add signature"
    contract = user.company_workers.first!.documents.first!
    expect do
      click_on "Sign and submit"
      expect(page).to have_selector("h1", text: "Invoicing")
      expect(page).to have_link("Invoices")
      expect(page).to have_link("Documents")
      expect(page).to have_link("Account")
    end.to change { contract.reload.completed_at.present? }.from(false).to(true)
       .and change { contract.contractor_signature }.from(nil).to(user.legal_name)
       .and change { contract.attachment.present? }.from(false).to(true)

    expect(page).to have_current_path(spa_company_invoices_path(company.external_id))
    expect(page).to have_text("Invoicing")
  end

  context "when user is from a sanctioned country" do
    before { user.update!(country_code: "CU", citizenship_country_code: "CU") }

    it "uses the contractor flow for onboarding and skips the bank account step" do
      # Personal details
      visit root_path
      expect(page).to have_current_path(spa_company_worker_onboarding_path(company.external_id))
      expect(page).to have_select("Country of residence", selected: "Cuba")
      expect(page).to have_select("Country of citizenship", selected: "Cuba")
      expect(page).to have_text("Let's get to know you")
      fill_in "Full legal name", with: "Marco Antônio"
      fill_in "Preferred name (visible to others)", with: "Marco"
      click_on "Continue"

      within_modal do
        expect(page).to have_text("Unfortunately, due to regulatory restrictions and compliance with international sanctions, individuals from sanctioned countries are unable to receive payments through our platform.")
        expect(page).to have_text("You can still use Flexile's features such as sending invoices and receiving equity, but you won't be able to set a payout method or receive any payments.")
        click_on "Proceed"
      end

      # Legal info
      expect(page).to have_current_path(spa_company_worker_onboarding_legal_path(company.external_id))
      expect(page).to have_text("How will you be billing?")
      choose "I'm a business"
      fill_in "Full legal name of entity", with: "Business Name"
      fill_in "Foreign tax identification number", with: "555-66-6789"
      fill_in "Date of birth", with: "06/07/1980"
      expect(page).to have_text("How will you be billing?")
      fill_in "Residential address (street name, number, apartment)", with: "123 Main St"
      fill_in "City", with: "Pinar del Río"
      expect(page).to have_field("State", exact: true)
      select "Pinar del Río", from: "State"
      fill_in "Postal code", with: "20100"
      click_on "Continue"
      within_modal do
        click_on "Save"
      end
      # Skips bank account info
      # Contract signing
      expect(page).to have_text("Consulting agreement")
      expect(page).to have_current_path(spa_company_worker_onboarding_contract_path(company.external_id))
      expect(find_button("Click to add signature", disabled: true)).to have_tooltip "Have you read everything yet?"
      click_on "Discovery Procedures (Exhibit B)"
      click_on "Click to add signature"
      contract = user.company_workers.first!.documents.first!
      expect do
        click_on "Sign and submit"
        expect(page).to have_selector("h1", text: "Invoicing")
        expect(page).to have_link("Invoices")
        expect(page).to have_link("Documents")
        expect(page).to have_link("Account")
      end.to change { contract.reload.completed_at.present? }.from(false).to(true)
         .and change { contract.contractor_signature }.from(nil).to("Marco Antônio")
         .and change { contract.attachment.present? }.from(false).to(true)

      expect(page).to have_text("Invoicing")
      expect(page).to have_current_path(spa_company_invoices_path(company.external_id))
    end
  end

  context "when user is from a restricted payout country" do
    before do
      user.update!(country_code: "BR", citizenship_country_code: "BR")
    end

    it "uses the contractor flow for onboarding" do
      # Personal details
      visit root_path
      expect(page).to have_current_path(spa_company_worker_onboarding_path(company.external_id))
      expect(page).to have_select("Country of residence", selected: "Brazil")
      expect(page).to have_select("Country of citizenship", selected: "Brazil")
      expect(page).to have_text("Let's get to know you")
      fill_in "Full legal name", with: "Marco Antônio"
      fill_in "Preferred name (visible to others)", with: "Marco"
      click_on "Continue"

      # Legal info
      expect(page).to have_current_path(spa_company_worker_onboarding_legal_path(company.external_id))
      expect(page).to have_text("How will you be billing?")
      choose "I'm a business"
      fill_in "Full legal name of entity", with: "Business Name"
      fill_in "Foreign tax identification number", with: "555-66-6789"
      fill_in "Date of birth", with: "06/07/1980"
      expect(page).to have_text("How will you be billing?")
      fill_in "Residential address (street name, number, apartment)", with: "123 Main St"
      fill_in "City", with: "São Paulo"
      expect(page).to have_field("State", exact: true)
      select "São Paulo", from: "State"
      fill_in "Postal code", with: "01000-000"
      click_on "Continue"
      within_modal do
        click_on "Save"
      end

      # Bank account
      expect(page).to have_text("Get Paid Fast")
      expect(page).to have_current_path(spa_company_worker_onboarding_bank_account_path(company.external_id))
      user.reload
      click_on "Set up"
      check "My bank account is in the US"
      select_wise_field "USD (United States Dollar)", from: "Currency"
      fill_in "ACH routing number", with: "026009593"
      fill_in "Account number", with: "12345678"
      within_modal do
        click_on "Continue"
      end
      select "United States", from: "Country"
      fill_in "City", with: "Haleiwa"
      fill_in "Street address, apt number", with: "59-720 Kamehameha Hwy"
      expect(page).to have_field("State", exact: true)
      select "Hawaii", from: "State"
      fill_in "ZIP code", with: "96712"
      click_on "Save bank account"
      expect(page).to have_text("Account ending in 5678")
      click_on "Continue"

      # Contract signing
      expect(page).to have_text("Consulting agreement")
      expect(page).to have_current_path(spa_company_worker_onboarding_contract_path(company.external_id))
      expect(find_button("Click to add signature", disabled: true)).to have_tooltip "Have you read everything yet?"
      click_on "Discovery Procedures (Exhibit B)"
      click_on "Click to add signature"
      contract = user.company_workers.first!.documents.first!
      expect do
        click_on "Sign and submit"
        expect(page).to have_selector("h1", text: "Invoicing")
        expect(page).to have_link("Invoices")
        expect(page).to have_link("Documents")
        expect(page).to have_link("Account")
      end.to change { contract.reload.completed_at.present? }.from(false).to(true)
        .and change { contract.contractor_signature }.from(nil).to("Marco Antônio")
        .and change { contract.attachment.present? }.from(false).to(true)

      expect(page).to have_text("Invoicing")
      expect(page).to have_current_path(spa_company_invoices_path(company.external_id))
    end
  end
end
