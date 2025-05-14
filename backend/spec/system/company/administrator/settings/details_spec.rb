# frozen_string_literal: true

RSpec.describe "Company Details" do
  let(:company) { create(:company, tax_id: "45-6789000", phone_number: "(555) 555-5555") }
  let(:admin_user) { create(:company_administrator, company:).user }

  before { sign_in admin_user }

  it "displays and allows editing company details" do
    visit spa_company_administrator_settings_details_path(company.external_id)

    expect(page).to have_selector("h2", text: "Details")
    expect(page).to have_field("Company's legal name", with: company.name)
    expect(page).to have_field("EIN", with: "45-6789000")
    expect(page).to have_field("Phone number", with: "(555) 555-5555")
    expect(page).to have_field("Residential address (street name, number, apt)", with: company.street_address)
    expect(page).to have_field("City or town", with: company.city)
    expect(page).to have_field("State", with: company.state)
    expect(page).to have_field("Postal code", with: company.zip_code)
    expect(page).to have_select("Country", selected: company.display_country, disabled: true)
    expect(page).to have_text("Flexile is currently available only to companies incorporated in the United States.")

    fill_in("Company's legal name", with: "")
    fill_in("Residential address (street name, number, apt)", with: "")
    fill_in("City or town", with: "")
    fill_in("Postal code", with: "")
    fill_in("Phone number", with: "")
    fill_in("EIN", with: "12-3")
    click_on "Save changes"
    expect(page).to have_selector("input:invalid")

    fill_in("Company's legal name", with: "New name", valid: false)
    expect(page).to have_field("Company's legal name", valid: true)

    fill_in("Residential address (street name, number, apt)", with: "100 Elm St", valid: false)
    expect(page).to have_field("Residential address (street name, number, apt)", valid: true)

    fill_in("City or town", with: "Cambridge", valid: false)
    expect(page).to have_field("City or town", valid: true)

    select("Massachusetts", from: "State")

    fill_in("Postal code", with: "12345", valid: false)
    expect(page).to have_field("Postal code", valid: true)

    fill_in("EIN", with: "111111111", valid: false)
    fill_in("Phone number", with: "12345", valid: false)
    click_on "Save changes"
    expect(page).to have_selector("input:invalid")

    expect(page).to have_text("Your EIN can't have all identical digits.")
    expect(page).to have_text("Please enter a valid U.S. phone number.")

    fill_in("Phone number", with: "2234567890", valid: false)
    expect(page).to have_field("Phone number", valid: true, with: "(223) 456-7890")
    fill_in("EIN", with: "123456789", valid: false)
    expect(page).to have_field("EIN", valid: true, with: "12-3456789")

    click_on "Save changes"
    wait_for_ajax
    expect(page).not_to have_selector("input:invalid")
    company.reload
    expect(company.name).to eq "New name"
    expect(company.street_address).to eq "100 Elm St"
    expect(company.city).to eq "Cambridge"
    expect(company.state).to eq "MA"
    expect(company.zip_code).to eq "12345"
    expect(company.tax_id).to eq "123456789"
    expect(company.phone_number).to eq "2234567890"
  end
end
