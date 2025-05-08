# frozen_string_literal: true

RSpec.describe VestingSchedule do
  describe "associations" do
    it { is_expected.to have_many(:equity_grants) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:total_vesting_duration_months) }
    it { is_expected.to validate_numericality_of(:total_vesting_duration_months).is_greater_than(0).is_less_than_or_equal_to(120) }
    it { is_expected.to validate_presence_of(:cliff_duration_months) }
    it { is_expected.to validate_numericality_of(:cliff_duration_months).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_inclusion_of(:vesting_frequency_months).in_array([1, 3, 12]) }

    context "when another record exists" do
      before { create(:vesting_schedule) }

      it { is_expected.to validate_uniqueness_of(:total_vesting_duration_months).scoped_to([:cliff_duration_months, :vesting_frequency_months]) }
    end

    describe "#cliff_duration_not_exceeding_total_duration" do
      subject(:vesting_schedule) { build(:vesting_schedule) }

      context "when cliff duration exceeds total vesting duration" do
        before do
          vesting_schedule.cliff_duration_months = vesting_schedule.total_vesting_duration_months + 1
        end

        it "is not valid" do
          expect(vesting_schedule).not_to be_valid
          expect(vesting_schedule.errors[:cliff_duration_months]).to include("must be less than total vesting duration")
        end
      end

      context "when cliff duration equals total vesting duration" do
        before do
          vesting_schedule.cliff_duration_months = vesting_schedule.total_vesting_duration_months
        end

        it "is not valid" do
          expect(vesting_schedule).not_to be_valid
          expect(vesting_schedule.errors[:cliff_duration_months]).to include("must be less than total vesting duration")
        end
      end

      context "when cliff duration is less than total vesting duration" do
        before do
          vesting_schedule.cliff_duration_months = vesting_schedule.total_vesting_duration_months - 1
        end

        it "is valid" do
          expect(vesting_schedule).to be_valid
        end
      end
    end

    describe "#vesting_frequency_months_not_exceeding_total_duration" do
      subject(:vesting_schedule) { build(:vesting_schedule, total_vesting_duration_months: 3, cliff_duration_months: 0) }

      context "when vesting frequency exceeds total vesting duration" do
        before do
          vesting_schedule.vesting_frequency_months = 6
        end

        it "is not valid" do
          expect(vesting_schedule).not_to be_valid
          expect(vesting_schedule.errors[:vesting_frequency_months]).to include("must be less than total vesting duration")
        end
      end

      context "when vesting frequency equals total vesting duration" do
        before do
          vesting_schedule.vesting_frequency_months = 3
        end

        it "is valid" do
          expect(vesting_schedule).to be_valid
        end
      end

      context "when vesting frequency is less than total vesting duration" do
        before do
          vesting_schedule.vesting_frequency_months = 1
        end

        it "is valid" do
          expect(vesting_schedule).to be_valid
        end
      end
    end
  end
end
