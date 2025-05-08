# frozen_string_literal: true

RSpec.describe "Equity exercise agreement" do
  let(:company) { create(:company, is_gumroad: true) }
  let!(:company_administrator) { create(:company_administrator, company:) }
  let(:user) { create(:user) }
  let!(:company_investor) { create(:company_investor, company:, user:) }
  let!(:company_worker) { create(:company_worker, company:, user:) }
  let(:exercise) { create(:equity_grant_exercise, company_investor:, company:, total_cost_cents: 1234_56) }

  before do
    create(:equity_exercise_bank_account, company:)
    Flipper.enable(:option_exercising)
    sign_in user
  end

  it "allows contractor to sign contract" do
    visit spa_company_equity_grant_exercise_path(company.external_id, exercise.id)
    expect(page).to have_selector("h1", text: "Stock Option Exercise Agreement")
    expect(page).to have_selector(".vue-pdf-embed")

    click_on "Click to add signature"

    expect do
      click_on "Sign and submit"
      wait_for_ajax
    end.to change { exercise.reload.status }.to(EquityGrantExercise::SIGNED)
       .and change { exercise.reload.signed_at }.from(nil)
       .and change { company_worker.documents.exercise_notice.count }.by(1)

    expect(page).to have_current_path(spa_company_equity_grant_exercise_account_path(company.external_id, exercise.id))
    expect(page).to have_text("Total to pay $1,234.56", normalize_ws: true)
    {
      "Account number" => "0123456789",
      "Beneficiary name" => company.name,
      "Beneficiary address" => "548 Market Street, San Francisco, CA 94104",
      "Bank name" => "Mercury Business",
      "Routing number" => "987654321",
      "SWIFT/BIC" => "WZYOPW1L",
    }.each do |label, value|
      expect(page).to have_text("#{label} #{value}", normalize_ws: true)
    end
    expect(page).to have_link("Back to Equity", href: spa_company_equity_path(company.external_id))
  end
end
