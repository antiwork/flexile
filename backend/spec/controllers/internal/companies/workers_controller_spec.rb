# frozen_string_literal: true

RSpec.describe Internal::Companies::WorkersController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:worker_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:company_worker) { create(:company_worker, company: company, user: worker_user) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)
    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "POST #create" do
    it "creates a worker" do
      result = { success: true, company_worker: company_worker, document: nil }
      allow(InviteWorker).to receive(:new).and_return(double(perform: result))

      post :create, params: { company_id: company.external_id, contractor: { email: "test@example.com" } }

      expect(response).to have_http_status(:ok)
      expect(InviteWorker).to have_received(:new)
    end
  end

  describe "POST #complete_onboarding" do
    let(:valid_params) do
      {
        contractor: {
          started_at: "2023-01-01",
          pay_rate_in_subunits: 5000,
          pay_rate_type: "hourly",
          role: "Developer",
        },
      }
    end

    context "when user is authorized" do
      before do
        allow(controller).to receive(:current_context) do
          Current.user = worker_user
          Current.company = company
          Current.company_administrator = nil
          Current.company_worker = company_worker
          CurrentContext.new(user: worker_user, company: company)
        end
      end

      it "successfully completes onboarding" do
        post :complete_onboarding, params: { company_id: company.external_id }.merge(valid_params)

        expect(response).to have_http_status(:ok)
        company_worker.reload
        expect(company_worker.started_at).to eq(Date.parse("2023-01-01"))
        expect(company_worker.pay_rate_in_subunits).to eq(5000)
        expect(company_worker.pay_rate_type).to eq("hourly")
        expect(company_worker.role).to eq("Developer")
      end

      it "returns unprocessable entity on validation failure" do
        invalid_params = { contractor: { started_at: nil, role: "" } }

        post :complete_onboarding, params: { company_id: company.external_id }.merge(invalid_params)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body).to have_key("error_message")
      end
    end

    context "when user is not authorized" do
      it "returns forbidden" do
        post :complete_onboarding, params: { company_id: company.external_id }.merge(valid_params)

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
