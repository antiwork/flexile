# frozen_string_literal: true

RSpec.shared_examples "company update show behavior" do |user_factory|
  let!(:company_administrator) { create(:company_administrator) }
  let(:company) { company_administrator.company }
  let(:update) { create(:company_update, title: "2023 update", body: "<h2>Section title</h2><p>This is the update body</p>", sent_at: 1.day.ago, company:) }
  let(:user) { create(user_factory, company:).user }

  before do
    sign_in user
    Flipper.enable(:company_updates, company)
  end

  it "displays the update" do
    visit spa_company_updates_company_path(company.external_id, update.external_id)

    expect(page).to have_text("2023")
    expect(page).to have_selector("h2", text: "Section title")
    expect(page).to have_selector("p", text: "This is the update body")
    expect(page).not_to have_text("Financial Overview")
  end

  context "when the update has financial data and a video" do
    before do
      reports = [
        create(:company_monthly_financial_report, company: update.company, month: 1, year: 2023, net_income_cents: 100_00, revenue_cents: 500_00),
        create(:company_monthly_financial_report, company: update.company, month: 2, year: 2023, net_income_cents: 50_00, revenue_cents: 100_00),
        create(:company_monthly_financial_report, company: update.company, month: 3, year: 2023, net_income_cents: 50_00, revenue_cents: 150_00),
      ]
      update.update!(period: :quarter, period_started_on: Date.new(2023, 1, 1), show_revenue: true, show_net_income: true, company_monthly_financial_reports: reports, video_url: "https://youtube.com/watch?v=123456789")
    end

    it "displays the financial data" do
      visit spa_company_updates_company_path(company.external_id, update.external_id)

      expect(page).to have_text("Financial Overview")
      expect(page).to have_text("Revenue $750", normalize_ws: true)
      expect(page).to have_text("Net income $200", normalize_ws: true)
      expect(page).to have_selector("iframe[src*='https://www.youtube.com/embed/123456789']")

      update.update!(video_url: "https://example.com/video")
      refresh

      expect(page).not_to have_selector("iframe")
      expect(page).to have_link("Watch the video", href: "https://example.com/video")
    end
  end

  context "year over year change" do
    before do
      reports = [
        create(:company_monthly_financial_report, company: update.company, month: 1, year: 2023, net_income_cents: 100_00, revenue_cents: 500_00),
        create(:company_monthly_financial_report, company: update.company, month: 2, year: 2023, net_income_cents: 50_00, revenue_cents: 100_00),
        create(:company_monthly_financial_report, company: update.company, month: 3, year: 2023, net_income_cents: 50_00, revenue_cents: 150_00),
      ]
      update.update!(period: :quarter, period_started_on: Date.new(2023, 1, 1), show_revenue: true, show_net_income: true, company_monthly_financial_reports: reports)
    end

    context "when there is data for the previous year" do
      before do
        create(:company_monthly_financial_report, company: update.company, month: 1, year: 2022, net_income_cents: 120_00, revenue_cents: 210_00)
        create(:company_monthly_financial_report, company: update.company, month: 2, year: 2022, net_income_cents: 53_00, revenue_cents: 90_00)
        create(:company_monthly_financial_report, company: update.company, month: 3, year: 2022, net_income_cents: 57_00, revenue_cents: 70_00)
      end

      it "displays the year over year change" do
        visit spa_company_updates_company_path(company.external_id, update.external_id)

        expect(page).to have_text("Revenue $750 102.7% Year over year", normalize_ws: true)
        expect(page).to have_text("Net income $200 -13.04% Year over year", normalize_ws: true)
      end
    end

    context "when the previous year difference is zero" do
      before do
        create(:company_monthly_financial_report, company: update.company, month: 1, year: 2022, net_income_cents: 100_00, revenue_cents: 500_00)
        create(:company_monthly_financial_report, company: update.company, month: 2, year: 2022, net_income_cents: 50_00, revenue_cents: 100_00)
        create(:company_monthly_financial_report, company: update.company, month: 3, year: 2022, net_income_cents: 50_00, revenue_cents: 150_00)
      end

      it "displays the year over year change" do
        visit spa_company_updates_company_path(company.external_id, update.external_id)

        expect(page).to have_text("Revenue $750 0% Year over year", normalize_ws: true)
        expect(page).to have_text("Net income $200 0% Year over year", normalize_ws: true)
      end
    end

    context "when the previous year sum is zero" do
      before do
        create(:company_monthly_financial_report, company: update.company, month: 1, year: 2022, net_income_cents: 0, revenue_cents: 600_00)
        create(:company_monthly_financial_report, company: update.company, month: 2, year: 2022, net_income_cents: 50_00, revenue_cents: 100_00)
        create(:company_monthly_financial_report, company: update.company, month: 3, year: 2022, net_income_cents: -50_00, revenue_cents: 150_00)
      end

      it "displays nothing for that value" do
        visit spa_company_updates_company_path(company.external_id, update.external_id)

        expect(page).to have_text("Revenue $750 -11.76% Year over year", normalize_ws: true)
        expect(page).to have_text("Net income $200", normalize_ws: true)
        expect(page).to have_text("Year over year", count: 1)
      end
    end
  end
end

RSpec.describe "Company update page" do
  [:company_worker, :company_investor, :company_administrator].each do |user_type|
    context "when user is a #{user_type}" do
      it_behaves_like "company update show behavior", user_type
    end
  end

  context "when the update is a draft" do
    let!(:company_administrator) { create(:company_administrator) }
    let(:company) { company_administrator.company }
    let(:update) { create(:company_update, title: "2023 update", body: "<h2>Section title</h2><p>This is the update body</p>", company:) }

    before do
      Flipper.enable(:company_updates, company)
    end

    it "displays a 403 for a non-admin" do
      sign_in create(:company_worker, company:).user

      visit spa_company_updates_company_path(company.external_id, update.external_id)
      expect(page).to have_text("You are not allowed to perform this action.")
    end

    context "when the user is an admin" do
      let(:user) { company_administrator.user }
      before do
        sign_in user
      end

      it "displays preview title" do
        visit spa_company_updates_company_path(company.external_id, update.external_id)

        expect(page).to have_text("Previewing: #{update.title}")
      end

      it "allows sending test email" do
        visit spa_company_updates_company_path(company.external_id, update.external_id)

        expect(page).to have_button("Send test email")

        expect do
          click_button "Send test email"
          wait_for_ajax
        end.to change { ActionMailer::Base.deliveries.count }.by(1)

        last_email = ActionMailer::Base.deliveries.last
        expect(last_email.to).to include(user.email)
      end
    end
  end
end
