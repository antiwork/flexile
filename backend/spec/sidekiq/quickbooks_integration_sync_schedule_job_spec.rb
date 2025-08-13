# frozen_string_literal: true

require "spec_helper"

RSpec.describe QuickbooksIntegrationSyncScheduleJob, type: :sidekiq do
  let(:company) { create(:company) }
  let(:integration) { create(:quickbooks_integration, company: company, status: "out_of_sync") }
  let(:worker1) { create(:company_worker, company: company) }
  let(:worker2) { create(:company_worker, company: company) }

  describe "#perform" do
    context "when integration exists and is not deleted" do
      before { integration }

      it "activates the integration" do
        expect do
          described_class.new.perform(company.id)
        end.to change { integration.reload.status }.from("out_of_sync").to("active")
      end

      context "when there are active workers" do
        before do
          worker1
          worker2
        end

        it "enqueues QuickbooksWorkersSyncJob with active worker IDs" do
          expect(QuickbooksWorkersSyncJob).to receive(:perform_async).with(
            company.id,
            contain_exactly(worker1.id, worker2.id)
          )

          described_class.new.perform(company.id)
        end
      end

      context "when there are no active workers" do
        it "does not enqueue QuickbooksWorkersSyncJob" do
          expect(QuickbooksWorkersSyncJob).not_to receive(:perform_async)

          described_class.new.perform(company.id)
          expect(integration.reload.status).to eq("active")
        end
      end

      context "when some workers are ended" do
        before do
          worker1
          worker2.update!(ended_at: 1.day.ago)
        end

        it "only includes active workers in the sync job" do
          expect(QuickbooksWorkersSyncJob).to receive(:perform_async).with(
            company.id,
            [worker1.id]
          )

          described_class.new.perform(company.id)
        end
      end

      context "when there are many workers requiring batching" do
        let!(:workers) { create_list(:company_worker, 250, company: company) }

        it "batches workers into multiple jobs" do
          # Expect 3 batches: 2 full batches of 100 and 1 partial batch of 50
          expect(QuickbooksWorkersSyncJob).to receive(:perform_async).exactly(3).times

          described_class.new.perform(company.id)
        end

        it "respects the batch size" do
          batches = []
          allow(QuickbooksWorkersSyncJob).to receive(:perform_async) do |company_id, worker_ids|
            batches << worker_ids.size
          end

          described_class.new.perform(company.id)

          total = workers.size
          size = QuickbooksIntegrationSyncScheduleJob::BATCH_SIZE
          full, rem = total.divmod(size)
          expected = ([size] * full) + (rem.positive? ? [rem] : [])
          expect(batches).to eq(expected)
        end
      end
    end

    context "when integration is nil" do
      before { company.quickbooks_integration&.destroy! }

      it "returns early without processing" do
        expect(QuickbooksWorkersSyncJob).not_to receive(:perform_async)

        described_class.new.perform(company.id)
      end
    end

    context "when integration is deleted" do
      before do
        integration.update!(status: "deleted")
      end

      it "returns early without processing" do
        expect(QuickbooksWorkersSyncJob).not_to receive(:perform_async)

        described_class.new.perform(company.id)
      end
    end

    context "when company does not exist" do
      it "returns early without processing" do
        expect(QuickbooksWorkersSyncJob).not_to receive(:perform_async)

        described_class.new.perform(999999)
      end
    end
  end

  describe "job configuration" do
    it "has correct retry configuration" do
      expect(described_class.sidekiq_options["retry"]).to eq(5)
    end

    it "includes Sidekiq::Job" do
      expect(described_class.included_modules).to include(Sidekiq::Job)
    end
  end
end
