# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendComputationsController do
  let(:user) { create(:user) }
  let(:company) { create(:company, :completed_onboarding) }
  let(:company_administrator) { create(:company_administrator, user: user, company: company) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }
  let(:dividend_computation_output) { create(:dividend_computation_output, dividend_computation: dividend_computation) }

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

    allow(controller).to receive(:verify_authorized).and_return(true)
    allow(controller).to receive(:authorize).with(DividendComputation).and_return(true)
  end

  describe "GET #index" do
    before do
      dividend_computation
      dividend_computation_output
    end

    it "returns dividend computations for the company" do
      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response).to be_an(Array)
      expect(json_response.first["id"]).to eq(dividend_computation.id)
      expect(json_response.first["total_amount_in_usd"].to_f).to eq(dividend_computation.total_amount_in_usd.to_f)
      expect(json_response.first["dividends_issuance_date"]).to eq(dividend_computation.dividends_issuance_date.to_date.iso8601)
      expect(json_response.first["return_of_capital"]).to eq(dividend_computation.return_of_capital)
      expect(json_response.first["number_of_shareholders"]).to eq(dividend_computation.number_of_shareholders)
    end
  end

  describe "POST #create" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        dividend_computation: {
          amount_in_usd: 100_000,
          dividends_issuance_date: "2024-01-15",
          return_of_capital: false,
        },
      }
    end

    it "creates a new dividend computation" do
      post :create, params: valid_params

      expect(response).to have_http_status(:created)
      json_response = response.parsed_body
      expect(json_response["id"]).to be_present
    end

    it "uses current date when no issuance date provided" do
      params_without_date = valid_params.deep_dup
      params_without_date[:dividend_computation].delete(:dividends_issuance_date)

      post :create, params: params_without_date
      expect(response).to have_http_status(:created)
    end

    it "handles return of capital parameter" do
      params_with_return = valid_params.deep_dup
      params_with_return[:dividend_computation][:return_of_capital] = true

      post :create, params: params_with_return

      expect(response).to have_http_status(:created)
      expect(DividendComputation.find(response.parsed_body["id"]).return_of_capital).to eq(true)
    end
  end

  describe "GET #show" do
    let(:computation_outputs) do
      [
        {
          "investor_name" => "John Doe",
          "company_investor_id" => 1,
          "investor_external_id" => "ext_123",
          "total_amount" => 1000,
          "number_of_shares" => 100,
        }
      ]
    end

    before do
      allow_any_instance_of(DividendComputation).to receive(:broken_down_by_investor).and_return(computation_outputs)
    end

    it "returns dividend computation details" do
      get :show, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response["id"]).to eq(dividend_computation.id)
      expect(json_response["total_amount_in_usd"].to_f).to eq(dividend_computation.total_amount_in_usd.to_f)
      expect(json_response["dividends_issuance_date"]).to eq(dividend_computation.dividends_issuance_date.to_date.iso8601)
      expect(json_response["return_of_capital"]).to eq(dividend_computation.return_of_capital)
      expect(json_response["number_of_shareholders"]).to eq(dividend_computation.number_of_shareholders)
      expect(json_response["computation_outputs"]).to eq(computation_outputs)
    end

    it "includes computation outputs" do
      get :show, params: { company_id: company.external_id, id: dividend_computation.id }

      json_response = response.parsed_body
      expect(json_response["computation_outputs"]).to be_present
      expect(json_response["computation_outputs"]).to eq(computation_outputs)
    end

    it "returns not found for invalid id" do
      expect do
        get :show, params: { company_id: company.external_id, id: 999999 }
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
