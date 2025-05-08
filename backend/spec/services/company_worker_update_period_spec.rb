# frozen_string_literal: true

RSpec.describe CompanyWorkerUpdatePeriod do
  let(:date) { Date.new(2023, 5, 10) } # A Wednesday
  subject(:period) { described_class.new(date:) }

  describe "#starts_on" do
    it "returns the start of the week (Sunday) for the given date" do
      expect(period.starts_on).to eq(Date.new(2023, 5, 7))
    end
  end

  describe "#ends_on" do
    it "returns the end of the week (Saturday) for the given date" do
      expect(period.ends_on).to eq(Date.new(2023, 5, 13))
    end
  end

  describe "#prev_period_starts_on" do
    it "returns the start of the previous week" do
      expect(period.prev_period_starts_on).to eq(Date.new(2023, 4, 30))
    end
  end

  describe "#prev_period_ends_on" do
    it "returns the day before the start of the current period" do
      expect(period.prev_period_ends_on).to eq(Date.new(2023, 5, 6))
    end
  end

  describe "#next_period_starts_on" do
    it "returns the start of the next week" do
      expect(period.next_period_starts_on).to eq(Date.new(2023, 5, 14))
    end
  end

  describe "#next_period_ends_on" do
    it "returns the end of the next week" do
      expect(period.next_period_ends_on).to eq(Date.new(2023, 5, 20))
    end
  end

  describe "#relative_weeks" do
    let(:today) { Date.new(2023, 5, 10) } # A Wednesday

    before do
      allow(Date).to receive(:today).and_return(today)
    end

    it "returns -1 for a period starting last week" do
      last_week_period = described_class.new(date: today - 1.week)
      expect(last_week_period.relative_weeks).to eq(-1)
    end

    it "returns 0 for a period starting this week" do
      this_week_period = described_class.new(date: today)
      expect(this_week_period.relative_weeks).to eq(0)
    end

    it "returns 1 for a period starting next week" do
      next_week_period = described_class.new(date: today + 1.week)
      expect(next_week_period.relative_weeks).to eq(1)
    end
  end

  describe "#current_or_future_period?" do
    context "when the period is in the future" do
      let(:future_date) { Date.today + 1.week }
      let(:future_period) { described_class.new(date: future_date) }

      it "returns true" do
        expect(future_period.current_or_future_period?).to be true
      end
    end

    context "when the period is current" do
      let(:current_period) { described_class.new(date: Date.today) }

      it "returns true" do
        expect(current_period.current_or_future_period?).to be true
      end
    end

    context "when the period is in the past" do
      let(:past_date) { Date.today - 1.week }
      let(:past_period) { described_class.new(date: past_date) }

      it "returns false" do
        expect(past_period.current_or_future_period?).to be false
      end
    end
  end

  describe "#prev_period" do
    it "returns a new CompanyWorkerUpdatePeriod for the previous week" do
      prev_period = period.prev_period
      expect(prev_period).to be_a(CompanyWorkerUpdatePeriod)
      expect(prev_period.starts_on).to eq(Date.new(2023, 4, 30))
      expect(prev_period.ends_on).to eq(Date.new(2023, 5, 6))
    end
  end

  describe "#next_period" do
    it "returns a new CompanyWorkerUpdatePeriod for the next week" do
      next_period = period.next_period
      expect(next_period).to be_a(CompanyWorkerUpdatePeriod)
      expect(next_period.starts_on).to eq(Date.new(2023, 5, 14))
      expect(next_period.ends_on).to eq(Date.new(2023, 5, 20))
    end
  end
end
