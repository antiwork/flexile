# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::Companies::Administrator::QuickbooksController, type: :controller do
  let(:company) { create(:company) }
  let(:user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: user) }
  let(:integration) { create(:quickbooks_integration, company: company) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    Current.user = user
    Current.company = company
    Current.company_administrator = company_administrator

    allow(controller).to receive(:current_context) do
      Current.user = user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: user, company: company)
    end
  end

  describe "POST #sync_integration" do
    before do
      integration # ensure integration exists
    end

    it "enqueues QuickbooksIntegrationSyncScheduleJob when authorized" do
      expect(QuickbooksIntegrationSyncScheduleJob).to receive(:perform_async).with(company.id)

      post :sync_integration, params: { company_id: company.id }

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq({
        "success" => true,
        "message" => "QuickBooks sync initiated"
      })
    end

    context "when integration does not exist" do
      before { integration.destroy }

      it "returns not found error" do
        post :sync_integration, params: { company_id: company.id }

        expect(response).to have_http_status(:not_found)
        expect(JSON.parse(response.body)).to eq({
          "success" => false,
          "error" => "Integration not found"
        })
      end

      it "does not enqueue any jobs" do
        expect(QuickbooksIntegrationSyncScheduleJob).not_to receive(:perform_async)
        post :sync_integration, params: { company_id: company.id }
      end
    end

    context "when unauthenticated" do
      before do
        allow(controller).to receive(:authenticate_user_json!).and_raise(StandardError)
      end

      it "does not enqueue and raises authentication error" do
        expect(QuickbooksIntegrationSyncScheduleJob).not_to receive(:perform_async)
        expect { post :sync_integration, params: { company_id: company.id } }.to raise_error(StandardError)
      end
    end

    context "when unauthorized" do
      before do
        allow_any_instance_of(QuickbooksIntegrationPolicy).to receive(:sync_integration?).and_return(false)
      end

      it "does not enqueue and returns forbidden" do
        expect(QuickbooksIntegrationSyncScheduleJob).not_to receive(:perform_async)
        post :sync_integration, params: { company_id: company.id }
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "routing" do
    it "routes POST to sync_integration" do
      expect(post: "/internal/companies/1/administrator/quickbooks/sync_integration").to route_to(
        controller: "internal/companies/administrator/quickbooks",
        action: "sync_integration",
        company_id: "1"
      )
    end
  end
end
