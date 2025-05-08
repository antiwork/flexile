# frozen_string_literal: true

RSpec.describe "Error pages" do
  let(:company_administrator) { create(:company_administrator) }
  let(:company) { company_administrator.company }

  before do
    login_as company_administrator.user
  end

  it "renders a 404 page if the page does not exist" do
    visit "/pagethatdoesnotexist"
    expect(page).to have_text("Page not found")
  end

  it "renders a 500 page if the request fails" do
    visit spa_company_invoices_path(company.external_id)
    page.execute_script("window.fetch = () => new Promise((resolve, reject) => reject())")

    expect(page).to have_text("Something went wrong")
  end
end
