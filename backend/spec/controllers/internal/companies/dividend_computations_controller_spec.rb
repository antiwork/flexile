# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendComputationsController do
  let(:company) { create(:company, equity_enabled: true) }
  let(:admin_user) { create(:user) }
  let(:company_administrator) { create(:company_administrator, company: company, user: admin_user) }

  let(:dividend_computation) { create(:dividend_computation, company: company) }
  let(:investor_user) { create(:user, legal_name: "Matthew Smith") }
  let(:company_investor) { create(:company_investor, user: investor_user, company: company) }
  let(:dividend_computation_output) do
    create(:dividend_computation_output,
           dividend_computation: dividend_computation,
           company_investor: company_investor,
           share_class: "Common",
           number_of_shares: 100,
           preferred_dividend_amount_in_usd: 0,
           dividend_amount_in_usd: 1000,
           qualified_dividend_amount_usd: 0,
           total_amount_in_usd: 1000)
  end

  before do
    allow(controller).to receive(:current_context) do
      Current.user = admin_user
      Current.company = company
      Current.company_administrator = company_administrator
      CurrentContext.new(user: admin_user, company: company)
    end
  end

  describe "GET #index" do
    before do
      dividend_computation_output
    end

    it "returns dividend computations for the company" do
      get :index, params: { company_id: company.external_id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response).to be_an(Array)
      expect(json_response.first["id"]).to eq(dividend_computation.id)
      expect(json_response.first["total_amount_in_usd"]).to eq("1000000.0")
      expect(json_response.first["dividends_issuance_date"]).to eq(Time.current.strftime("%Y-%m-%d"))
      expect(json_response.first["return_of_capital"]).to eq(false)
      expect(json_response.first["number_of_shareholders"]).to eq(1)
    end
  end

  describe "POST #create" do
    let(:valid_params) do
      {
        company_id: company.external_id,
        dividend_computation: {
          amount_in_usd: 100_000,
          dividends_issuance_date: "2024-01-15",
          return_of_capital: true,
        },
      }
    end

    it "creates a new dividend computation" do
      post :create, params: valid_params

      expect(response).to have_http_status(:created)
      json_response = response.parsed_body
      expect(json_response["id"]).to be_present
      dividend_computation = DividendComputation.find(json_response["id"])
      expect(dividend_computation.total_amount_in_usd).to eq(100_000)
      expect(dividend_computation.dividends_issuance_date).to eq(Date.parse("2024-01-15"))
      expect(dividend_computation.return_of_capital).to eq(true)
    end
  end

  describe "GET #show" do
    before do
      dividend_computation_output
    end

    it "returns dividend computation details with computation outputs" do
      get :show, params: { company_id: company.external_id, id: dividend_computation.id }

      expect(response).to have_http_status(:ok)
      json_response = response.parsed_body
      expect(json_response["id"]).to eq(dividend_computation.id)
      expect(json_response["number_of_shareholders"]).to eq(1)
      expect(json_response["total_amount_in_usd"]).to eq("1000000.0")
      expect(json_response["dividends_issuance_date"]).to eq(Time.current.strftime("%Y-%m-%d"))
      expect(json_response["return_of_capital"]).to eq(false)

      expect(json_response["computation_outputs"]).to be_present
      computation_output = json_response["computation_outputs"].first
      expect(computation_output["investor_name"]).to eq("Matthew Smith")
      expect(computation_output["company_investor_id"]).to eq(company_investor.id)
      expect(computation_output["investor_external_id"]).to eq(investor_user.external_id)
      expect(computation_output["total_amount"].to_f).to eq(1000.0)
      expect(computation_output["number_of_shares"]).to eq(100)
    end

    it "returns not found for invalid id" do
      expect do
        get :show, params: { company_id: company.external_id, id: 999999 }
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end
end
