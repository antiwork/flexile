# frozen_string_literal: true

RSpec.describe "Stock options contract" do
  let(:company) { create(:company, name: "Gumroad", equity_grants_enabled: true) }
  let(:company_worker) { create(:company_worker, company:) }
  let(:user) { company_worker.user }
  let(:contract) do
    company_investor = create(:company_investor, company:, user:)
    equity_grant = create(:equity_grant, company_investor:)
    create(:equity_plan_contract_doc, equity_grant:, company_worker:, company:, user:)
  end

  it "allows contractor to sign contract", :freeze_time do
    sign_in company_worker.user
    visit spa_company_stock_options_contract_url(company.external_id, contract.to_param)
    expect(page).to have_selector("h1", text: "Equity incentive plan")
    expect(page).to have_selector(".vue-pdf-embed")

    click_on "Click to add signature"

    current_time = Time.current

    expect do
      click_on "Sign and submit"

      expect(page).to have_selector("h1", text: "Equity")
      expect(page).to have_link("Invoices")
      expect(page).to have_link("Documents")
    end.to change { contract.reload.completed_at }.from(nil).to(current_time)
       .and change { contract.contractor_signature }.from(nil).to(company_worker.user.legal_name)
       .and change { contract.attachment.reload.filename.to_s }
  end
end
