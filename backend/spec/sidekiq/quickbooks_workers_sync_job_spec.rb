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
    allow(IntegrationApi::Quickbooks).to receive(:new).and_return(
      instance_double(IntegrationApi::Quickbooks, sync_data_for: true)
    )
  end

  describe "#perform" do
    context "when integration is active" do
      before do
        config = integration.configuration || {}
        config["consulting_services_expense_account_id"] = "1"
        config["flexile_fees_expense_account_id"] = "1"
        config["default_bank_account_id"] = "1"
        integration.update_columns(status: "active", configuration: config)
      end

      it "processes all worker IDs" do
        worker1
        worker2

        quickbooks_service = instance_double(IntegrationApi::Quickbooks)
        allow(IntegrationApi::Quickbooks).to receive(:new).with(company_id: company.id).and_return(quickbooks_service)
        expect(quickbooks_service).to receive(:sync_data_for).with(object: worker1)
        expect(quickbooks_service).to receive(:sync_data_for).with(object: worker2)

        described_class.new.perform(company.id, active_worker_ids)
      end

      it "updates integration last_sync_at" do
        integration

        freeze_time do
          described_class.new.perform(company.id, active_worker_ids)

          expect(integration.reload.last_sync_at).to be_within(1.second).of(Time.current)
        end
      end

      it "skips non-existent workers" do
        worker1
        non_existent_id = 999999


        expect do
          described_class.new.perform(company.id, [worker1.id, non_existent_id])
        end.not_to raise_error
      end

      it "skips inactive workers" do
        worker1
        worker2.update!(ended_at: 1.day.ago)

        quickbooks_service = instance_double(IntegrationApi::Quickbooks)
        allow(IntegrationApi::Quickbooks).to receive(:new).with(company_id: company.id).and_return(quickbooks_service)
        expect(quickbooks_service).to receive(:sync_data_for).with(object: worker1).once

        described_class.new.perform(company.id, [worker1.id, worker2.id])
      end
    end

    context "when integration is nil" do
      before { integration.destroy }

      it "returns early without processing" do
        expect(IntegrationApi::Quickbooks).not_to receive(:new)

        described_class.new.perform(company.id, active_worker_ids)
      end

      it "does not update last_sync_at" do
        described_class.new.perform(company.id, active_worker_ids)
      end
    end

    context "when integration is not active" do
      before { integration.update!(status: "out_of_sync") }

      it "returns early without processing" do
        expect(IntegrationApi::Quickbooks).not_to receive(:new)

        described_class.new.perform(company.id, active_worker_ids)
      end

      it "does not update last_sync_at" do
        original_time = integration.last_sync_at

        described_class.new.perform(company.id, active_worker_ids)

        expect(integration.reload.last_sync_at).to eq(original_time)
      end
    end

    context "when company does not exist" do
      it "raises ActiveRecord::RecordNotFound" do
        expect do
          described_class.new.perform(999999, active_worker_ids)
        end.to raise_error(ActiveRecord::RecordNotFound)
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
