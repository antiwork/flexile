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


      # GitHub integration tests removed as part of GitHub integration removal
    end
  end
end
