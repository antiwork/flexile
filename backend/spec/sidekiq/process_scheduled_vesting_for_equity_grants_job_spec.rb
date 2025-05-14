# frozen_string_literal: true

RSpec.describe ProcessScheduledVestingForEquityGrantsJob do
  describe "#perform" do
    let(:vesting_schedule) { create(:vesting_schedule) }
    let!(:equity_grant_vests_as_per_schedule1) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:) }
    let!(:equity_grant_vests_as_per_schedule2) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:, period_ended_at: 1.day.ago) }
    let!(:equity_grant_vests_as_per_schedule3) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:, period_ended_at: 5.hours.from_now) }
    let!(:equity_grant_vests_as_per_schedule4) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:, period_ended_at: 1.day.from_now) }
    let!(:equity_grant_vests_as_per_schedule5) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:, period_ended_at: 1.month.from_now, accepted_at: nil) }
    let!(:equity_grant_vests_on_invoice_payment) { create(:equity_grant, :vests_on_invoice_payment) }

    it "enqueues ProcessEquityGrantScheduledVestingJob for scheduled equity grants that have not ended" do
      described_class.new.perform
      expect(ProcessEquityGrantScheduledVestingJob).to have_enqueued_sidekiq_job(equity_grant_vests_as_per_schedule1.id)
      expect(ProcessEquityGrantScheduledVestingJob).to have_enqueued_sidekiq_job(equity_grant_vests_as_per_schedule3.id)
      expect(ProcessEquityGrantScheduledVestingJob).to have_enqueued_sidekiq_job(equity_grant_vests_as_per_schedule4.id)
      expect(ProcessEquityGrantScheduledVestingJob).not_to have_enqueued_sidekiq_job(equity_grant_vests_as_per_schedule2.id)
      expect(ProcessEquityGrantScheduledVestingJob).not_to have_enqueued_sidekiq_job(equity_grant_vests_on_invoice_payment.id)
      expect(ProcessEquityGrantScheduledVestingJob).not_to have_enqueued_sidekiq_job(equity_grant_vests_as_per_schedule5.id)
    end
  end
end
