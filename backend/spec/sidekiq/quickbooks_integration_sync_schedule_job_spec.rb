# frozen_string_literal: true

RSpec.describe QuickbooksIntegrationSyncScheduleJob do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:integration) { create(:quickbooks_integration, company:) }
    let!(:active_worker1) { create(:company_worker, company:) }
    let!(:active_worker2) { create(:company_worker, company:) }
    let!(:inactive_worker) { create(:company_worker, company:, ended_at: 1.day.ago) }

    before do
      allow(Company).to receive(:find).with(company.id).and_return(company)
      allow(company).to receive(:quickbooks_integration).and_return(integration)
      allow(company).to receive(:company_workers).and_return(double(active: [active_worker1, active_worker2]))
      allow(integration).to receive(:status_deleted?).and_return(false)
      allow(integration).to receive(:status_active!)
      allow(integration).to receive(:update!)
      allow(QuickbooksDataSyncJob).to receive(:perform_async)
    end

    context "when integration exists and is not deleted" do
      it "activates the integration" do
        described_class.new.perform(company.id)
        expect(integration).to have_received(:status_active!)
      end

      it "enqueues sync jobs for all active workers" do
        described_class.new.perform(company.id)

        expect(QuickbooksDataSyncJob).to have_received(:perform_async).with(company.id, active_worker1.class.name, active_worker1.id)
        expect(QuickbooksDataSyncJob).to have_received(:perform_async).with(company.id, active_worker2.class.name, active_worker2.id)
      end

      it "updates the integration's last sync timestamp" do
        freeze_time do
          described_class.new.perform(company.id)
          expect(integration).to have_received(:update!).with(last_sync_at: Time.current)
        end
      end
    end

    context "when integration does not exist" do
      before do
        allow(company).to receive(:quickbooks_integration).and_return(nil)
      end

      it "does not enqueue any sync jobs" do
        described_class.new.perform(company.id)
        expect(QuickbooksDataSyncJob).not_to have_received(:perform_async)
      end

      it "does not update the integration" do
        described_class.new.perform(company.id)
        expect(integration).not_to have_received(:status_active!)
        expect(integration).not_to have_received(:update!)
      end
    end

    context "when integration is deleted" do
      before do
        allow(integration).to receive(:status_deleted?).and_return(true)
      end

      it "does not enqueue any sync jobs" do
        described_class.new.perform(company.id)
        expect(QuickbooksDataSyncJob).not_to have_received(:perform_async)
      end

      it "does not update the integration" do
        described_class.new.perform(company.id)
        expect(integration).not_to have_received(:status_active!)
        expect(integration).not_to have_received(:update!)
      end
    end

    context "when there are no active workers" do
      before do
        allow(company).to receive(:company_workers).and_return(double(active: []))
      end

      it "does not enqueue any sync jobs" do
        described_class.new.perform(company.id)
        expect(QuickbooksDataSyncJob).not_to have_received(:perform_async)
      end

      it "does not update the integration timestamp" do
        described_class.new.perform(company.id)
        expect(integration).not_to have_received(:update!)
      end
    end
  end
end
