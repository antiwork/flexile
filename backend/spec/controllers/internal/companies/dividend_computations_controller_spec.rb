# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendComputationsController do
  let(:company) { create(:company) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }

  before do
    allow(controller).to receive(:authenticate_user_json!).and_return(true)

    Current.user = admin_user
    Current.company = company
    Current.company_administrator = company_administrator

    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "GET #index" do
    let!(:computation1) { create(:dividend_computation, company: company, created_at: 2.days.ago) }
    let!(:computation2) { create(:dividend_computation, company: company, created_at: 1.day.ago) }

    it "returns dividend computations for the company ordered by creation date" do
      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response).to be_an(Array)
      expect(json_response.length).to eq(2)
      # Should be ordered by created_at desc (newest first)
      expect(json_response.first["id"]).to eq(computation2.id)
      expect(json_response.second["id"]).to eq(computation1.id)
    end

    it "authorizes the request" do
      expect(controller).to receive(:authorize).with(an_instance_of(ActiveRecord::Relation))
      get :index, params: { company_id: company.external_id }
    end
  end

  describe "GET #show" do
    let!(:computation_output) { create(:dividend_computation_output, dividend_computation: dividend_computation) }

    it "returns the dividend computation with detailed view" do
      get :show, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["id"]).to eq(dividend_computation.id)
      expect(json_response).to have_key("computation_outputs")
    end

    it "returns 404 for non-existent computation" do
      get :show, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "authorizes the request" do
      expect(controller).to receive(:authorize).with(dividend_computation)
      get :show, params: { company_id: company.external_id, id: dividend_computation.id }
    end
  end

  describe "POST #create" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        total_amount_in_usd: "100000.00",
        dividends_issuance_date: "2024-01-15",
        return_of_capital: false,
      }
    end

    before do
      # Mock the DividendComputationGeneration service
      allow(DividendComputationGeneration).to receive(:new).and_return(
        double(process: dividend_computation)
      )
    end

    it "creates a dividend computation successfully" do
      post :create, params: valid_params

      expect(response).to have_http_status(:created)
      json_response = response.parsed_body

      expect(json_response["id"]).to be_present
    end

    it "calls the DividendComputationGeneration service with correct parameters" do
      service_double = double
      expect(DividendComputationGeneration).to receive(:new).with(
        company,
        amount_in_usd: 100000.0,
        dividends_issuance_date: Date.parse("2024-01-15"),
        return_of_capital: false
      ).and_return(service_double)

      expect(service_double).to receive(:process).and_return(dividend_computation)

      post :create, params: valid_params
    end

    it "returns bad request for invalid date format" do
      post :create, params: valid_params.merge(dividends_issuance_date: "invalid-date")

      expect(response).to have_http_status(:bad_request)
      json_response = response.parsed_body
      expect(json_response["error"]).to include("Invalid date format")
    end

    it "handles service errors gracefully" do
      allow(DividendComputationGeneration).to receive(:new).and_raise(StandardError.new("Service error"))

      post :create, params: valid_params

      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Failed to create dividend computation")
    end

    it "authorizes the request" do
      expect(controller).to receive(:authorize).with(DividendComputation)
      post :create, params: valid_params
    end
  end

  describe "DELETE #destroy" do
    it "deletes the dividend computation successfully" do
      delete :destroy, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response["success"]).to be true

      expect { dividend_computation.reload }.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "returns 404 for non-existent computation" do
      delete :destroy, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "authorizes the request" do
      expect(controller).to receive(:authorize).with(dividend_computation)
      delete :destroy, params: { company_id: company.external_id, id: dividend_computation.id }
    end
  end

  describe "POST #preview" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        total_amount_in_usd: "50000.00",
        dividends_issuance_date: "2024-02-01",
        return_of_capital: true,
      }
    end

    before do
      create(:company_investor, company: company)
      create(:company_investor, company: company)
    end

    it "returns preview data without creating a computation" do
      post :preview, params: valid_params

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body

      expect(json_response["total_amount_in_usd"]).to eq(50000.0)
      expect(json_response["return_of_capital"]).to be true
      expect(json_response["estimated_shareholders"]).to eq(2)
    end

    it "authorizes the request with preview action" do
      expect(controller).to receive(:authorize).with(DividendComputation, :preview?)
      post :preview, params: valid_params
    end
  end

  describe "POST #finalize" do
    let!(:computation_output1) { create(:dividend_computation_output, dividend_computation: dividend_computation) }
    let!(:computation_output2) { create(:dividend_computation_output, dividend_computation: dividend_computation) }

    it "creates a dividend round and individual dividends" do
      expect do
        post :finalize, params: { company_id: company.external_id, id: dividend_computation.id }
      end.to change(DividendRound, :count).by(1)
       .and change(Dividend, :count).by(2)
       .and change(InvestorDividendRound, :count).by(2)

      expect(response).to have_http_status(:created)
      json_response = response.parsed_body
      expect(json_response["id"]).to be_present
    end

    it "sends dividend issuance emails" do
      double("dividend_round", investor_dividend_rounds: [])
      investor_dividend_round = double("investor_dividend_round")

      allow_any_instance_of(DividendRound).to receive(:investor_dividend_rounds).and_return([investor_dividend_round])
      expect(investor_dividend_round).to receive(:send_dividend_issued_email)

      post :finalize, params: { company_id: company.external_id, id: dividend_computation.id }
    end

    it "handles creation failures" do
      allow_any_instance_of(DividendRound).to receive(:save!).and_raise(ActiveRecord::RecordInvalid.new(DividendRound.new))

      post :finalize, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:unprocessable_entity)
      json_response = response.parsed_body
      expect(json_response["error"]).to include("Failed to create dividend round")
    end

    it "authorizes the request with update action" do
      expect(controller).to receive(:authorize).with(dividend_computation, :update?)
      post :finalize, params: { company_id: company.external_id, id: dividend_computation.id }
    end
  end

  describe "GET #export_csv" do
    let!(:company_investor) { create(:company_investor, company: company) }
    let!(:computation_output) do
      create(:dividend_computation_output,
             dividend_computation: dividend_computation,
             company_investor: company_investor,
             total_amount_in_usd: 1000.0,
             qualified_dividend_amount_usd: 800.0,
             number_of_shares: 100)
    end

    it "exports CSV successfully" do
      get :export_csv, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:ok)
      expect(response.content_type).to eq("text/csv")
      expect(response.headers["Content-Disposition"]).to include("attachment")
      expect(response.headers["Content-Disposition"]).to include("dividend_computation_#{dividend_computation.id}")

      # Check CSV content
      csv_content = response.body
      expect(csv_content).to include("Investor Name")
      expect(csv_content).to include("Total Amount (USD)")
      expect(csv_content).to include("TOTALS")
    end

    it "returns 404 for non-existent computation" do
      get :export_csv, params: { company_id: company.external_id, id: 999999 }

      expect(response).to have_http_status(:not_found)
    end

    it "handles CSV generation errors" do
      allow(controller).to receive(:generate_csv_data).and_raise(StandardError.new("CSV error"))

      get :export_csv, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:internal_server_error)
      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Failed to export CSV")
    end

    it "authorizes the request with show action" do
      expect(controller).to receive(:authorize).with(dividend_computation, :show?)
      get :export_csv, params: { company_id: company.external_id, id: dividend_computation.id }
    end
  end
end
