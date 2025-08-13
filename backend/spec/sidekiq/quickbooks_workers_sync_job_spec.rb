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
    # Mock the IntegrationApi::Quickbooks service
    allow_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_quickbooks_vendors).and_return([])
    allow_any_instance_of(IntegrationApi::Quickbooks).to receive(:make_authenticated_request).and_yield
    allow_any_instance_of(IntegrationApi::Quickbooks).to receive(:make_api_request).and_return(double(ok?: true))
  end

  describe "#perform" do
    context "when integration is active" do
      it "processes all worker IDs" do
        expect_any_instance_of(described_class).to receive(:sync_worker_to_vendor).with(
          worker1.id, integration, anything, anything
        )
        expect_any_instance_of(described_class).to receive(:sync_worker_to_vendor).with(
          worker2.id, integration, anything, anything
        )

        described_class.new.perform(company.id, active_worker_ids)
      end

      it "updates integration last_sync_at" do
        integration # Ensure integration is created
        freeze_time do
          allow_any_instance_of(described_class).to receive(:sync_worker_to_vendor)
          described_class.new.perform(company.id, active_worker_ids)
          expect(integration.reload.last_sync_at).to be_within(1.second).of(Time.current)
        end
      end
    end

    context "when integration is nil" do
      before { integration.destroy }

      it "returns early without processing" do
        expect_any_instance_of(described_class).not_to receive(:sync_worker_to_vendor)
        described_class.new.perform(company.id, active_worker_ids)
      end
    end

    context "when integration is not active" do
      before { integration.update!(status: "out_of_sync") }

      it "returns early without processing" do
        expect_any_instance_of(described_class).not_to receive(:sync_worker_to_vendor)
        described_class.new.perform(company.id, active_worker_ids)
      end
    end
  end



  describe "#sync_worker_to_vendor" do
    let(:job) { described_class.new }
    let(:qbo_service) { instance_double(IntegrationApi::Quickbooks) }
    let(:all_vendors) { [] }
    let(:compliance_info) { create(:user_compliance_info, user: worker1.user, legal_name: "John Doe") }

    before do
      compliance_info
      worker1.user.reload
      allow(worker1.user).to receive(:compliance_info).and_return(compliance_info)
    end

    context "when worker has no display name" do
      let(:user_with_no_name) { create(:user, legal_name: nil) }
      let(:worker_with_no_name) { create(:company_worker, company: company, user: user_with_no_name) }

      before do
        allow(worker_with_no_name.user).to receive(:legal_name).and_return(nil)
        allow(worker_with_no_name.user).to receive(:compliance_info).and_return(nil)
      end

      it "returns early without processing" do
        expect(job).not_to receive(:upsert_integration_record)
        expect(job).not_to receive(:create_new_vendor)
        job.send(:sync_worker_to_vendor, worker_with_no_name.id, integration, qbo_service, all_vendors)
      end
    end

    context "when vendor already exists" do
      let(:all_vendors) do
        [{
          "Id" => "123",
          "DisplayName" => "John Doe",
          "PrimaryEmailAddr" => { "Address" => worker1.user.email },
          "SyncToken" => "0"
        }]
      end

      it "updates integration record with existing vendor" do
        expect(job).to receive(:upsert_integration_record).with(
          integration: integration,
          worker: worker1,
          integration_external_id: "123",
          sync_token: "0"
        )

        job.send(:sync_worker_to_vendor, worker1.id, integration, qbo_service, all_vendors)
      end
    end

    context "when vendor does not exist" do
      let(:all_vendors) { [] }

      before do
        allow(job).to receive(:create_new_vendor).with(worker1, integration, qbo_service, "John Doe")
      end

      it "creates a new vendor" do
        expect(job).to receive(:create_new_vendor).with(worker1, integration, qbo_service, "John Doe")
        job.send(:sync_worker_to_vendor, worker1.id, integration, qbo_service, all_vendors)
      end
    end
  end

  describe "#create_new_vendor" do
    let(:job) { described_class.new }
    let(:qbo_service) { instance_double(IntegrationApi::Quickbooks) }
    let(:display_name) { "John Doe" }

    before do
      worker1.user.update!(
        street_address: "123 Main St",
        city: "Austin",
        state: "TX",
        zip_code: "12345",
        country_code: "US"
      )
      worker1.update!(pay_rate_in_subunits: 5000) # $50.00
    end

    it "creates vendor with correct payload" do
      expected_payload = {
        DisplayName: display_name,
        GivenName: worker1.user.legal_name || "",
        PrimaryEmailAddr: {
          Address: worker1.user.email
        },
        BillAddr: {
          Line1: "123 Main St",
          City: "Austin",
          CountrySubDivisionCode: "TX",
          PostalCode: "12345",
          Country: "US"
        },
        Vendor1099: false,
        Active: true,
        BillRate: 50.0
      }

      response_double = double(
        ok?: true,
        parsed_response: { "Vendor" => { "Id" => "456", "SyncToken" => "0" } }
      )

      expect(qbo_service).to receive(:make_authenticated_request).and_yield
      expect(qbo_service).to receive(:make_api_request).with(
        method: "POST",
        url: anything,
        body: expected_payload.to_json,
        headers: anything
      ).and_return(response_double)
      allow(qbo_service).to receive(:send).with(:base_api_url).and_return("https://test.com/v3/company/123")
      allow(qbo_service).to receive(:send).with(:api_request_header).and_return({})

      expect(job).to receive(:upsert_integration_record).with(
        integration: integration,
        worker: worker1,
        integration_external_id: "456",
        sync_token: "0"
      )

      job.send(:create_new_vendor, worker1, integration, qbo_service, display_name)
    end
  end

  describe "#upsert_integration_record" do
    let(:job) { described_class.new }

    context "when integration record exists" do
      let!(:existing_record) do
        create(:integration_record,
          integration: integration,
          integratable: worker1,
          integration_external_id: "old_id",
          sync_token: "old_token"
        )
      end

      it "updates the existing record" do
        job.send(:upsert_integration_record,
          integration: integration,
          worker: worker1,
          integration_external_id: "new_id",
          sync_token: "new_token"
        )

        existing_record.reload
        expect(existing_record.integration_external_id).to eq("new_id")
        expect(existing_record.sync_token).to eq("new_token")
      end
    end

    context "when integration record does not exist" do
      it "creates a new record" do
        expect {
          job.send(:upsert_integration_record,
            integration: integration,
            worker: worker1,
            integration_external_id: "new_id",
            sync_token: "new_token"
          )
        }.to change(IntegrationRecord, :count).by(1)

        record = IntegrationRecord.last
        expect(record.integration).to eq(integration)
        expect(record.integratable).to eq(worker1)
        expect(record.integration_external_id).to eq("new_id")
        expect(record.sync_token).to eq("new_token")
      end
    end
  end
end
