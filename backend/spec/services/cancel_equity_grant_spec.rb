# frozen_string_literal: true

RSpec.describe CancelEquityGrant do
  subject(:service) { described_class.new(equity_grant:, reason:) }

  describe "#process", :freeze_time do
    context "when equity vests on invoice payment" do
      let(:equity_grant) { create(:equity_grant, :vests_on_invoice_payment, number_of_shares: 1000, vested_shares: 100, unvested_shares: 700, exercised_shares: 200, forfeited_shares: 0) }
      let(:reason) { VestingEvent::CANCELLATION_REASONS[:not_enough_shares_available] }

      it "cancels the equity grant" do
        expect do
          service.process
        end.to change(equity_grant, :cancelled_at).from(nil).to(Time.current)
            .and change(equity_grant, :forfeited_shares).by(equity_grant.unvested_shares)
            .and change(equity_grant, :unvested_shares).to(0)
      end
    end

    context "when equity vests as per schedule" do
      let(:equity_grant) do
        create(:equity_grant, :vests_as_per_schedule,
               board_approval_date: Date.current.beginning_of_month - 1.month,
               number_of_shares: 1000,
               vested_shares: 100,
               unvested_shares: 700,
               exercised_shares: 200,
               forfeited_shares: 0,
               vesting_schedule: create(:vesting_schedule, vesting_frequency_months: 1, total_vesting_duration_months: 12, cliff_duration_months: 0))
      end

      context "when reason is invalid" do
        let(:reason) { "Invalid reason" }

        it "raises an error" do
          expect { service.process }.to raise_error(ActiveRecord::RecordInvalid)
        end
      end

      context "when reason is valid" do
        let(:reason) { VestingEvent::CANCELLATION_REASONS[:not_enough_shares_available] }

        it "cancels the equity grant" do
          expect do
            service.process
          end.to change(equity_grant, :cancelled_at).from(nil).to(Time.current)
             .and change(equity_grant, :forfeited_shares).by(700)
             .and change(equity_grant, :unvested_shares).to(0)

          vesting_event = equity_grant.vesting_events.last
          expect(vesting_event.cancelled_at).to eq(Time.current)
          expect(vesting_event.cancellation_reason).to eq(reason)
        end
      end
    end
  end
end
