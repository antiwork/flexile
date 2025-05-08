# frozen_string_literal: true

RSpec.describe ProcessEquityGrantScheduledVestingJob do
  describe "#perform" do
    let(:vesting_schedule) { create(:vesting_schedule) }
    let!(:equity_grant) { create(:equity_grant, :vests_as_per_schedule, vesting_schedule:) }

    it "processes vested shares for the equity grant" do
      expect(EquityGrant::UpdateVestedShares).to receive(:new).with(equity_grant:).and_call_original

      described_class.new.perform(equity_grant.id)
    end
  end
end
