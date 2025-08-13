# frozen_string_literal: true

require "spec_helper"

RSpec.describe QuickbooksWorkersSyncJob, type: :sidekiq do
  include ActiveJob::TestHelper

  let(:company) { create(:company) }
  let(:integration) { create(:quickbooks_integration, company: company, status: "active") }
  let(:worker1) { create(:company_worker, company: company) }
  let(:worker2) { create(:company_worker, company: company) }
  let(:active_worker_ids) { [worker1.id, worker2.id] }

  before do
    # Mock the standard sync_data_for method
    allow_any_instance_of(IntegrationApi::Quickbooks).to receive(:sync_data_for)
  end

  describe "#perform" do
    context "when integration is active" do
      it "processes all worker IDs using standard sync" do
        expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:sync_data_for).with(object: worker1)
        expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:sync_data_for).with(object: worker2)

        described_class.new.perform(company.id, active_worker_ids)
      end

      it "updates integration last_sync_at" do
        integration # Ensure integration is created
        freeze_time do
          described_class.new.perform(company.id, active_worker_ids)
          expect(integration.reload.last_sync_at).to be_within(1.second).of(Time.current)
        end
      end
    end

    context "when integration is nil" do
      before { integration.destroy }

      it "returns early without processing" do
        expect_any_instance_of(IntegrationApi::Quickbooks).not_to receive(:sync_data_for)
        described_class.new.perform(company.id, active_worker_ids)
      end
    end

    context "when integration is not active" do
      before { integration.update!(status: "out_of_sync") }

      it "returns early without processing" do
        expect_any_instance_of(IntegrationApi::Quickbooks).not_to receive(:sync_data_for)
        described_class.new.perform(company.id, active_worker_ids)
      end
    end
  end




end
