# frozen_string_literal: true

RSpec.describe "Creating an equity grant" do
  let!(:company) { create(:company, equity_enabled: true) }
  let!(:option_pool) { create(:option_pool, company:, authorized_shares: 2_001, issued_shares: 1_000) }
  let!(:company_administrator) { create(:company_administrator, company:).user }

  before do
    sign_in company_administrator
  end

  it "creates a new equity grant" do
    company_worker = create(:company_worker, company:, pay_rate_type: :hourly)

    visit spa_company_equity_grants_path(company.external_id)

    click_on "New option grant"

    select company_worker.user.display_name, from: "Recipient"
    expect(page).to have_select("Option pool", selected: option_pool.name)
    expect(page).to have_text("Available shares in this option pool: 1,001")
    fill_in "Number of options", with: "500"
    expect(page).to have_select("Relationship to company", selected: "Employee")
    expect(page).to have_select("Grant type", selected: "ISO (Incentive Stock Option)")
    select "Consultant", from: "Relationship to company"
    select "NSO (Non-Qualified Stock Option)", from: "Grant type"
    fill_in "Expiry", with: 24
    fill_in "Board approval date", with: "01/01/2024"
    fill_in "Voluntary termination exercise period", with: 12
    fill_in "Involuntary termination exercise period", with: 13
    fill_in "Termination with cause exercise period", with: 14
    fill_in "Death exercise period", with: 15
    fill_in "Disability exercise period", with: 16
    fill_in "Retirement exercise period", with: 17

    expect do
      click_on "Create option grant"
      wait_for_navigation
    end.to change { EquityGrant.count }.by(1)

    expect(page).to have_current_path(spa_company_equity_grants_path(company.external_id))
    expect(page).to have_selector(:table_row, { "Contractor" => company_worker.user.legal_name, "Granted" => 500 })

    equity_grant = EquityGrant.last
    expect(equity_grant.company_investor.user).to eq(company_worker.user)
    expect(equity_grant.option_pool).to eq(option_pool)
    expect(equity_grant.number_of_shares).to eq(500)
    expect(equity_grant.issue_date_relationship_consultant?).to be(true)
    expect(equity_grant.option_grant_type_nso?).to be(true)
    expect(equity_grant.expires_at).to be_within(2.seconds).of(Time.current + 24.months)
    expect(equity_grant.board_approval_date).to eq(Date.parse("01/01/2024"))
    expect(equity_grant.voluntary_termination_exercise_months).to eq(12)
    expect(equity_grant.involuntary_termination_exercise_months).to eq(13)
    expect(equity_grant.termination_with_cause_exercise_months).to eq(14)
    expect(equity_grant.death_exercise_months).to eq(15)
    expect(equity_grant.disability_exercise_months).to eq(16)
    expect(equity_grant.retirement_exercise_months).to eq(17)
  end

  def expect_field_to_have_error(field_name, error_message)
    within find_field(field_name).ancestor("fieldset") do
      expect(page).to have_text(error_message)
    end
  end

  it "performs validations while creating an equity grant" do
    company_worker = create(:company_worker, company:)

    visit new_spa_company_administrator_equity_grant_path(company.external_id)

    click_on "Create option grant"
    expect(page).to have_select("Recipient", selected: "Select recipient", valid: false)
    expect_field_to_have_error("Recipient", "Must be present.")

    select company_worker.user.display_name, from: "Recipient"
    click_on "Create option grant"
    expect(page).to have_field("Number of options", with: "", valid: false)
    expect_field_to_have_error("Number of options", "Must be present and greater than 0.")

    fill_in "Number of options", with: "1002"
    click_on "Create option grant"
    expect(page).to have_field("Number of options", with: "1002", valid: false)
    expect_field_to_have_error("Number of options", %Q(Not enough shares available in the option pool "#{option_pool.name}" to create a grant with this number of options.))

    fill_in "Number of options", with: "10"
    click_on "Create option grant"
    expect(page).to have_select("Relationship to company", selected: "Select relationship", valid: false)
    expect_field_to_have_error("Relationship to company", "Must be present.")

    select "Consultant", from: "Relationship to company"
    expect(page).to have_select("Grant type", selected: "NSO (Non-Qualified Stock Option)", valid: true)
    select "ISO (Incentive Stock Option)", from: "Grant type"
    click_on "Create option grant"
    expect(page).to have_select("Grant type", selected: "ISO (Incentive Stock Option)", valid: false)
    expect_field_to_have_error("Grant type", "ISOs can only be issued to employees or founders.")

    select "Employee", from: "Relationship to company"
    expect(page).to have_field("Expiry", with: "120", valid: true)
    fill_in "Expiry", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Expiry", with: "", valid: false)
    expect_field_to_have_error("Expiry", "Must be present and greater than or equal to 0.")

    fill_in "Expiry", with: 12
    expect(page).to have_field("Board approval date", with: DateTime.current.strftime("%Y-%m-%d"))
    fill_in "Board approval date", with: "01/01/#{2.years.from_now.year}"
    click_on "Create option grant"
    expect(page).to have_field("Board approval date", with: "#{2.years.from_now.year}-01-01", valid: false)
    expect_field_to_have_error("Board approval date", "Must be present and must not be a future date.")

    one_week_ago = 1.week.ago
    fill_in "Board approval date", with: one_week_ago.to_date
    expect(page).to have_field("Voluntary termination exercise period", with: "120", valid: true)
    fill_in "Voluntary termination exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Voluntary termination exercise period", with: "", valid: false)
    expect_field_to_have_error("Voluntary termination exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Voluntary termination exercise period", with: 13
    expect(page).to have_field("Involuntary termination exercise period", with: "120", valid: true)
    fill_in "Involuntary termination exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Involuntary termination exercise period", with: "", valid: false)
    expect_field_to_have_error("Involuntary termination exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Involuntary termination exercise period", with: 14
    expect(page).to have_field("Termination with cause exercise period", with: "0", valid: true)
    fill_in "Termination with cause exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Termination with cause exercise period", with: "", valid: false)
    expect_field_to_have_error("Termination with cause exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Termination with cause exercise period", with: 15
    expect(page).to have_field("Death exercise period", with: "120", valid: true)
    fill_in "Death exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Death exercise period", with: "", valid: false)
    expect_field_to_have_error("Death exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Death exercise period", with: 16
    expect(page).to have_field("Disability exercise period", with: "120", valid: true)
    fill_in "Disability exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Disability exercise period", with: "", valid: false)
    expect_field_to_have_error("Disability exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Disability exercise period", with: 17
    expect(page).to have_field("Retirement exercise period", with: "120", valid: true)
    fill_in "Retirement exercise period", with: ""
    click_on "Create option grant"
    expect(page).to have_field("Retirement exercise period", with: "", valid: false)
    expect_field_to_have_error("Retirement exercise period", "Must be present and greater than or equal to 0.")

    fill_in "Retirement exercise period", with: 18
    expect do
      click_on "Create option grant"
      wait_for_navigation
    end.to change { EquityGrant.count }.by(1)
    expect(page).to have_current_path(spa_company_equity_grants_path(company.external_id))
    expect(page).to have_selector(:table_row, { "Contractor" => company_worker.user.legal_name, "Granted" => 10 })

    equity_grant = EquityGrant.last
    expect(equity_grant.number_of_shares).to eq(10)
    expect(equity_grant.issue_date_relationship_employee?).to be(true)
    expect(equity_grant.option_grant_type_iso?).to be(true)
    expect(equity_grant.expires_at).to be_within(2.seconds).of(Time.current + 12.months)
    expect(equity_grant.board_approval_date).to eq(one_week_ago.to_date)
    expect(equity_grant.voluntary_termination_exercise_months).to eq(13)
    expect(equity_grant.involuntary_termination_exercise_months).to eq(14)
    expect(equity_grant.termination_with_cause_exercise_months).to eq(15)
    expect(equity_grant.death_exercise_months).to eq(16)
    expect(equity_grant.disability_exercise_months).to eq(17)
    expect(equity_grant.retirement_exercise_months).to eq(18)
  end
end
