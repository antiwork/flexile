# frozen_string_literal: true

RSpec.describe EquityGrant::Vesting do
  subject(:equity_grant) { build(:equity_grant) }

  describe "associations" do
    it { is_expected.to belong_to(:vesting_schedule).optional }
    it { is_expected.to have_many(:vesting_events).dependent(:destroy) }
    it { is_expected.to have_many(:equity_grant_transactions) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:period_started_at) }
    it { is_expected.to validate_presence_of(:period_ended_at) }
    it { is_expected.to define_enum_for(:vesting_trigger).with_values(EquityGrant.vesting_triggers).backed_by_column_of_type(:enum).with_prefix(:vesting_trigger) }

    describe "vesting_schedule_presence" do
      it "validates presence of vesting_schedule when vesting_trigger is scheduled" do
        equity_grant.vesting_trigger = "scheduled"
        expect(equity_grant).to validate_presence_of(:vesting_schedule)
      end

      it "does not validate presence of vesting_schedule when vesting_trigger is not scheduled" do
        equity_grant.vesting_trigger = "invoice_paid"
        expect(equity_grant).not_to validate_presence_of(:vesting_schedule)
      end
    end

    describe "period_started_at_must_be_before_period_ended_at" do
      it "is invalid when period_started_at equals period_ended_at" do
        time = Time.current
        equity_grant.period_started_at = time
        equity_grant.period_ended_at = time

        expect(equity_grant).not_to be_valid
        expect(equity_grant.errors[:period_ended_at]).to include("must be after the period start date")
      end

      it "is invalid when period_started_at is after period_ended_at" do
        equity_grant.period_started_at = 1.day.from_now
        equity_grant.period_ended_at = 1.day.ago

        expect(equity_grant).not_to be_valid
        expect(equity_grant.errors[:period_ended_at]).to include("must be after the period start date")
      end

      it "is valid when period_started_at is before period_ended_at" do
        equity_grant.period_started_at = 1.day.ago
        equity_grant.period_ended_at = 1.day.from_now

        expect(equity_grant).to be_valid
      end
    end
  end

  describe "scopes" do
    describe "#period_not_ended" do
      it "returns equity grants with period_ended_at in the future" do
        create(:equity_grant, period_ended_at: 1.day.ago)
        period_ends_today = create(:equity_grant, period_ended_at: Time.current)
        period_ends_in_the_future = create(:equity_grant, period_ended_at: 1.day.from_now)

        expect(EquityGrant.period_not_ended).to eq([period_ends_today, period_ends_in_the_future])
      end
    end
  end

  describe "#build_vesting_events" do
    context "when vesting_trigger is invoice_paid" do
      let(:equity_grant) { create(:equity_grant, :vests_on_invoice_payment, number_of_shares: 1026) }

      it "builds no events" do
        expect(equity_grant.build_vesting_events).to be_empty
      end
    end

    context "when vesting_trigger is scheduled" do
      let(:number_of_shares) { 1000 }
      let(:cliff_duration_months) { 12 }
      let(:vesting_frequency_months) { 1 }
      let(:total_vesting_duration_months) { 48 }
      let(:vesting_schedule) do
        create(:vesting_schedule,
               total_vesting_duration_months:,
               cliff_duration_months:,
               vesting_frequency_months:)
      end
      let(:equity_grant) do
        create(:equity_grant, :vests_as_per_schedule,
               number_of_shares:,
               vesting_schedule:,
               period_started_at: Date.new(2024, 1, 1).beginning_of_day,
               period_ended_at: (Date.new(2024, 1, 1) + total_vesting_duration_months.months).end_of_day)
      end

      context "with monthly vesting frequency" do
        context "with cliff vesting" do
          it "builds cliff vesting event followed by monthly vesting events" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2025, 1, 1), 240], # cliff vesting (monthly vesting * 12 months)
                                                                        [Date.new(2025, 2, 1), 20], # monthly vesting after cliff (number of shares / total vesting duration months)
                                                                        [Date.new(2025, 3, 1), 20],
                                                                        [Date.new(2025, 4, 1), 20],
                                                                        [Date.new(2025, 5, 1), 20],
                                                                        [Date.new(2025, 6, 1), 20],
                                                                        [Date.new(2025, 7, 1), 20],
                                                                        [Date.new(2025, 8, 1), 20],
                                                                        [Date.new(2025, 9, 1), 20],
                                                                        [Date.new(2025, 10, 1), 20],
                                                                        [Date.new(2025, 11, 1), 20],
                                                                        [Date.new(2025, 12, 1), 20],
                                                                        [Date.new(2026, 1, 1), 20],
                                                                        [Date.new(2026, 2, 1), 20],
                                                                        [Date.new(2026, 3, 1), 20],
                                                                        [Date.new(2026, 4, 1), 20],
                                                                        [Date.new(2026, 5, 1), 20],
                                                                        [Date.new(2026, 6, 1), 20],
                                                                        [Date.new(2026, 7, 1), 20],
                                                                        [Date.new(2026, 8, 1), 20],
                                                                        [Date.new(2026, 9, 1), 20],
                                                                        [Date.new(2026, 10, 1), 20],
                                                                        [Date.new(2026, 11, 1), 20],
                                                                        [Date.new(2026, 12, 1), 20],
                                                                        [Date.new(2027, 1, 1), 20],
                                                                        [Date.new(2027, 2, 1), 20],
                                                                        [Date.new(2027, 3, 1), 20],
                                                                        [Date.new(2027, 4, 1), 20],
                                                                        [Date.new(2027, 5, 1), 20],
                                                                        [Date.new(2027, 6, 1), 20],
                                                                        [Date.new(2027, 7, 1), 20],
                                                                        [Date.new(2027, 8, 1), 20],
                                                                        [Date.new(2027, 9, 1), 20],
                                                                        [Date.new(2027, 10, 1), 20],
                                                                        [Date.new(2027, 11, 1), 20],
                                                                        [Date.new(2027, 12, 1), 20],
                                                                        [Date.new(2028, 1, 1), 60],
                                                                      ])
            expect(events.size).to eq(37)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end

        context "without cliff vesting" do
          let(:cliff_duration_months) { 0 }

          it "builds monthly vesting events" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2024, 2, 1), 20],  # monthly vesting starts immediately
                                                                        [Date.new(2024, 3, 1), 20],
                                                                        [Date.new(2024, 4, 1), 20],
                                                                        [Date.new(2024, 5, 1), 20],
                                                                        [Date.new(2024, 6, 1), 20],
                                                                        [Date.new(2024, 7, 1), 20],
                                                                        [Date.new(2024, 8, 1), 20],
                                                                        [Date.new(2024, 9, 1), 20],
                                                                        [Date.new(2024, 10, 1), 20],
                                                                        [Date.new(2024, 11, 1), 20],
                                                                        [Date.new(2024, 12, 1), 20],
                                                                        [Date.new(2025, 1, 1), 20],
                                                                        [Date.new(2025, 2, 1), 20],
                                                                        [Date.new(2025, 3, 1), 20],
                                                                        [Date.new(2025, 4, 1), 20],
                                                                        [Date.new(2025, 5, 1), 20],
                                                                        [Date.new(2025, 6, 1), 20],
                                                                        [Date.new(2025, 7, 1), 20],
                                                                        [Date.new(2025, 8, 1), 20],
                                                                        [Date.new(2025, 9, 1), 20],
                                                                        [Date.new(2025, 10, 1), 20],
                                                                        [Date.new(2025, 11, 1), 20],
                                                                        [Date.new(2025, 12, 1), 20],
                                                                        [Date.new(2026, 1, 1), 20],
                                                                        [Date.new(2026, 2, 1), 20],
                                                                        [Date.new(2026, 3, 1), 20],
                                                                        [Date.new(2026, 4, 1), 20],
                                                                        [Date.new(2026, 5, 1), 20],
                                                                        [Date.new(2026, 6, 1), 20],
                                                                        [Date.new(2026, 7, 1), 20],
                                                                        [Date.new(2026, 8, 1), 20],
                                                                        [Date.new(2026, 9, 1), 20],
                                                                        [Date.new(2026, 10, 1), 20],
                                                                        [Date.new(2026, 11, 1), 20],
                                                                        [Date.new(2026, 12, 1), 20],
                                                                        [Date.new(2027, 1, 1), 20],
                                                                        [Date.new(2027, 2, 1), 20],
                                                                        [Date.new(2027, 3, 1), 20],
                                                                        [Date.new(2027, 4, 1), 20],
                                                                        [Date.new(2027, 5, 1), 20],
                                                                        [Date.new(2027, 6, 1), 20],
                                                                        [Date.new(2027, 7, 1), 20],
                                                                        [Date.new(2027, 8, 1), 20],
                                                                        [Date.new(2027, 9, 1), 20],
                                                                        [Date.new(2027, 10, 1), 20],
                                                                        [Date.new(2027, 11, 1), 20],
                                                                        [Date.new(2027, 12, 1), 20],
                                                                        [Date.new(2028, 1, 1), 60],
                                                                      ])
            expect(events.size).to eq(48)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end
      end

      context "with quarterly vesting frequency" do
        let(:vesting_frequency_months) { 3 }

        context "with cliff vesting" do
          it "builds cliff vesting event followed by quarterly vesting events" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2025, 1, 1), 248], # cliff vesting
                                                                        [Date.new(2025, 4, 1), 62],  # quarterly vesting after cliff
                                                                        [Date.new(2025, 7, 1), 62],
                                                                        [Date.new(2025, 10, 1), 62],
                                                                        [Date.new(2026, 1, 1), 62],
                                                                        [Date.new(2026, 4, 1), 62],
                                                                        [Date.new(2026, 7, 1), 62],
                                                                        [Date.new(2026, 10, 1), 62],
                                                                        [Date.new(2027, 1, 1), 62],
                                                                        [Date.new(2027, 4, 1), 62],
                                                                        [Date.new(2027, 7, 1), 62],
                                                                        [Date.new(2027, 10, 1), 62],
                                                                        [Date.new(2028, 1, 1), 70],
                                                                      ])
            expect(events.size).to eq(13)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end

        context "without cliff vesting" do
          let(:cliff_duration_months) { 0 }

          it "builds quarterly vesting events starting immediately" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2024, 4, 1), 62],  # quarterly vesting starts immediately
                                                                        [Date.new(2024, 7, 1), 62],
                                                                        [Date.new(2024, 10, 1), 62],
                                                                        [Date.new(2025, 1, 1), 62],
                                                                        [Date.new(2025, 4, 1), 62],
                                                                        [Date.new(2025, 7, 1), 62],
                                                                        [Date.new(2025, 10, 1), 62],
                                                                        [Date.new(2026, 1, 1), 62],
                                                                        [Date.new(2026, 4, 1), 62],
                                                                        [Date.new(2026, 7, 1), 62],
                                                                        [Date.new(2026, 10, 1), 62],
                                                                        [Date.new(2027, 1, 1), 62],
                                                                        [Date.new(2027, 4, 1), 62],
                                                                        [Date.new(2027, 7, 1), 62],
                                                                        [Date.new(2027, 10, 1), 62],
                                                                        [Date.new(2028, 1, 1), 70],
                                                                      ])
            expect(events.size).to eq(16)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end
      end

      context "with annually vesting frequency" do
        let(:vesting_frequency_months) { 12 }

        context "with cliff vesting" do
          let(:cliff_duration_months) { 6 }

          it "builds cliff vesting event followed by annual vesting events" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2025, 1, 1), 250], # cliff vesting
                                                                        [Date.new(2026, 1, 1), 250], # annual vesting after cliff
                                                                        [Date.new(2027, 1, 1), 250],
                                                                        [Date.new(2028, 1, 1), 250],
                                                                      ])
            expect(events.size).to eq(4)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end

        context "without cliff vesting" do
          let(:cliff_duration_months) { 0 }

          it "builds annual vesting events starting immediately" do
            events = equity_grant.build_vesting_events
            expect(events.pluck(:vesting_date, :vested_shares)).to eq([
                                                                        [Date.new(2025, 1, 1), 250], # annual vesting starts immediately
                                                                        [Date.new(2026, 1, 1), 250],
                                                                        [Date.new(2027, 1, 1), 250],
                                                                        [Date.new(2028, 1, 1), 250],
                                                                      ])
            expect(events.size).to eq(4)
            expect(events.sum(&:vested_shares)).to eq(1000)
            expect(equity_grant.period_ended_at.to_date).to eq(Date.new(2028, 1, 1))
            expect(events.last.vesting_date).to eq(equity_grant.period_ended_at.to_date)
          end
        end
      end
    end
  end
end
