# frozen_string_literal: true

RSpec.describe QuickbooksIntegration do
  describe "validations" do
    it { is_expected.to validate_presence_of(:expires_at) }
    it { is_expected.to validate_presence_of(:refresh_token) }
    it { is_expected.to validate_presence_of(:refresh_token_expires_at) }
    it { is_expected.to validate_presence_of(:flexile_vendor_id).on(:update) }
    it { is_expected.to validate_presence_of(:consulting_services_expense_account_id).on(:update) }
    it { is_expected.to validate_presence_of(:flexile_fees_expense_account_id).on(:update) }
    it { is_expected.to validate_presence_of(:flexile_clearance_bank_account_id).on(:update) }
    it { is_expected.to validate_presence_of(:default_bank_account_id).on(:update) }
  end

  describe "#sync_existing_data" do
    let(:integration) { create(:quickbooks_integration, :with_incomplete_setup) }

    context "when setup is not completed" do
      it "does not schedule a QuickBooks data sync job" do
        expect do
          integration.update(account_id: "1234567890")
        end.to_not change { QuickbooksIntegrationSyncScheduleJob.jobs.size }
      end
    end

    context "when setup is completed" do
      it "schedules the QuickBooks integration sync job" do
        integration.update(
          consulting_services_expense_account_id: "59",
          flexile_fees_expense_account_id: "10",
          flexile_clearance_bank_account_id: "93",
          default_bank_account_id: "93",
          flexile_vendor_id: "83"
        )
        expect(QuickbooksIntegrationSyncScheduleJob).to have_enqueued_sidekiq_job(integration.company_id)
      end
    end
  end

  describe "#as_json", :vcr do
    context "when integration is initialized" do
      let(:integration) { create(:quickbooks_integration, :with_incomplete_setup) }

      it "returns JSON representation" do
        expect(integration.as_json).to eq({
          id: integration.id,
          status: "initialized",
          consulting_services_expense_account_id: nil,
          flexile_fees_expense_account_id: nil,
          default_bank_account_id: nil,
          last_sync_at: nil,
        })
      end
    end

    context "when integration is active" do
      let(:integration) { create(:quickbooks_integration, :active) }

      it "returns JSON representation", :freeze_time do
        expect(integration.as_json).to eq({
          id: integration.id,
          status: "active",
          consulting_services_expense_account_id: "59",
          flexile_fees_expense_account_id: "10",
          default_bank_account_id: "93",
          last_sync_at: Time.current.iso8601,
        })
      end
    end
  end

  describe "#update_tokens!", :vcr do
    let(:integration) { build(:quickbooks_integration) }
    let(:time) { Time.utc(2023, 1, 1) }
    let(:response) { double("Response") }

    before { travel_to time }

    context "when response contains expiring timestamps", :freeze_time do
      before do
        allow(response).to receive(:parsed_response).and_return({ "access_token" => "token", "expires_in" => 7200, "refresh_token" => "refresh_token", "x_refresh_token_expires_in" => 101.days })
      end

      it "sets the new tokens and expiring timestamps" do
        integration.update_tokens!(response)
        expect(integration.access_token).to eq("token")
        expect(integration.refresh_token).to eq("refresh_token")
        expect(integration.expires_at).to eq("2023-01-01T02:00:00.000Z")
        expect(integration.refresh_token_expires_at).to eq("2023-01-02T00:00:00.000Z")
      end
    end

    context "when response does not contain expiring timestamps", :freeze_time do
      before do
        allow(response).to receive(:parsed_response).and_return({ "access_token" => "token", "refresh_token" => "refresh_token" })
      end

      it "sets the new tokens and sets the default expiring timestamps" do
        integration.update_tokens!(response)
        expect(integration.access_token).to eq("token")
        expect(integration.refresh_token).to eq("refresh_token")
        expect(integration.expires_at).to eq("2023-01-01T01:00:00Z")
        expect(integration.refresh_token_expires_at).to eq("2023-01-02T00:00:00.000Z")
      end
    end
  end

  describe "#mark_deleted!" do
    let(:integration) { create(:quickbooks_integration) }
    let!(:integration_record) { create(:integration_record, integration:) }

    it "marks the integration and corresponding records as deleted" do
      integration.mark_deleted!
      expect(integration.reload.status).to eq("deleted")
      expect(integration.reload.deleted_at).to be_present
      expect(integration_record.reload.deleted_at).to be_present
    end
  end
end
