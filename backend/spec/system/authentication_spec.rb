# frozen_string_literal: true

RSpec.describe "Authentication" do
  let(:company_administrator) { create(:company_administrator) }
  let(:company) { company_administrator.company }

  it "allows company administrator user to log in" do
    visit root_path
    expect(page).to have_current_path(spa_login_path)
    expect(page).to have_button("Continue with Google")
    fill_in "Email", with: company_administrator.user.email
    fill_in "Password", with: company_administrator.user.password
    click_on "Log in"
    expect(page).to have_current_path(spa_company_invoices_path(company.external_id))
  end

  context "when the credentials are invalid" do
    it "displays an error message and does not log in" do
      visit root_path
      fill_in "Email", with: company_administrator.user.email
      fill_in "Password", with: "wrong password"
      click_on "Log in"

      expect(page).to have_current_path(spa_login_path)
      expect(page).to have_content("Invalid email or password.")
      expect(page).to have_selector("input[type='email']:invalid")
      expect(page).to have_selector("input[type='password']:invalid")

      find_field("Password").set("updated password")
      expect(page).not_to have_selector("input:invalid")
    end
  end

  context "when there's an error" do
    it "displays an error message" do
      visit root_path
      fill_in "Email", with: company_administrator.user.email
      fill_in "Password", with: company_administrator.user.password

      allow_any_instance_of(Users::SessionsController).to receive(:create).and_return({ ok: false })
      click_on "Log in"

      expect(page).to have_content("Something went wrong. Please try again later.")
    end
  end

  it "allows the user to log out" do
    contractor = create(:company_worker, company: company)

    sign_in company_administrator.user
    visit spa_company_workers_path(company.external_id)
    click_on "Log out"
    expect(page).to have_current_path(spa_login_path)

    sign_in company_administrator.user
    visit spa_company_worker_path(company.external_id, contractor.external_id)
    click_on "Log out"
    expect(page).to have_current_path(spa_login_path)
  end

  it "redirects to the login page when trying to access a user page while logged out" do
    visit spa_company_workers_path(company.external_id)

    expect(page).to have_current_path(spa_login_path(next: spa_company_workers_path(company.external_id)))

    fill_in "Email", with: company_administrator.user.email
    fill_in "Password", with: company_administrator.user.password
    click_on "Log in"

    expect(page).to have_selector("h1", text: "People")
    expect(page).to have_current_path(spa_company_workers_path(company.external_id))
  end
end
