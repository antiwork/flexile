# frozen_string_literal: true

RSpec.describe CreateOrUpdateEquityAllocation do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:company_worker) { create(:company_worker, company:, user:) }
  let(:company_investor) { create(:company_investor, company:, user:) }
  let(:year) { Date.current.year }
  let!(:equity_grant) { create(:active_grant, company_investor:, year:) }
  let(:equity_percentage) { 25 }
  subject(:service) { described_class.new(company_worker, equity_percentage:) }

  before do
    company.update!(equity_compensation_enabled: true)
  end

  context "when the feature is not enabled" do
    before do
      company.update!(equity_compensation_enabled: false)
    end

    it "raises an error" do
      expect do
        service.perform!
      end.to raise_error(described_class::Error, "Feature is not enabled.")
    end
  end

  context "when the contractor is project-based" do
    before do
      company_worker.update_column(:pay_rate_type, "project_based")
    end

    it "raises an error" do
      expect do
        service.perform!
      end.to raise_error(described_class::Error, "Equity allocation is not available.")
    end
  end

  context "when the contractor doesn't have an equity grant for the year" do
    before do
      equity_grant.destroy!
    end

    it "raises an error" do
      expect do
        service.perform!
      end.to raise_error(described_class::Error, "User #{user.id} is not ready to save equity percentage.")
    end
  end


  it "updates the equity allocation" do
    expect do
      service.perform!
    end.to change { company_worker.equity_percentage(year) }.from(nil).to(equity_percentage)
  end

  context "when equity allocation cannot be updated" do
    let(:equity_percentage) { -10 }

    it "raises an error" do
      expect do
        service.perform!
      end.to raise_error(ActiveRecord::RecordInvalid).with_message(/Equity percentage must be greater than or equal to 0/)
    end
  end
end
