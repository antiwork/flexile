# frozen_string_literal: true

MINOR_VERSION = 75

require "shared_examples/internal/stripe_microdeposit_verification_examples"

RSpec.describe "Company Settings" do
  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }

  it "allows updating the public company profile" do
    sign_in admin_user
    visit spa_company_administrator_settings_path(company.external_id)
    within_section "Customization", section_element: :form do
      expect(page).to have_field "Company name", with: company.name
      expect(page).to have_field "Company website", with: company.website
      expect(find_rich_text_editor("Company description")).to have_text company.description
      expect(page).to have_unchecked_field "Show Team by the numbers in job descriptions"
      expect(page).to have_field "Brand color", with: company.brand_color

      fill_in "Company name", with: "Public name!"
      fill_in "Company website", with: "not a website."
      fill_in_rich_text_editor "Company description", with: "Hi! I'm the *description*!"
      check "Show Team by the numbers in job descriptions"
      find_field("Brand color").set("#123456")
      attach_file "Upload...", file_fixture("image.png"), visible: false
      click_on "Save changes"

      expect(page).to have_field("Company website", valid: false)
      fill_in "Company website", with: "https://www.gumroad.com"
      expect(page).to have_field("Company website", valid: true)
      click_on "Save changes"
    end

    wait_for_ajax
    expect(company.reload.public_name).to eq "Public name!"
    expect(company.website).to eq "https://www.gumroad.com"
    expect(company.description).to eq "<p>Hi! I'm the <em>description</em>!</p>"
    expect(company.show_stats_in_job_descriptions).to eq true
    expect(company.brand_color).to eq "#123456"
    expect(company.logo_url).to end_with "image.png"
  end
end
