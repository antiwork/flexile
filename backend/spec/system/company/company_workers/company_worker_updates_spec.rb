# frozen_string_literal: true

RSpec.describe "Company contractor updates page" do
  include CompanyWorkerUpdateHelpers

  let(:company) { create(:company) }
  let(:admin_user) { create(:company_administrator, company:).user }
  let(:contractor) { create(:company_worker, company:) }
  let(:another_contractor) { create(:company_worker, company:) }
  let(:contractor_user) { contractor.user }

  # 2 weeks ago
  let(:two_weeks_ago) { CompanyWorkerUpdatePeriod.new(date: 2.weeks.ago) }
  let!(:update1) { create(:company_worker_update, :with_tasks, company_worker: contractor, period: two_weeks_ago, published_at: Date.parse("2024-09-01")) }
  let!(:update2) { create(:company_worker_update, :with_tasks, company_worker: another_contractor, period: two_weeks_ago, published_at: Date.parse("2024-09-02")) }

  # 1 week ago
  let(:last_week) { CompanyWorkerUpdatePeriod.new(date: 1.week.ago) }
  let!(:update3) { create(:company_worker_update, :with_tasks, company_worker: contractor, period: last_week, published_at: Date.parse("2024-09-10")) }
  let!(:update4) { create(:company_worker_update, :with_tasks, company_worker: another_contractor, period: last_week, published_at: Date.parse("2024-09-11")) }

  # this week
  let(:this_week) { CompanyWorkerUpdatePeriod.new }
  let!(:update5) { create(:company_worker_update, :with_tasks, company_worker: contractor, period: this_week, published_at: Date.parse("2024-09-20")) }
  let!(:update6) { create(:company_worker_update, :with_tasks, company_worker: another_contractor, period: this_week, published_at: Date.parse("2024-09-21")) }

  # absences
  let!(:current_absence) { create(:company_worker_absence, company_worker: contractor, starts_on: this_week.starts_on - 1.day, ends_on: this_week.starts_on + 1.day) }
  let!(:upcoming_absence) { create(:company_worker_absence, company_worker: contractor, starts_on: this_week.ends_on + 1.day, ends_on: this_week.ends_on + 7.days) }
  let!(:past_absence) { create(:company_worker_absence, company_worker: contractor, starts_on: this_week.starts_on - 14.days, ends_on: this_week.starts_on - 7.days) }

  def displays_week_header(period)
    if period.starts_on.month == period.ends_on.month
      expect(page).to have_text("#{period.starts_on.strftime("%b %-d")} - #{period.ends_on.strftime("%-d")}")
    else
      expect(page).to have_text("#{period.starts_on.strftime("%b %-d")} - #{period.ends_on.strftime("%b %-d")}")
    end
  end

  before { company.update!(team_updates_enabled: true) }

  context "when authenticated as an administrator" do
    let(:user) { create(:company_administrator, company:).user }
    before { sign_in user }

    it "displays all the updates for the contractor" do
      visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "updates")

      expect(page).to have_text("Time off")
      expect(page).to have_text("Upcoming")
      expect(page).to have_text(formatted_absence_date_range(current_absence))
      expect(page).to have_text(formatted_absence_date_range(upcoming_absence))
      expect(page).not_to have_text(formatted_absence_date_range(past_absence))

      displays_week_header(this_week)
      displays_update_card(update5, [current_absence])

      displays_week_header(last_week)
      displays_update_card(update3, [past_absence, current_absence])

      displays_week_header(two_weeks_ago)
      displays_update_card(update1, [past_absence])

      expect(page).to have_text("Posted on", count: 3)
    end

    context "when GitHub integration exists" do
      let!(:github_integration) { create(:github_integration, company:) }
      let(:task) { update5.tasks.first }

      before do
        create(:github_integration_record,
               integratable: task,
               integration: github_integration,
               json_data: {
                 external_id: "12345678",
                 description: "Team Updates - GitHub integration",
                 resource_id: "3186",
                 resource_name: "pulls",
                 status: "closed",
                 url: "https://github.com/antiwork/flexile/pull/3186",
               })
        task.update!(name: "#3186")
      end

      it "displays an unfurled GitHub link when the task has a GitHub integration record" do
        visit spa_company_worker_path(company.external_id, contractor.external_id, selectedTab: "updates")

        displays_update_item_with_github_link(task)
      end
    end
  end
end
