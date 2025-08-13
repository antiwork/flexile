# frozen_string_literal: true

require "spec_helper"

RSpec.describe QuickbooksIntegrationSyncScheduleJob, type: :job do
  describe "#perform" do
    let(:company) { create(:company) }
    let(:company_id) { company.id }

    context "when integration is nil" do
      it "returns early without scheduling any jobs" do
        expect(QuickbooksDataSyncJob).not_to receive(:perform_bulk)
        described_class.new.perform(company_id)
      end
    end

    context "when integration is deleted" do
      let!(:integration) { create(:quickbooks_integration, :deleted, company:) }

      it "returns early without scheduling any jobs" do
        expect(QuickbooksDataSyncJob).not_to receive(:perform_bulk)
        described_class.new.perform(company_id)
      end
    end

    context "when integration exists and is active" do
      let!(:integration) { create(:quickbooks_integration, company:) }

      context "when there are no active contractors" do
        it "returns early without scheduling any jobs" do
          expect(QuickbooksDataSyncJob).not_to receive(:perform_bulk)
          described_class.new.perform(company_id)
        end
      end

      context "when there are active contractors" do
        let!(:contractor_1) { create(:company_worker, company:) }
        let!(:contractor_2) { create(:company_worker, company:) }
        let!(:ended_contractor) { create(:company_worker, company:, ended_at: 1.day.ago) }

        it "sets integration status to active" do
          expect do
            described_class.new.perform(company_id)
          end.to change { integration.reload.status }.to("active")
        end

        it "schedules QuickbooksDataSyncJob for all active contractors" do
          expected_args = [
            [company_id, "CompanyWorker", contractor_1.id],
            [company_id, "CompanyWorker", contractor_2.id]
          ]

          expect(QuickbooksDataSyncJob).to receive(:perform_bulk).with(expected_args)
          described_class.new.perform(company_id)
        end

        it "does not schedule jobs for ended contractors" do
          expected_args = [
            [company_id, "CompanyWorker", contractor_1.id],
            [company_id, "CompanyWorker", contractor_2.id]
          ]

          expect(QuickbooksDataSyncJob).to receive(:perform_bulk).with(expected_args)
          described_class.new.perform(company_id)

          # Verify ended contractor is not in the expected args
          contractor_ids = expected_args.map { |args| args[2] }
          expect(contractor_ids).to include(contractor_1.id, contractor_2.id)
          expect(contractor_ids).not_to include(ended_contractor.id)
        end
      end

      context "when integration status is initialized" do
        let!(:integration) { create(:quickbooks_integration, :with_incomplete_setup, company:) }
        let!(:contractor) { create(:company_worker, company:) }

        it "raises validation error due to incomplete setup" do
          expect do
            described_class.new.perform(company_id)
          end.to raise_error(ActiveRecord::RecordInvalid)
        end
      end
    end

    context "when company does not exist" do
      let(:company_id) { 999999 }

      it "raises ActiveRecord::RecordNotFound" do
        expect do
          described_class.new.perform(company_id)
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end
  end
end
