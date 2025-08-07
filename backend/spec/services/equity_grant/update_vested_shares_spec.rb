# frozen_string_literal: true

RSpec.describe EquityGrant::UpdateVestedShares do
  let(:vesting_schedule) { create(:vesting_schedule, :four_year_with_one_year_cliff) }
  let(:equity_grant) { create(:equity_grant, :vests_as_per_schedule, number_of_shares: 1000, vesting_schedule:, board_approval_date: Date.parse("25 Oct, 2024")) }
  let(:invoice) { nil }
  let(:post_invoice_payment_vesting_event) { nil }
  subject(:service) { described_class.new(equity_grant:, invoice:, post_invoice_payment_vesting_event:) }

  describe "#process" do
    context "when there are no eligible unprocessed vesting events" do
      before do
        travel_to(Date.parse("30 Oct, 2024")) # Before the cliff
      end

      it "neither updates the equity grant nor processes any scheduled events" do
        expect { service.process }.not_to change { equity_grant.reload.attributes }
        expect(equity_grant.vested_shares).to eq(0)
        expect(equity_grant.unvested_shares).to eq(1000)
        expect(equity_grant.vesting_events.processed.count).to eq(0)
        expect(equity_grant.vesting_events.cancelled.count).to eq(0)
      end
    end

    context "when there are eligible unprocessed vesting events" do
      it "processes the vesting events as per the schedule and updates the equity grant accordingly" do
        expect(equity_grant.vesting_events.count).to eq(37)
        expect(equity_grant.vesting_events.processed.count).to eq(0)
        # On a date before cliff
        travel_to(Date.parse("24 Oct, 2025"))
        expect do
          service.process
        end.not_to change { equity_grant.reload.vesting_events.processed.count }

        # On the exact cliff date
        travel_to(Date.parse("25 Oct, 2025"))
        expect do
          service.process
        end.to change { equity_grant.reload.vesting_events.processed.count }.by(1)
        expect(equity_grant.vesting_events.processed.where(vesting_date: Date.parse("25 Oct, 2025")).pluck(:vested_shares)).to eq([240])
        expect(equity_grant).to have_attributes(vested_shares: 240, unvested_shares: 760)

        # On a date after cliff with no events
        travel_to(Date.parse("26 Oct, 2025"))
        expect do
          service.process
        end.not_to change { equity_grant.reload.vesting_events.processed.count }

        # On a date when there is an event
        travel_to(Date.parse("25 Nov, 2025"))
        expect do
          service.process
        end.to change { equity_grant.reload.vesting_events.processed.count }.by(1)
        expect(equity_grant.vesting_events.processed.where(vesting_date: Date.parse("25 Nov, 2025")).pluck(:vested_shares)).to eq([20])
        expect(equity_grant).to have_attributes(vested_shares: 260, unvested_shares: 740)

        # On a future date (assuming some of the past eligible events were not processed by then for some reason)
        travel_to(Date.parse("28 Aug, 2027"))
        expect do
          service.process
        end.to change { equity_grant.reload.vesting_events.processed.count }.by(21)
        expect(equity_grant.vesting_events.processed.where("vesting_date > ?", Date.parse("25 Nov, 2025")).pluck(:vesting_date, :vested_shares)).to eq([
                                                                                                                                                         [Date.parse("25 Dec, 2025"), 20],
                                                                                                                                                         [Date.parse("25 Jan, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Feb, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Mar, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Apr, 2026"), 20],
                                                                                                                                                         [Date.parse("25 May, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Jun, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Jul, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Aug, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Sep, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Oct, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Nov, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Dec, 2026"), 20],
                                                                                                                                                         [Date.parse("25 Jan, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Feb, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Mar, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Apr, 2027"), 20],
                                                                                                                                                         [Date.parse("25 May, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Jun, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Jul, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Aug, 2027"), 20]
                                                                                                                                                       ])
        expect(equity_grant).to have_attributes(vested_shares: 680, unvested_shares: 320)
        # On a final event date
        travel_to(DateTime.parse("25 Oct, 2028").beginning_of_day)
        expect do
          service.process
        end.to change { equity_grant.reload.vesting_events.processed.count }.by(14)
        expect(equity_grant.vesting_events.processed.where("vesting_date > ?", Date.parse("25 Aug, 2027")).pluck(:vesting_date, :vested_shares)).to eq([
                                                                                                                                                         [Date.parse("25 Sep, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Oct, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Nov, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Dec, 2027"), 20],
                                                                                                                                                         [Date.parse("25 Jan, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Feb, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Mar, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Apr, 2028"), 20],
                                                                                                                                                         [Date.parse("25 May, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Jun, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Jul, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Aug, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Sep, 2028"), 20],
                                                                                                                                                         [Date.parse("25 Oct, 2028"), 60]
                                                                                                                                                       ])
        expect(equity_grant).to have_attributes(vested_shares: 1000, unvested_shares: 0)
        expect(equity_grant.vesting_events.cancelled.count).to eq(0)
      end

      context "when number of unvested shares in the equity grant is less than the required shares for a vesting event" do
        before do
          # Assume some shares have already been vested apart from the schedule by some manual adjustments
          equity_grant.update!(unvested_shares: 900, vested_shares: 100)
        end

        it "cancels the applicable vesting events instead of marking them as processed" do
          travel_to(Date.parse("25 Oct, 2028")) # On the final event date
          expect { service.process }.to change { equity_grant.reload.vesting_events.processed.count }.by(34)
                                    .and change { equity_grant.vesting_events.cancelled.count }.by(3)
          expect(equity_grant.vesting_events.cancelled.pluck(:cancellation_reason).uniq).to eq(["not_enough_shares_available"])
        end
      end
    end

    context "when the equity grant has the vesting_trigger of invoice_paid" do
      let(:user) { create(:user) }
      let(:company) { create(:company) }
      let(:company_investor) { create(:company_investor, user:, company:) }
      let(:company_contractor) { create(:company_contractor, user:, company:) }
      let!(:invoice) { create(:invoice_with_equity, equity_amount_in_options: 123, company:, user:) }
      let!(:equity_grant) { create(:equity_grant, :vests_on_invoice_payment, number_of_shares: 1000, company_investor:) }
      let!(:post_invoice_payment_vesting_event) { create(:vesting_event, equity_grant:, vesting_date: Date.current, vested_shares: invoice.equity_amount_in_options) }

      it "processes the invoice payment vesting event" do
        expect { service.process }.to change { equity_grant.reload.vesting_events.processed.count }.by(1)
        expect(equity_grant.vesting_events.unprocessed.count).to eq(0)
        expect(equity_grant.vesting_events.processed.pluck(:vested_shares)).to eq([
                                                                                    123 # invoice payment vesting event
                                                                                  ])
        expect(equity_grant).to have_attributes(vested_shares: 123, unvested_shares: 877)

        # Processing another invoice payment would not re-process
        invoice2 = create(:invoice_with_equity, equity_amount_in_options: 25, company:, user:)
        post_invoice_payment_vesting_event2 = create(:vesting_event, equity_grant:, vesting_date: Date.current, vested_shares: invoice2.equity_amount_in_options)
        service = described_class.new(equity_grant:, invoice: invoice2, post_invoice_payment_vesting_event: post_invoice_payment_vesting_event2)
        expect { service.process }.to change { equity_grant.reload.vesting_events.processed.count }.by(1)
        expect(equity_grant.vesting_events.processed.pluck(:vested_shares)).to eq([
                                                                                    123, # previous invoice payment vesting event
                                                                                    25 # new invoice payment vesting event
                                                                                  ])
        expect(equity_grant).to have_attributes(vested_shares: 148, unvested_shares: 852)
      end
    end
  end
end
