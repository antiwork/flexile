# frozen_string_literal: true

RSpec.describe "List Contractors" do
  let(:admin_user) { create(:user, :company_admin) }
  let(:company) { admin_user.company_administrators.first!.company }
  let!(:contractor1) do create(:company_worker, company:, hours_per_week: 10, equity_percentage: 80,
                                                pay_rate_usd: 100, created_at: 5.days.ago,
                                                user: create(:user)) end
  let!(:contractor2) do create(:company_worker, company:, hours_per_week: 5,
                                                pay_rate_usd: 50,
                                                user: create(:user, country_code: "IN")) end
  let!(:contractor3) { create(:company_worker, :project_based, company:, user: create(:user)) }
  let!(:future_contractor) do create(:company_worker, company:, hours_per_week: 10,
                                                      pay_rate_usd: 40, created_at: 5.days.ago, started_at: 1.day.from_now,
                                                      user: create(:user, country_code: "AU")) end

  def perform_common_assertions
    select_tab "Onboarding"

    expect(page).to have_table(with_rows: [
                                 {
                                   "Contractor" => future_contractor.user.display_name,
                                   "Country" => "Australia",
                                   "Start Date" => future_contractor.started_at.strftime("%b %-d, %Y"),
                                   "Average hours" => "10",
                                   "Rate" => "$40",
                                   "Avg. Year" => "$17,600", # 10 * $40 * 44
                                   "Status" => "Starts on #{future_contractor.started_at.strftime("%b %-d, %Y")}",
                                 }
                               ])

    select_tab "Active"

    expect(page).to have_table(with_rows: [
                                 {
                                   "Contractor" => contractor1.user.display_name,
                                   "Country" => "United States",
                                   "Start Date" => contractor1.started_at.strftime("%b %-d, %Y"),
                                   "Average hours" => "10",
                                   "Rate" => "$100",
                                   "Avg. Year" => "$44,000", # 10 * $100 * 44
                                 },
                                 {
                                   "Contractor" => contractor2.user.display_name,
                                   "Country" => "India",
                                   "Start Date" => contractor2.started_at.strftime("%b %-d, %Y"),
                                   "Average hours" => "5",
                                   "Rate" => "$50",
                                   "Avg. Year" => "$11,000", # 5 * $50 * 44
                                 },
                                 {
                                   "Contractor" => contractor3.user.display_name,
                                   "Country" => "United States",
                                   "Start Date" => contractor3.started_at.strftime("%b %-d, %Y"),
                                   "Average hours" => "N/A",
                                   "Rate" => "$1,000",
                                   "Avg. Year" => "N/A",
                                 }
                               ])
  end

  context "when a company admin is viewing the page" do
    before do
      sign_in admin_user

      visit spa_company_workers_path(company.external_id)
    end

    it "lists contractor details for all contractors" do
      perform_common_assertions

      expect(page).to have_link("Invite contractor", href: new_spa_company_worker_path(company.external_id))
      find(:table_row, { "Contractor" => contractor1.user.display_name }).click
      expect(page).to have_current_path(spa_company_worker_path(company.external_id, contractor1.external_id))
      expect(page).to have_text("Equity split")
      expect(page).to have_text("80% Equity ($80)", normalize_ws: true)
      expect(page).to have_text("20% Cash ($20)", normalize_ws: true)

      visit spa_company_workers_path(company.external_id)
      find(:table_row, { "Contractor" => contractor2.user.display_name }).click
      expect(page).to have_current_path(spa_company_worker_path(company.external_id, contractor2.external_id))
      expect(page).to_not have_text("Equity split")

      visit spa_company_workers_path(company.external_id)
      find(:table_row, { "Contractor" => contractor3.user.display_name }).click
      expect(page).to have_current_path(spa_company_worker_path(company.external_id, contractor3.external_id))
      expect(page).to_not have_text("Equity split")

      visit spa_company_workers_path(company.external_id)
      select_tab "Onboarding"
      find(:table_row, { "Contractor" => future_contractor.user.display_name }).click
      expect(page).to have_current_path(spa_company_worker_path(company.external_id, future_contractor.external_id))
      expect(page).to_not have_text("Equity split")
    end
  end
end
