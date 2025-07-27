# frozen_string_literal: true

RSpec.describe "Company update edit flow" do
  let!(:company_administrator) { create(:company_administrator) }
  let(:user) { company_administrator.user }
  let(:company) { company_administrator.company }
  let!(:company_investor) { create(:company_investor, company:) }
  let!(:company_update) { create(:company_update, company:, title: "April 2023", body: "Initial content", period: :month, period_started_on: Date.new(2023, 4, 1), show_revenue: true, show_net_income: false) }
  let!(:monthly_report_1) { create(:company_monthly_financial_report, company:, year: 2023, month: 1, revenue_cents: 1_01, net_income_cents: 10_01) }
  let!(:monthly_report_2) { create(:company_monthly_financial_report, company:, year: 2023, month: 2, revenue_cents: 2_02, net_income_cents: 20_02) }
  let!(:monthly_report_3) { create(:company_monthly_financial_report, company:, year: 2023, month: 3, revenue_cents: 3_03, net_income_cents: 30_03) }
  let!(:monthly_report_4) { create(:company_monthly_financial_report, company:, year: 2023, month: 4, revenue_cents: 100_12, net_income_cents: 80_34) }
  let!(:last_year_report) { create(:company_monthly_financial_report, company:, year: 2022, month: 4, revenue_cents: 110_12, net_income_cents: 90_34) }

  before do
    Flipper.enable(:company_updates, company)
    travel_to Date.new(2023, 5, 15)
    company_update.company_monthly_financial_reports << monthly_report_4
    sign_in user
  end

  context "when editing an existing company update" do
    before do
      create_list(:company_worker, 3, company:)
      create_list(:company_investor, 2, company:)
    end

    it "allows editing and publishing a draft company update" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).to have_button("Publish")
      expect(page).to have_text("Edit company update")

      expect(page).to have_text("RECIPIENTS (5)")
      expect(page).to have_text("2 investors")
      expect(page).to have_text("3 active contractors")

      expect(page).to have_text("Financial overview")
      expect(page).to have_field("Revenue", type: "checkbox", role: "switch", checked: true)
      expect(page).to have_field("Net income", type: "checkbox", role: "switch", checked: false)

      expect(page).to have_select(
        "Financial overview",
        selected: "April 2023 (Last month)",
        with_options: [
          "April 2023 (Last month)",
          "Q1 2023 (Last quarter)",
          "2022 (Last year)",
        ],
      )

      expect(find_rich_text_editor("Update")).to have_content("Initial content")
      expect(page).to have_field("Video URL (optional)")

      fill_in "Title", with: "Q1 update"
      select "Q1 2023 (Last quarter)", from: "Financial overview"
      find_rich_text_editor("Update").click.send_keys(" - Updated content.")
      check "Net income"
      fill_in "Video URL (optional)", with: "https://example.com/updated-video"

      click_button "Publish"
      expect(page).to have_text("Your update will be emailed to 5 stakeholders.")

      expect do
        click_button "Yes, publish"
        wait_for_navigation
      end.to change { CompanyUpdate.count }.by(0)
        .and change { CompanyUpdateEmailJob.jobs.size }.by(5)

      expect(current_path).to eq(spa_company_updates_company_index_path(company.external_id))

      company_update.reload
      expect(company_update.title).to eq("Q1 update")
      expect(company_update.body).to eq("<p>Initial content - Updated content.</p>")
      expect(company_update.show_revenue).to be true
      expect(company_update.show_net_income).to be true
      expect(company_update.video_url).to eq("https://example.com/updated-video")

      expect(company_update.company_monthly_financial_reports).to eq([
                                                                       monthly_report_1,
                                                                       monthly_report_2,
                                                                       monthly_report_3,
                                                                     ])

      expect(page).to have_table(with_rows: [
                                   {
                                     "Sent on" => "May 15, 2023",
                                     "Title" => "Q1 update",
                                     "Status" => CompanyUpdate::SENT,
                                   },
                                 ])
    end

    it "allows editing a published company update without triggering emails" do
      company_update.update(sent_at: 1.day.ago)
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).to have_button("Update")
      expect(page).to have_text("Edit company update")

      click_button "Update"
      expect(page).to have_text("Your update will be visible in Flexile. No new emails will be sent.")

      expect do
        click_button "Yes, update"
        wait_for_navigation
      end.to change { CompanyUpdate.count }.by(0)
        .and not_change { CompanyUpdateEmailJob.jobs.size }

      expect(current_path).to eq(spa_company_updates_company_index_path(company.external_id))
    end

    it "validates required fields" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      find_rich_text_editor("Update").set("").send_keys(:backspace)
      click_button "Publish"
      expect(find_rich_text_editor("Update")["aria-invalid"]).to eq "true"

      fill_in_rich_text_editor("Update", with: "Updated content")
      expect(find_rich_text_editor("Update")["aria-invalid"]).not_to eq "true"
    end

    it "allows to switch back to the original period after having changed it" do
      company_update = create(:company_update, company:, title: "January 2023", body: "Initial content", period: :month, period_started_on: Date.new(2023, 1, 1), show_revenue: true, show_net_income: false)
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).to have_select("Financial overview", selected: "January 2023 (Original period)")

      select "2022 (Last year)", from: "Financial overview"
      expect(page).to have_select("Financial overview", selected: "2022 (Last year)")

      select "January 2023 (Original period)", from: "Financial overview"
      expect(page).to have_select("Financial overview", selected: "January 2023 (Original period)")
    end

    it "keeps the financial period unless the user changes it" do
      travel_to Date.new(2024, 8, 15)
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      fill_in "Title", with: "just updated title"
      click_button "Publish"
      click_button "Yes, publish"
      wait_for_ajax
      company_update.reload
      expect(company_update.title).to eq("just updated title")
      expect(company_update.period).to eq("month")
      expect(company_update.period_started_on).to eq(Date.new(2023, 4, 1))
    end

    it "updates the financial overview based on the selected period" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).to have_text("Revenue $100.12 -9.08% Year over year", normalize_ws: true)
      expect(page).to have_text("Net income $80.34 -11.07% Year over year", normalize_ws: true)

      select "Q1 2023 (Last quarter)", from: "Financial overview"
      expect(page).to have_text("Revenue $6.06", normalize_ws: true)
      expect(page).to have_text("Net income $60.06", normalize_ws: true)
      expect(page).not_to have_text("Year over year")
    end
  end

  context "when previewing the update" do
    it "shows the preview on a new tab" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      select "April 2023 (Last month)", from: "Financial overview"
      fill_in_rich_text_editor("Update", with: "This is our monthly update for April 2023.")

      click_button "Preview"
      expect(page).to have_text("April 2023")
      expect(page).to have_text("This is our monthly update for April 2023.")
    end

    it "updates the company update draft when previewing" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      fill_in "Title", with: "updated title"
      select "Q1 2023 (Last quarter)", from: "Financial overview"
      find_rich_text_editor("Update").click.send_keys(" - now updated.")

      expect do
        initial_tab = current_window
        preview_tab = window_opened_by { click_button "Preview" }
        preview_tab.close
        switch_to_window initial_tab
        wait_for_ajax
      end.to change { CompanyUpdate.count }.by(0)

      company_update = CompanyUpdate.last
      expect(company_update.status).to eq(CompanyUpdate::DRAFT)
      expect(company_update.title).to eq("updated title")
      expect(company_update.body).to eq("<p>Initial content - now updated.</p>")
    end

    it "hides the preview link when the update status is 'Sent'" do
      company_update.update(sent_at: 1.day.ago)
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).not_to have_link("Preview")
    end

    it "shows the preview link when the update status is 'Draft'" do
      visit edit_spa_company_updates_company_path(company.external_id, company_update.external_id)

      expect(page).to have_button("Preview")
    end
  end
end
