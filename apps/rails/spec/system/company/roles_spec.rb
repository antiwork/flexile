# frozen_string_literal: true

RSpec.describe "Company roles" do
  let!(:company) { create(:company) }
  let!(:company_role) { create(:company_role, company:, actively_hiring: true) }
  let(:company_administrator) { create(:company_administrator, company:) }

  before do
    login_as company_administrator.user
  end

  it "allows company admins to manage roles" do
    company.update!(name: "The company")
    company_role.update!(name: "The role")
    visit spa_company_roles_path(company.external_id)

    click_on "Copy public link"
    expect(clipboard_text).to eq spa_roles_url(company.display_name.parameterize, company.external_id)

    expect(find("tbody")).to have_selector(:table_row, {}, count: 1)
    row = find(:table_row, { "Role" => company_role.name, "Rate" => "$#{company_role.pay_rate_usd} / hr", "Candidates" => 2 })
    click_on "Copy link"
    role_url = Rails.application.routes.url_helpers.spa_role_url(company.display_name.parameterize, company_role.name.parameterize, company_role.external_id)
    expect(clipboard_text).to eq role_url

    click_on "New role"

    fill_in "Rate", with: ""
    click_on "Create"
    expect(page).to have_field("Name", valid: false)
    expect(page).to have_field("Rate", valid: false)

    fill_in "Name", with: "Role!"
    expect(page).to have_field("Name", valid: true)
    fill_in "Rate", with: "200"
    expect(page).to have_field("Rate", valid: true)
    expect(page).to have_checked_field "Hourly"
    expect(page).to_not have_field "Accepting candidates"
    expect(page).to_not have_text "Job description"
    expect(page).to_not have_field "Update rate for all contractors with this role"
    click_on "Create"
    expect(page).to have_selector(:table_row, { "Role" => "Role!", "Rate" => "$200", "Candidates" => 0, "Status" => "Not hiring" })
    role = CompanyRole.last
    expect(role.name).to eq "Role!"
    rate = role.rate
    expect(rate.pay_rate_usd).to eq 200
    expect(rate.pay_rate_type).to eq "hourly"
    within(row) do
      click_on "Edit"
    end
    expect(page).to have_field "Name", with: company_role.name
    expect(page).to have_field "Rate", with: company_role.pay_rate_usd
    expect(page).to have_checked_field "Hourly", disabled: true
    expect(find_rich_text_editor("Job description")).to have_text company_role.job_description
    expect(page).to have_checked_field "Accepting candidates"
    expect(page).to_not have_field "Role should get expense card"
    expect(page).to_not have_field "Capitalized R&D expense"
    expect(page).to_not have_field "Expense account"
  end

  it "allows deleting roles only if they have no active contractors" do
    company_worker = create(:company_worker, company_role:)

    visit spa_company_roles_path(company.external_id)
    click_on "Edit"
    expect(find_button("Delete role", disabled: true)).to have_tooltip "You can't delete roles with active contractors"

    company_worker.update!(ended_at: Date.yesterday)
    visit spa_company_roles_path(company.external_id)

    click_on "Edit"
    click_on "Delete role"
    expect(page).to have_text "Permanently delete role?"
    click_on "Yes, delete"
    expect(page).to have_text "Create a role to publish job listings and hire contractors"
    expect(CompanyRole.alive.count).to eq 0
  end

  it "allow enabling trials for roles" do
    expect(company_role.trial_enabled).to eq false

    visit spa_company_roles_path(company.external_id)
    click_on "Edit"
    check "Start with trial period"
    fill_in "Rate during trial period", with: 50
    click_on "Save changes"
    wait_for_ajax
    expect(company_role.reload.trial_enabled).to eq true
    expect(company_role.trial_pay_rate_usd).to eq 50
  end

  it "pre-fills the role creation form with the last-used role values and updates trial rate with pay rate" do
    visit spa_company_roles_path(company.external_id)

    click_on "New role"
    fill_in "Name", with: "Role"
    expect(page).to have_field("Rate", with: company_role.pay_rate_usd)
    click_on "Create"

    wait_for_ajax
    expect(CompanyRole.last).to have_attributes({
      name: "Role",
      pay_rate_usd: company_role.pay_rate_usd,
      trial_pay_rate_usd: company_role.trial_pay_rate_usd,
      capitalized_expense: company_role.capitalized_expense,
    })

    click_on "New role"
    fill_in "Name", with: "Role 2"
    fill_in "Rate", with: 150
    expect do
      click_on "Create"
      wait_for_ajax
    end.to change { company.company_roles.count }.by(1)

    expect(CompanyRole.last).to have_attributes({
      name: "Role 2",
      pay_rate_usd: 150,
      trial_pay_rate_usd: 75,
      capitalized_expense: company_role.capitalized_expense,
    })
  end

  it "updates rates for associated contractors, prompting confirmation for those with diverging rates" do
    company_workers = create_list(:company_worker, 2, company:, company_role:, pay_rate_usd: company_role.pay_rate_usd)
    higher_company_worker = create(:company_worker, company:, company_role:, pay_rate_usd: 300)
    lower_company_worker = create(:company_worker, company:, company_role:, pay_rate_usd: 50)
    create(:company_worker, company:, company_role:, pay_rate_usd: 50, ended_at: Date.yesterday)

    visit spa_company_roles_path(company.external_id)
    click_on "Edit"

    within_modal do
      fill_in "Rate", with: 100
      expect(page).to_not have_checked_field "Update rate for all contractors with this role"
      check "Update rate for all contractors with this role"
      click_on "Save changes"
      wait_for_ajax
    end

    expect(page).to have_selector(:table_row, { "Role" => company_role.name, "Rate" => "$100" })
    expect(company_workers.all? { _1.reload.pay_rate_usd == 100 }).to eq true
    expect(higher_company_worker.attributes).to eq higher_company_worker.reload.attributes
    expect(lower_company_worker.attributes).to eq lower_company_worker.reload.attributes

    click_on "Edit"
    click_on "Save changes"
    within_modal "Update rates for 2 contractors to match role rate?" do
      expect(page).to have_text("#{higher_company_worker.user.display_name} $300 $100 ( -66.67% )", normalize_ws: true)
      expect(page).to have_text("#{lower_company_worker.user.display_name} $50 $100 ( 100% )", normalize_ws: true)
      click_on "Yes, change"
      wait_for_ajax
    end

    expect(higher_company_worker.reload.pay_rate_usd).to eq 100
    expect(lower_company_worker.reload.pay_rate_usd).to eq 100
  end

  it "allows updating the rate for all contractors when editing a role" do
    contractors = create_list(:company_worker, 2, company:, company_role:, pay_rate_usd: company_role.pay_rate_usd)

    visit spa_company_roles_path(company.external_id)
    click_on "Edit"

    within_modal do
      expect(page).to_not have_checked_field "Update rate for all contractors with this role"
      fill_in "Rate", with: 250
      expect(page).to_not have_checked_field "Update rate for all contractors with this role"
      click_on "Save changes"
      wait_for_ajax
    end

    within_modal "Update rates for 2 contractors to match role rate?" do
      percentage = (100.0 * (250 - company_role.pay_rate_usd) / company_role.pay_rate_usd).round(2)
      contractors.each do |contractor|
        expect(page).to have_text("#{contractor.user.display_name} $#{company_role.pay_rate_usd} $250 ( #{percentage}% )", normalize_ws: true)
      end
      click_on "Yes, change"
      wait_for_ajax
    end

    expect(page).to have_selector(:table_row, { "Role" => company_role.name, "Rate" => "$250" })
    expect(contractors.all? { _1.reload.pay_rate_usd == 250 }).to eq true
  end

  it "generates a custom role URL with slugs" do
    company.update!(public_name: "Weird / cömpany")
    company_role.update!(name: "very-weird | role")
    visit spa_company_roles_path(company.external_id)

    click_on "Copy link"
    role_url = Rails.application.routes.url_helpers.spa_role_url(company.display_name.parameterize, company_role.name.parameterize, company_role.external_id)
    expect(clipboard_text).to eq role_url
  end

  it "shows the QBO fields when the company has an active integration" do
    Flipper.enable(:quickbooks, company)
    create(:quickbooks_integration, company:)
    allow_any_instance_of(IntegrationApi::Quickbooks).to receive(:get_expense_accounts).and_return([{ id: "1", name: "Account 1" }, { id: "2", name: "Account 2" }])
    visit spa_company_roles_path(company.external_id)
    click_on "New role"
    fill_in "Name", with: "Role!"
    fill_in "Rate", with: "200"
    fill_in "Capitalized R&D expense", with: 40
    expect(page).to have_select("Expense account", options: ["Default", "Account 1", "Account 2"], selected: "Default")
    select "Account 1", from: "Expense account"
    click_on "Create"
    wait_for_ajax
    expect(CompanyRole.last).to have_attributes({ name: "Role!", capitalized_expense: 40, expense_account_id: "1" })

    within(:table_row, { "Role" => "Role!" }) do
      click_on "Edit"
    end
    expect(page).to have_field "Capitalized R&D expense", with: 40
    expect(page).to have_select("Expense account", selected: "Account 1")
  end

  it "allows company admins to manage project-based roles" do
    company_role = create(:project_based_company_role, company:)

    visit spa_company_roles_path(company.external_id)

    click_on "New role"

    within_modal do
      expect(page).to have_checked_field "Hourly"
      expect(page).to have_text "/ hour"
      fill_in "Rate", with: ""
      click_on "Create"
      expect(page).to have_field("Name", valid: false)
      expect(page).to have_field("Rate", valid: false)

      fill_in "Name", with: "Role!"
      expect(page).to have_field("Name", valid: true)
      fill_in "Rate", with: "200"
      expect(page).to have_field("Rate", valid: true)
      choose "Project-based"

      expect(page).to_not have_text "/ hour"
      expect(page).to_not have_field "Accepting candidates"
      expect(page).to_not have_text "Job description"
      expect(page).to_not have_field "Update rate for all contractors with this role"

      click_on "Create"
      wait_for_ajax
    end
    expect(page).to have_selector(:table_row, { "Role" => "Role!", "Rate" => "$200", "Candidates" => 0, "Status" => "Not hiring" })
    role = CompanyRole.last
    expect(role.name).to eq "Role!"
    rate = role.rate
    expect(rate.pay_rate_usd).to eq 200
    expect(rate.pay_rate_type).to eq "project_based"

    within(:table_row, { "Role" => company_role.name, "Rate" => "$1,000", "Candidates" => 0, "Status" => "Not hiring" }) do
      click_on "Edit"
    end

    within_modal do
      expect(page).to have_checked_field "Project-based", disabled: true
      expect(page).to_not have_checked_field "Start with trial period"
      expect(page).to_not have_checked_field "Accepting candidates"
      expect(page).to_not have_checked_field "Update rate for all contractors with this role"

      fill_in "Rate", with: 2_000
      check "Accepting candidates"

      click_on "Save changes"
      wait_for_ajax
    end

    expect(company_role.reload.rate.pay_rate_usd).to eq 2_000
    expect(company_role.actively_hiring).to eq true
  end

  it "allows company admins to manage salary roles" do
    company_role = create(:salary_company_role, company:)
    Flipper.enable(:salary_roles, company)

    visit spa_company_roles_path(company.external_id)

    click_on "New role"

    within_modal do
      expect(page).to have_checked_field "Hourly"
      expect(page).to have_text "/ hour"
      fill_in "Rate", with: ""
      click_on "Create"
      expect(page).to have_field("Name", valid: false)
      expect(page).to have_field("Rate", valid: false)

      fill_in "Name", with: "Role!"
      expect(page).to have_field("Name", valid: true)
      fill_in "Rate", with: "100000"
      expect(page).to have_field("Rate", valid: true)
      choose "Salary"

      expect(page).to have_text "/ year"
      expect(page).to_not have_field "Accepting candidates"
      expect(page).to_not have_text "Job description"
      expect(page).to_not have_field "Update rate for all contractors with this role"

      click_on "Create"
      wait_for_ajax
    end
    expect(page).to have_selector(:table_row, { "Role" => "Role!", "Rate" => "$100,000", "Candidates" => 0, "Status" => "Not hiring" })
    role = CompanyRole.last
    expect(role.name).to eq "Role!"
    rate = role.rate
    expect(rate.pay_rate_usd).to eq 100_000
    expect(rate.pay_rate_type).to eq "salary"

    within(:table_row, { "Role" => company_role.name, "Rate" => "$100,000", "Candidates" => 0, "Status" => "Not hiring" }) do
      click_on "Edit"
    end

    within_modal do
      expect(page).to have_checked_field "Salary", disabled: true
      expect(page).to_not have_checked_field "Start with trial period"
      expect(page).to_not have_checked_field "Accepting candidates"
      expect(page).to_not have_checked_field "Update rate for all contractors with this role"

      fill_in "Rate", with: 120_000
      check "Accepting candidates"

      click_on "Save changes"
      wait_for_ajax
    end

    expect(company_role.reload.rate.pay_rate_usd).to eq 120_000
    expect(company_role.actively_hiring).to eq true
  end

  context "expense cards" do
    before do
      company.update!(expense_cards_enabled: true)
    end

    it "allow enabling expense cards" do
      expect(company_role.expense_card_enabled).to eq false

      visit spa_company_roles_path(company.external_id)
      click_on "Edit"
      check "Role should get expense card"
      fill_in "Limit", with: 1_000
      click_on "Save changes"
      wait_for_ajax
      expect(company_role.reload.expense_card_enabled).to eq true
      expect(company_role.expense_card_spending_limit_cents).to eq 1_000_00
    end

    it "show the issued cards warning when disabling expense cards" do
      allow_any_instance_of(Stripe::ExpenseCardsUpdateService).to receive(:process).and_return(success: true)
      company_role.update!(expense_card_enabled: true, expense_card_spending_limit_cents: 1_000)
      create(:expense_card, company_role: company_role)
      create(:expense_card, company_role: company_role)

      visit spa_company_roles_path(company.external_id)
      click_on "Edit"
      expect(page).to have_field("Limit", with: 10)
      uncheck "Role should get expense card"
      expect(page).to have_text "2 issued cards will no longer be usable"

      click_on "Save changes"
      wait_for_ajax
      expect(company_role.reload.expense_card_enabled).to eq false
    end
  end
end
