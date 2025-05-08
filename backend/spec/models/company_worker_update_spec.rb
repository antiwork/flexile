# frozen_string_literal: true

require "shared_examples/timestamp_state_fields_examples"

RSpec.describe CompanyWorkerUpdate, type: :model do
  describe "associations" do
    it { is_expected.to belong_to(:company_worker) }
    it { is_expected.to have_many(:company_worker_update_tasks).dependent(:destroy) }

    describe "#prev_update" do
      it "returns the user's previous update for the company" do
        company_worker = create(:company_worker)
        update = create(:company_worker_update, company_worker:, period_starts_on: CompanyWorkerUpdatePeriod.new.starts_on)
        prev_update = create(:company_worker_update, company_worker:, period_starts_on: CompanyWorkerUpdatePeriod.new(date: 1.week.ago).starts_on)
        create(:company_worker_update, company_worker:, period_starts_on: CompanyWorkerUpdatePeriod.new(date: 2.weeks.ago).starts_on)

        other_company_worker = create(:company_worker, user: company_worker.user)
        create(:company_worker_update, company_worker: other_company_worker, period_starts_on: CompanyWorkerUpdatePeriod.new(date: 1.week.ago).starts_on)

        expect(update.prev_update).to eq(prev_update)
      end
    end

    describe "#absences" do
      it "returns the absences for the update period" do
        update = create(:company_worker_update)
        overlapping_absences = [
          create(:company_worker_absence, company_worker: update.company_worker,
                                          starts_on: update.period_starts_on - 7.days,
                                          ends_on: update.period_starts_on + 1.day),
          create(:company_worker_absence, company_worker: update.company_worker,
                                          starts_on: update.period_starts_on + 3.days,
                                          ends_on: update.period_starts_on + 4.days),
          create(:company_worker_absence, company_worker: update.company_worker,
                                          starts_on: update.period_ends_on - 1.day,
                                          ends_on: update.period_ends_on + 4.days),
        ]
        create(:company_worker_absence, company_worker: update.company_worker,
                                        starts_on: update.period_starts_on - 4.weeks,
                                        ends_on: update.period_starts_on - 3.weeks)
        create(:company_worker_absence, company_worker: update.company_worker,
                                        starts_on: update.period_ends_on + 3.weeks,
                                        ends_on: update.period_ends_on + 4.weeks)
        expect(update.absences).to match_array(overlapping_absences)
      end
    end
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:period_starts_on) }

    context "when another record exists" do
      before { create(:company_worker_update) }
      it { is_expected.to validate_uniqueness_of(:period_starts_on).scoped_to(:company_contractor_id) }
    end
  end

  describe "timestamp state fields" do
    let(:default_state) { :draft }
    let(:fields) do [
      { name: :deleted, records: [create(:company_worker_update, published_at: nil, deleted_at: Time.current)] },
      { name: :published, records: [create(:company_worker_update, published_at: Time.current)] },
    ]
    end

    include_examples "timestamp state field"
  end

  describe "callbacks" do
    describe "#set_company" do
      let(:company) { create(:company) }
      let(:company_worker) { create(:company_worker, company:) }
      let(:company_worker_update) { build(:company_worker_update, company_worker:, company: nil) }

      it "sets company_id on create" do
        company_worker_update.save!
        expect(company_worker_update.company_id).to eq(company.id)
      end
    end
  end

  describe "scopes" do
    describe ".published" do
      it "returns only the published updates" do
        published_update = create(:company_worker_update, published_at: Time.current)
        create(:company_worker_update, published_at: nil)

        expect(described_class.published).to eq([published_update])
      end
    end
  end
end
