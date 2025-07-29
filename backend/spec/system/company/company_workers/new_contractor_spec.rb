# frozen_string_literal: true

RSpec.describe "New Contractor" do
  let(:company) do
    create(:company, name: "Gumroad", street_address: "548 Market Street", city: "San Francisco",
                     state: "CA", zip_code: "94104-5401", country_code: "US")
  end
  let(:user) { create(:user, legal_name: "Sahil Lavingia", email: "sahil@gumroad.com") }
  let(:email) { "flexy-bob@flexile.com" }
  let(:trialer_email) { "trial-bob@flexile.com" }
  let!(:role) { create(:company_role, company:) }
  let!(:project_based_role) { create(:project_based_company_role, company:) }
  let!(:other_roles) { create_list(:company_role, 2, company:) }

  before do
    create(:company_administrator, company:, user:)
    sign_in user
    visit root_path
    click_on "People"
    click_on "Add contractor"
    expect(page).to have_text("Who's joining?")
  end

  def fill_in_form(project_based: false)
    fill_in "Email", with: email
    fill_in "Start date", with: "08/08/2025"
    select (project_based ? project_based_role.name : role.name), from: "Role"
    fill_in "Average hours", with: "25" unless project_based
    select "Australia", from: "Country of residence"
  end

  it "allows inviting a contractor" do
    fill_in_form
    fill_in "Rate", with: "99"

    expect(page).to have_selector("h2", text: "Effective Date: #{Date.new(2025, 8, 8).strftime("%b %-d, %Y")}")
    expect(page).to have_selector("h2", text: "Gumroad")
    expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
    expect(page).to have_selector("li", text: "$99 per hour")
    section = find(:section, Document::CONSULTING_CONTRACT_NAME, section_element: :section, heading_level: 1)
    expect(section).to have_text("Client: Signature ‌ Name Gumroad Title Chief Executive Officer Email sahil@gumroad.com Country United States Address 548 Market Street San Francisco, CA 94104-5401 Contractor: Signature ‌ Name ‌ Legal entity ‌ Country Australia", normalize_ws: true)

    click_on "Add your signature"
    expect(section).to have_text("Client: Signature Sahil Lavingia", normalize_ws: true)

    click_on "Send invite"
    wait_for_ajax

    expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, false)

    expect(page).to have_selector(
      :table_row,
      {
        "Contractor" => email,
        "Country" => "Australia",
        "Start Date" => "Aug 8, 2025",
        "Average hours" => "25",
        "Rate" => "$99",
        "Status" => "Invited",
      }
    )

    contractor = CompanyWorker.last
    expect(contractor).to have_attributes({ company_role: role, pay_rate_usd: 99 })
  end

  it "allows inviting a project-based contractor" do
    fill_in_form(project_based: true)

    expect(page).to have_selector("h2", text: "Gumroad")
    expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
    expect(page).to have_selector("li", text: "$1,000 per project")
    section = find(:section, Document::CONSULTING_CONTRACT_NAME, section_element: :section, heading_level: 1)
    expect(section).to have_text("Client: Signature ‌ Name Gumroad Title Chief Executive Officer Email sahil@gumroad.com Country United States Address 548 Market Street San Francisco, CA 94104-5401 Contractor: Signature ‌ Name ‌ Legal entity ‌ Country Australia", normalize_ws: true)

    click_on "Add your signature"
    expect(section).to have_text("Client: Signature Sahil Lavingia", normalize_ws: true)

    click_on "Send invite"
    wait_for_ajax

    expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, false)

    expect(page).to have_selector(
      :table_row,
      {
        "Contractor" => email,
        "Country" => "Australia",
        "Start Date" => "Aug 8, 2025",
        "Average hours" => "N/A",
        "Rate" => "$1,000",
        "Status" => "Invited",
      }
    )

    contractor = CompanyWorker.last
    expect(contractor).to have_attributes({ company_role: project_based_role, pay_rate_usd: 1000, pay_rate_type: "project_based" })
  end

  it "allows reactivating an alumni contractor" do
    old_country_code = "UY"
    existing_user = create(:user, email:, country_code: old_country_code)
    contractor = create(:company_worker, company:, user: existing_user, ended_at: 3.months.ago,
                                         pay_rate_usd: 50, company_role: create(:company_role, company:))

    expect(page).to have_field("Start date", with: Date.current.strftime("%F"))

    fill_in_form

    expect(page).to have_selector("h2", text: "Gumroad")
    expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
    expect(page).to have_selector("li", text: "$#{role.pay_rate_usd} per hour")
    section = find(:section, Document::CONSULTING_CONTRACT_NAME, section_element: :section, heading_level: 1)
    expect(section).to have_text("Client: Signature ‌ Name Gumroad Title Chief Executive Officer Email sahil@gumroad.com Country United States Address 548 Market Street San Francisco, CA 94104-5401 Contractor: Signature ‌ Name ‌ Legal entity ‌ Country Australia", normalize_ws: true)

    click_on "Add your signature"
    expect(section).to have_text("Client: Signature Sahil Lavingia", normalize_ws: true)

    expect do
      click_on "Send invite"
      wait_for_ajax
    end.to change { CompanyWorker.count }.by(0)
       .and change { contractor.contracts.count }.by(0)

    expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(contractor.id, true)

    expect(page).to have_selector(
      :table_row,
      {
        "Contractor" => existing_user.name,
        "Country" => ISO3166::Country[old_country_code].common_name, # unchanged
        "Start Date" => "Aug 8, 2025",
        "Average hours" => "25",
        "Rate" => "$#{role.pay_rate_usd}",
        "Status" => "In Progress",
      }
    )

    expect(contractor.reload).to have_attributes({ company_role: role, pay_rate_usd: role.pay_rate_usd, ended_at: nil })
  end

  it "requires another signature when contractor details were changed after the contract was signed" do
    expect(page).to have_field("Start date", with: Date.current.strftime("%F"))

    fill_in_form

    expect(page).to have_selector("h2", text: "Gumroad")
    expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
    expect(page).to have_selector("li", text: "$#{role.pay_rate_usd} per hour")
    section = find(:section, Document::CONSULTING_CONTRACT_NAME, section_element: :section, heading_level: 1)
    expect(section).to have_text("Client: Signature ‌ Name Gumroad Title Chief Executive Officer Email sahil@gumroad.com Country United States Address 548 Market Street San Francisco, CA 94104-5401 Contractor: Signature ‌ Name ‌ Legal entity ‌ Country Australia", normalize_ws: true)

    click_on "Add your signature"
    expect(section).to have_text("Client: Signature Sahil Lavingia", normalize_ws: true)
    expect(page).to have_button("Send invite", disabled: false)

    fill_in "Average hours", with: "35"
    expect(page).to have_button("Send invite", disabled: true)

    click_on "Add your signature"
    expect(section).to have_text("Client: Signature Sahil Lavingia", normalize_ws: true)

    click_on "Send invite"
    wait_for_ajax

    expect(GenerateContractorInvitationJob).to have_enqueued_sidekiq_job(CompanyWorker.last.id, false)

    expect(page).to have_selector(
      :table_row,
      {
        "Contractor" => email,
        "Country" => "Australia",
        "Start Date" => "Aug 8, 2025",
        "Average hours" => "35",
        "Rate" => "$#{role.pay_rate_usd}",
        "Status" => "Invited",
      }
    )
  end

  context "when equity compensation is disabled" do
    before do
      company.update!(equity_enabled: false)
      refresh # Ensure the page is reloaded with the feature flag disabled
    end

    it "excludes the paragraphs regarding equity" do
      expect(page).to have_field("Start date", with: Date.current.strftime("%F"))

      fill_in_form
      select "United States", from: "Country of residence"

      expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
      expect(page).to_not have_selector("h1", text: "CONSULTANT EQUITY ELECTION FORM")
      expect(page).to have_selector("h1", text: "ASSIGNMENT OF COPYRIGHT")
      expect(page).to have_selector("span", text: "United States", count: 4)
      expect(page).to_not have_text("Cash and Equity Combination")
      expect(page).to have_text("Noninterference with Business")
      expect(page).to have_text("Fee: $#{role.pay_rate_usd}")
      expect(page).to have_text("Target Annual Hours: 1,100")
      expect(page).to_not have_text("by an amount equal to the value per share of the Company's common stock")
    end
  end

  context "when equity compensation is enabled" do
    before do
      company.update!(equity_enabled: true)
      refresh # Ensure the page is reloaded with the new feature flag
    end

    it "renders the the contract content with equity compensation" do
      expect(page).to have_field("Start date", with: Date.current.strftime("%F"))

      fill_in_form
      select "United States", from: "Country of residence"

      expect(page).to have_selector("h1", text: Document::CONSULTING_CONTRACT_NAME)
      expect(page).to have_selector("h1", text: "CONSULTANT EQUITY ELECTION FORM")
      expect(page).to have_selector("h1", text: "ASSIGNMENT OF COPYRIGHT")
      expect(page).to have_selector("span", text: "United States", count: 6)
      expect(page).to have_text("Cash and Equity Combination")
      expect(page).to have_text("Noninterference with Business")
      expect(page).to have_text("Fee: $#{role.pay_rate_usd}")
      expect(page).to have_text("Target Annual Hours: 1,100")
      expect(page).to have_text("by an amount equal to the value per share of the Company's common stock")
    end
  end

  it "pre-fills the form with the last-used hourly contractor values" do
    create(:company_worker, company:, company_role: role, pay_rate_usd: 300)

    visit new_spa_company_worker_path(company.external_id)

    expect(page).to have_select("Role", selected: role.name)
    expect(page).to have_field("Rate", with: 300)
    expect(page).to have_field("Average hours", with: 10)
  end

  it "pre-fills the form with the last-used project-based contractor values" do
    create(:company_worker, :project_based, company:, company_role: project_based_role)

    visit new_spa_company_worker_path(company.external_id)

    expect(page).to have_select("Role", selected: project_based_role.name)
    expect(page).to have_field("Rate", with: 1_000)
    expect(page).to have_no_field("Average hours")
  end

  it "allows creating a new hourly role ad-hoc" do
    visit new_spa_company_worker_path(company.external_id)

    fill_in_form
    click_on "Create new"
    within_modal "New role" do
      fill_in "Name", with: "Role!"
      expect(page).to have_checked_field "Hourly"
      fill_in "Rate", with: "200"
      click_on "Create"
    end
    wait_for_ajax
    expect(page).to have_select "Role", selected: "Role!"
    expect(page).to have_field "Rate", with: 200
    click_on "Add your signature"
    click_on "Send invite"
    wait_for_ajax
    role = CompanyRole.last
    expect(role.name).to eq "Role!"
    expect(role.actively_hiring).to eq false
    rate = role.rate
    expect(rate.pay_rate_usd).to eq 200
    expect(rate.pay_rate_type).to eq "hourly"
    contractor = CompanyWorker.last
    expect(contractor.company_role).to eq role
    expect(contractor.pay_rate_usd).to eq rate.pay_rate_usd
    expect(contractor.pay_rate_type).to eq rate.pay_rate_type
  end

  it "allows creating a new project-based role ad-hoc" do
    visit new_spa_company_worker_path(company.external_id)

    fill_in_form
    click_on "Create new"
    within_modal "New role" do
      fill_in "Name", with: "Role!"
      expect(page).to have_checked_field "Hourly"
      choose "Project-based"
      fill_in "Rate", with: "1000"
      click_on "Create"
    end
    wait_for_ajax
    expect(page).to have_select "Role", selected: "Role!"
    expect(page).to have_field "Rate", with: 1000
    click_on "Add your signature"
    click_on "Send invite"
    wait_for_ajax
    role = CompanyRole.last
    expect(role.name).to eq "Role!"
    expect(role.actively_hiring).to eq false
    rate = role.rate
    expect(rate.pay_rate_usd).to eq 1000
    expect(rate.pay_rate_type).to eq "project_based"
    contractor = CompanyWorker.last
    expect(contractor.company_role).to eq role
    expect(contractor.pay_rate_usd).to eq rate.pay_rate_usd
    expect(contractor.pay_rate_type).to eq rate.pay_rate_type
  end
end
