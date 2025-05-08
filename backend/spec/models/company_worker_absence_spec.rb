# frozen_string_literal: true

RSpec.describe CompanyWorkerAbsence, type: :model do
  describe "associations" do
    it { should belong_to(:company_worker) }
  end

  describe "validations" do
    it { should validate_presence_of(:company_worker) }
    it { should validate_presence_of(:starts_on) }
    it { should validate_presence_of(:ends_on) }

    context "starts_on_not_after_ends_on" do
      it "validates that starts_on is not after ends_on" do
        absence = build(:company_worker_absence, starts_on: Date.tomorrow, ends_on: Date.today)
        absence.valid?
        expect(absence.errors[:starts_on]).to include("must be less than or equal to the end date")
      end

      it "allows starts_on to be equal to ends_on" do
        absence = build(:company_worker_absence, starts_on: Date.today, ends_on: Date.today)
        expect(absence).to be_valid
      end

      it "allows starts_on to be before ends_on" do
        absence = build(:company_worker_absence, starts_on: Date.today, ends_on: Date.tomorrow)
        expect(absence).to be_valid
      end
    end

    context "no_overlapping_periods" do
      let(:company_worker) { create(:company_worker) }
      let!(:existing_absence) { create(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 1), ends_on: Date.new(2023, 1, 10)) }

      it "validates that there are no overlapping periods for the same company_worker" do
        overlapping_absence = build(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 5), ends_on: Date.new(2023, 1, 15))
        expect(overlapping_absence).not_to be_valid
        expect(overlapping_absence.errors[:base]).to include("Overlaps with an existing absence")
      end

      it "allows non-overlapping periods for the same company_worker" do
        non_overlapping_absence = build(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 11), ends_on: Date.new(2023, 1, 20))
        expect(non_overlapping_absence).to be_valid
      end

      it "allows overlapping periods for different company_workers" do
        other_company_worker = create(:company_worker)
        overlapping_absence = build(:company_worker_absence, company_worker: other_company_worker, starts_on: Date.new(2023, 1, 5), ends_on: Date.new(2023, 1, 15))
        expect(overlapping_absence).to be_valid
      end

      it "considers an absence overlapping if it starts on the end date of an existing absence" do
        overlapping_absence = build(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 10), ends_on: Date.new(2023, 1, 15))
        expect(overlapping_absence).not_to be_valid
        expect(overlapping_absence.errors[:base]).to include("Overlaps with an existing absence")
      end

      it "considers an absence overlapping if it ends on the start date of an existing absence" do
        overlapping_absence = build(:company_worker_absence, company_worker:, starts_on: Date.new(2022, 12, 25), ends_on: Date.new(2023, 1, 1))
        expect(overlapping_absence).not_to be_valid
        expect(overlapping_absence.errors[:base]).to include("Overlaps with an existing absence")
      end
    end
  end

  describe "callbacks" do
    describe "#set_company" do
      let(:company) { create(:company) }
      let(:company_worker) { create(:company_worker, company:) }
      let(:company_worker_absence) { build(:company_worker_absence, company_worker:, company: nil) }

      it "sets company_id on create" do
        company_worker_absence.save!
        expect(company_worker_absence.company_id).to eq(company.id)
      end
    end
  end

  describe "scopes" do
    describe ".for_period" do
      let(:company_worker) { create(:company_worker) }

      context "when there are overlapping absences" do
        let!(:absence1) { create(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 1), ends_on: Date.new(2023, 1, 10)) }
        let!(:absence2) { create(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 15), ends_on: Date.new(2023, 1, 20)) }

        it "returns absences that fully overlap with the given period" do
          overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2022, 12, 31), ends_on: Date.new(2023, 1, 11))
          expect(overlapping).to include(absence1)
          expect(overlapping).not_to include(absence2)
        end

        it "returns absences that are fully contained within the given period" do
          overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2022, 12, 31), ends_on: Date.new(2023, 1, 25))
          expect(overlapping).to include(absence1, absence2)
        end

        it "returns absences that partially overlap at the start of the given period" do
          overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2023, 1, 5), ends_on: Date.new(2023, 1, 14))
          expect(overlapping).to include(absence1)
          expect(overlapping).not_to include(absence2)
        end

        it "returns absences that partially overlap at the end of the given period" do
          overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2023, 1, 18), ends_on: Date.new(2023, 1, 25))
          expect(overlapping).to include(absence2)
          expect(overlapping).not_to include(absence1)
        end

        it "returns absences that start or end on the boundaries of the given period" do
          overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2023, 1, 10), ends_on: Date.new(2023, 1, 15))
          expect(overlapping).to include(absence1, absence2)
        end
      end

      context "when there are no overlapping absences" do
        let!(:absence) { create(:company_worker_absence, company_worker:, starts_on: Date.new(2023, 1, 1), ends_on: Date.new(2023, 1, 10)) }

        it "returns an empty relation" do
          non_overlapping = CompanyWorkerAbsence.for_period(starts_on: Date.new(2023, 1, 11), ends_on: Date.new(2023, 1, 20))
          expect(non_overlapping).to be_empty
        end
      end
    end

    describe ".for_current_period" do
      it "returns absences that overlap with the current period" do
        period = CompanyWorkerUpdatePeriod.new
        absences = [
          create(:company_worker_absence, starts_on: period.starts_on - 1.day, ends_on: period.starts_on + 1.day),
          create(:company_worker_absence, starts_on: period.starts_on, ends_on: period.ends_on),
          create(:company_worker_absence, starts_on: period.ends_on - 1.day, ends_on: period.ends_on + 1.day)
        ]
        create(:company_worker_absence, starts_on: period.starts_on - 5.days, ends_on: period.starts_on - 1.day)
        create(:company_worker_absence, starts_on: period.ends_on + 1.day, ends_on: period.ends_on + 2.days)

        expect(CompanyWorkerAbsence.for_current_period).to match_array(absences)
      end
    end

    describe ".for_current_and_future_periods" do
      it "returns absences that start on or after the beginning of the current period" do
        period = CompanyWorkerUpdatePeriod.new
        current_absence = create(:company_worker_absence, starts_on: period.starts_on - 1.day, ends_on: period.starts_on + 1.day)
        future_absence = create(:company_worker_absence, starts_on: period.ends_on + 1.week, ends_on: period.ends_on + 2.weeks)
        create(:company_worker_absence, starts_on: period.starts_on - 2.weeks, ends_on: period.starts_on - 1.day)

        expect(CompanyWorkerAbsence.for_current_and_future_periods).to match_array([current_absence, future_absence])
      end
    end
  end
end
