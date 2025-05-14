# frozen_string_literal: true

RSpec.describe "Invite Company", type: :system do
  let(:contractor) { create(:user, inviting_company: true) }

  before do
    sign_in contractor
  end

  it "shows a placeholder and allows a contractor to invite a company" do
    visit spa_company_invitations_path

    expect(page).not_to have_selector("search")
    expect(page).to have_content("Welcome to Flexile")
    expect(page).to have_content("To get started, invite a company to work with.")
    expect(page).to have_link("Invite company")

    click_on "Invite company", id: "invite-company"

    expect(page).to have_button("Send invite", disabled: true)

    fill_in "Email", with: "company@example.com"
    fill_in "Company name", with: "New Company"
    fill_in "Role name", with: "Developer"
    choose "Hourly"
    fill_in "Rate", with: "100"
    fill_in "Average hours", with: "40"

    click_on "Add your signature"
    expect(page).to have_css(".font-signature", text: contractor.name)

    fill_in "Rate", with: "110"
    expect(page).not_to have_css(".font-signature", text: contractor.name)
    expect(page).to have_button("Send invite", disabled: true)

    click_on "Add your signature"
    expect(page).to have_css(".font-signature", text: contractor.name)
    expect(page).to have_button("Send invite", disabled: false)

    click_on "Send invite"

    expected_rows = [
      {
        "Invited CEO Email" => "company@example.com",
        "Company Name" => "New Company",
      }
    ]
    expect(page).to have_table(with_rows: expected_rows)
    expect(page).to have_link("Invite another")

    wait_for_ajax

    company = Company.last
    expect(company).not_to be_nil
    expect(company.email).to eq("company@example.com")

    company_administrator = company.company_administrators.first
    expect(company_administrator).not_to be_nil

    company_role = company.company_roles.find_by(name: "Developer")
    expect(company_role).not_to be_nil
    expect(company_role.pay_rate_usd).to eq(110)
    expect(company_role.pay_rate_type).to eq("hourly")

    company_worker = company.company_workers.find_by(user: contractor)
    expect(company_worker).not_to be_nil
    expect(company_worker.hours_per_week).to eq(40)

    click_on "Invite another"

    expect(page).to have_content("Company details")
  end
end
