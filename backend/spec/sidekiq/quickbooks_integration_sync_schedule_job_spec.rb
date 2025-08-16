# frozen_string_literal: true

RSpec.describe QuickbooksIntegrationSyncScheduleJob do
  let(:company) { create(:company) }
  let(:integration) { create(:quickbooks_integration, company: company, status: "out_of_sync") }
  let(:worker1) { create(:company_worker, company: company) }
  let(:worker2) { create(:company_worker, company: company) }

  describe "#perform" do
    context "when integration exists and is not deleted" do
      before { integration }

      it "activates the integration" do
        expect {
          described_class.new.perform(company.id)
        }.to change { integration.reload.status }.from("out_of_sync").to("active")
      end

      context "when there are active workers" do
        before do
          worker1
          worker2
        end

        it "enqueues QuickbooksDataSyncJob for each worker" do
          described_class.new.perform(company.id)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company.id, "CompanyWorker", worker1.id)
          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company.id, "CompanyWorker", worker2.id)
        end
      end

      context "when there are no active workers" do
        it "does not enqueue any QuickbooksDataSyncJob" do
          expect { described_class.new.perform(company.id) }
            .not_to change { QuickbooksDataSyncJob.jobs.size }
        end
      end

      context "when some workers are ended" do
        before do
          worker1
          worker2.update!(ended_at: 1.day.ago)
        end

        it "only includes active workers in the sync job" do
          described_class.new.perform(company.id)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company.id, "CompanyWorker", worker1.id)
          expect(QuickbooksDataSyncJob).not_to have_enqueued_sidekiq_job(company.id, "CompanyWorker", worker2.id)
        end
      end
    end

    context "when integration is nil" do
      it "returns early without processing" do
        expect { described_class.new.perform(company.id) }
          .not_to change { QuickbooksDataSyncJob.jobs.size }
      end
    end

    context "when integration is deleted" do
      before do
        integration.update!(status: "deleted")
      end

      it "returns early without processing" do
        expect { described_class.new.perform(company.id) }
          .not_to change { QuickbooksDataSyncJob.jobs.size }
      end
    end

    context "when company does not exist" do
      it "raises ActiveRecord::RecordNotFound" do
        expect {
          described_class.new.perform(999999)
        }.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
