# frozen_string_literal: true

RSpec.describe "Team member updates page" do
  include CompanyWorkerUpdateHelpers

  before do
    company.update!(team_updates_enabled: true)
  end

  let(:company) { create(:company) }

  shared_examples "displays team updates" do
    context "when updates exist" do
      let(:company_worker1) { create(:company_worker, company:) }
      let(:company_worker2) { create(:company_worker, company:) }
      let(:company_worker3) { create(:company_worker, company:) }

      # this week
      let(:this_week) { CompanyWorkerUpdatePeriod.new }
      let!(:update6) { create(:company_worker_update, :with_tasks, company_worker: company_worker1, period: this_week, published_at: Date.parse("2024-09-20")) }
      let!(:update7) { create(:company_worker_update, :with_tasks, company_worker: company_worker2, period: this_week, published_at: Date.parse("2024-09-21")) }
      let!(:update8) { create(:company_worker_update, :with_tasks, company_worker: company_worker3, period: this_week, published_at: Date.parse("2024-09-22")) }


      context "when GitHub integration exists" do
        let!(:github_integration) { create(:github_integration, company:) }

        before do
          create(:github_integration_record,
                 integratable: update6.tasks.first,
                 integration: github_integration,
                 json_data: {
                   description: "#3186",
                   resource_id: "3186",
                   resource_name: "pulls",
                   status: "open",
                   url: "https://github.com/antiwork/flexile/pull/3186",
                 })
        end

        it "displays an unfurled GitHub link when the task has a GitHub integration record" do
          visit spa_company_updates_team_index_path(company.external_id)

          displays_update_item_with_github_link(update6.tasks.first)
          displays_update_with_contractor(update7)
          displays_update_with_contractor(update8)
        end
      end
    end
  end
end
