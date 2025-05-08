# frozen_string_literal: true

RSpec.describe CompanyWorkerUpdatesForPeriod, type: :model do
  let(:company_worker) { create(:company_worker) }
  let(:period) { CompanyWorkerUpdatePeriod.new }
  let(:subject) { described_class.new(company_worker:, period:) }

  describe "validations" do
    it { is_expected.to validate_presence_of(:company_worker) }
    it { is_expected.to validate_presence_of(:period) }
  end

  describe "#current_update" do
    let!(:current_update) do
      create(:company_worker_update, company_worker:, period:)
    end

    it "returns the current published update for the given period" do
      expect(subject.current_update).to eq(current_update)
    end

    it "returns nil if no published update exists for the current period" do
      current_update.update!(published_at: nil)
      expect(subject.current_update).to be_nil
    end
  end

  describe "#prev_update" do
    let!(:prev_update) do
      create(:company_worker_update, company_worker:, period: period.prev_period)
    end

    it "returns the previous published update for the given period" do
      expect(subject.prev_update).to eq(prev_update)
    end

    it "returns nil if no published update exists for the previous period" do
      prev_update.update!(published_at: nil)
      expect(subject.prev_update).to be_nil
    end
  end
end
