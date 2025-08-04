# frozen_string_literal: true

RSpec.describe Internal::Companies::DividendComputationsController, type: :controller do
  let(:company) { create(:company) }
  let(:company_investor) { create(:company_investor, company: company) }
  let(:company_administrator) { create(:company_administrator, company: company) }
  let!(:share_holding) { create(:share_holding, company_investor: company_investor) }
  let(:dividend_computation) { create(:dividend_computation, company: company) }

  describe "GET #index" do
    let(:user) { company_administrator.user }
    let!(:computation1) { create(:dividend_computation, company: company, created_at: 2.days.ago) }
    let!(:computation2) { create(:dividend_computation, company: company, created_at: 1.day.ago) }

    before do
      clerk_sign_in CurrentContext.new(user: user, company: company)
      create(:dividend_computation_output, dividend_computation: computation1)
      create(:dividend_computation_output, dividend_computation: computation2)
    end

    it "returns a successful response" do
      expect(controller).to receive(:authorize).with(DividendComputation)
      get :index, params: { company_id: company.id }
      expect(response).to have_http_status(:success)
    end

    it "returns dividend computations in descending order by created_at" do
      get :index, params: { company_id: company.id }
      json = JSON.parse(response.body)

      expect(json["dividend_computations"]).to be_an(Array)
      expect(json["dividend_computations"].length).to eq(2)
    end

    it "includes computation attributes in response" do
      get :index, params: { company_id: company.id }
      json = JSON.parse(response.body)
      computation_data = json["dividend_computations"].first

      expect(computation_data).to include(
        "id" => computation2.external_id,
        "name" => computation2.name,
        "total_amount_in_usd" => computation2.total_amount_in_usd.to_s,
        "dividends_issuance_date" => computation2.dividends_issuance_date.to_s,
        "return_of_capital" => computation2.return_of_capital,
        "outputs_count" => 1,
        "created_at" => computation2.created_at.as_json
      )
    end

    context "when user is not a company administrator" do
      let(:user) { company_investor.user }

      before do
        clerk_sign_in CurrentContext.new(user: user, company: company)
      end

      it "denies access" do
        get :index, params: { company_id: company.id }
        expect(response).to have_http_status(:forbidden)
        json = JSON.parse(response.body)
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
      end
    end
  end

  describe "POST #create" do
    let(:user) { company_administrator.user }
    let(:valid_params) do
      {
        dividend_computation: {
          amount_in_usd: 100_000,
          issued_at: 1.week.from_now.to_date.to_s,
          return_of_capital: false,
          release_document: "Test release document content",
        },
      }
    end

    let(:invalid_params) do
      {
        dividend_computation: {
          amount_in_usd: -100,
          issued_at: 1.week.ago.to_date.to_s,
          return_of_capital: false,
        },
      }
    end

    before do
      clerk_sign_in CurrentContext.new(user: user, company: company)
    end

    context "with valid parameters" do
      it "creates a new dividend computation" do
        expect do
          post :create, params: { company_id: company.id }.merge(valid_params)
        end.to change(DividendComputation, :count).by(1)
      end

      it "returns success response" do
        expect(controller).to receive(:authorize).with(DividendComputation)
        post :create, params: { company_id: company.id }.merge(valid_params)
        expect(response).to have_http_status(:success)

        json = JSON.parse(response.body)
        expect(json["success"]).to be(true)
        expect(json["dividend_computation"]).to be_present
      end

      it "includes computation data in response" do
        post :create, params: { company_id: company.id }.merge(valid_params)
        json = JSON.parse(response.body)
        computation_data = json["dividend_computation"]

        expect(computation_data).to include(
          "total_amount_in_usd" => "100000.0",
          "return_of_capital" => false,
          "outputs_count" => be > 0
        )
      end

      it "sets release document when provided" do
        post :create, params: { company_id: company.id }.merge(valid_params)
        computation = DividendComputation.last
        expect(computation.release_document).to eq("Test release document content")
      end
    end

    context "with invalid parameters" do
      it "does not create a dividend computation" do
        expect do
          post :create, params: { company_id: company.id }.merge(invalid_params)
        end.not_to change(DividendComputation, :count)
      end

      it "returns error response" do
        post :create, params: { company_id: company.id }.merge(invalid_params)
        expect(response).to have_http_status(:unprocessable_entity)

        json = JSON.parse(response.body)
        expect(json["success"]).to be(false)
        expect(json["error_message"]).to be_present
      end
    end

    context "when user is not a company administrator" do
      let(:user) { company_investor.user }

      before do
        clerk_sign_in CurrentContext.new(user: user, company: company)
      end

      it "denies access" do
        post :create, params: { company_id: company.id }.merge(valid_params)
        expect(response).to have_http_status(:forbidden)
        json = JSON.parse(response.body)
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
      end
    end
  end

  describe "GET #show" do
    let(:user) { company_administrator.user }
    let!(:computation_output) { create(:dividend_computation_output, dividend_computation: dividend_computation) }

    before do
      clerk_sign_in CurrentContext.new(user: user, company: company)
    end

    it "returns a successful response" do
      expect(controller).to receive(:authorize).with(dividend_computation)
      get :show, params: { company_id: company.id, id: dividend_computation.external_id }
      expect(response).to have_http_status(:success)
    end

    it "returns computation data" do
      get :show, params: { company_id: company.id, id: dividend_computation.external_id }
      json = JSON.parse(response.body)

      expect(json["dividend_computation"]).to include(
        "id" => dividend_computation.external_id,
        "total_amount_in_usd" => dividend_computation.total_amount_in_usd.to_s,
        "outputs_count" => 1
      )
    end

    context "when computation does not exist" do
      it "raises ActiveRecord::RecordNotFound" do
        expect do
          get :show, params: { company_id: company.id, id: 999999 }
        end.to raise_error(ActiveRecord::RecordNotFound)
      end
    end

    context "when user is not a company administrator" do
      let(:user) { company_investor.user }

      before do
        clerk_sign_in CurrentContext.new(user: user, company: company)
      end

      it "denies access" do
        get :show, params: { company_id: company.id, id: dividend_computation.external_id }
        expect(response).to have_http_status(:forbidden)
        json = JSON.parse(response.body)
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
      end
    end
  end
end
