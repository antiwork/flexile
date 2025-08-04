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

      expect(response).to have_http_status(:ok)
      expect(response.status).to eq(200)
      expect(response.content_type).to include("application/json")

      expect(response.body).to be_valid_json
      json = JSON.parse(response.body)

      expect(json).to be_a(Hash)
      expect(json).to have_key("dividend_computations")
      expect(json["dividend_computations"]).to be_an(Array)
      expect(json["dividend_computations"].length).to eq(2)
    end

    it "returns dividend computations in descending order by created_at" do
      get :index, params: { company_id: company.id }
      json = JSON.parse(response.body)

      computations = json["dividend_computations"]
      expect(computations.first["created_at"]).to be > computations.last["created_at"]
    end

    it "includes computation attributes in response" do
      get :index, params: { company_id: company.id }
      json = JSON.parse(response.body)
      computation_data = json["dividend_computations"].first

      expect(computation_data.keys).to contain_exactly(
        "id", "name", "total_amount_in_usd", "dividends_issuance_date",
        "return_of_capital", "outputs_count", "shareholder_count",
        "release_document", "created_at"
      )

      expect(computation_data["id"]).to eq(computation2.external_id)
      expect(computation_data["id"]).to be_a(String)

      expect(computation_data["name"]).to eq(computation2.name)
      expect(computation_data["name"]).to be_a(String)

      expect(computation_data["total_amount_in_usd"]).to eq(computation2.total_amount_in_usd.to_s)
      expect(computation_data["total_amount_in_usd"]).to be_a(String)
      expect { Float(computation_data["total_amount_in_usd"]) }.not_to raise_error

      expect(computation_data["dividends_issuance_date"]).to eq(computation2.dividends_issuance_date.as_json)
      expect(computation_data["dividends_issuance_date"]).to be_a(String)

      expect(computation_data["return_of_capital"]).to eq(computation2.return_of_capital)

      expect(computation_data["outputs_count"]).to eq(1)
      expect(computation_data["outputs_count"]).to be_a(Integer)

      expect(computation_data["shareholder_count"]).to eq(1)
      expect(computation_data["shareholder_count"]).to be_a(Integer)

      expect(computation_data["release_document"]).to be_nil

      expect(computation_data["created_at"]).to eq(computation2.created_at.as_json)
      expect(computation_data["created_at"]).to be_a(String)
    end

    it "validates date format in response" do
      get :index, params: { company_id: company.id }
      json = JSON.parse(response.body)
      computation_data = json["dividend_computations"].first

      expect(computation_data["dividends_issuance_date"]).to match(/\A\d{4}-\d{2}-\d{2}\z/)
      expect(computation_data["created_at"]).to match(/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\z/)
    end

    context "when user is not a company administrator" do
      let(:user) { company_investor.user }

      before do
        clerk_sign_in CurrentContext.new(user: user, company: company)
      end

      it "denies access" do
        get :index, params: { company_id: company.id }

        expect(response).to have_http_status(:forbidden)
        expect(response.status).to eq(403)
        expect(response.content_type).to include("application/json")

        json = JSON.parse(response.body)
        expect(json.keys).to contain_exactly("success", "error")
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
        expect(json["error"]).to be_a(String)
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

        expect(response).to have_http_status(:ok)
        expect(response.status).to eq(200)
        expect(response.content_type).to include("application/json")
        expect(response.body).to be_valid_json

        json = JSON.parse(response.body)
        expect(json.keys).to contain_exactly("success", "dividend_computation")
        expect(json["success"]).to be(true)
        expect(json["dividend_computation"]).to be_present
        expect(json["dividend_computation"]).to be_a(Hash)
      end

      it "includes computation data in response" do
        post :create, params: { company_id: company.id }.merge(valid_params)
        json = JSON.parse(response.body)
        computation_data = json["dividend_computation"]

        expect(computation_data.keys).to contain_exactly(
          "id", "name", "total_amount_in_usd", "dividends_issuance_date",
          "return_of_capital", "outputs_count", "shareholder_count",
          "release_document", "created_at"
        )

        expect(computation_data["id"]).to be_a(String)
        expect(computation_data["id"]).to match(/\A[a-zA-Z0-9_-]+\z/)

        expect(computation_data["total_amount_in_usd"]).to eq("100000.0")
        expect(computation_data["total_amount_in_usd"]).to be_a(String)
        expect { Float(computation_data["total_amount_in_usd"]) }.not_to raise_error

        expect(computation_data["return_of_capital"]).to be(false)

        expect(computation_data["outputs_count"]).to be > 0
        expect(computation_data["outputs_count"]).to be_a(Integer)

        expect(computation_data["shareholder_count"]).to be > 0
        expect(computation_data["shareholder_count"]).to be_a(Integer)

        expect(computation_data["release_document"]).to eq("Test release document content")
        expect(computation_data["release_document"]).to be_a(String)

        expect(computation_data["dividends_issuance_date"]).to be_a(String)
        expect(computation_data["created_at"]).to be_a(String)
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

      it "returns error response with correct status and format" do
        post :create, params: { company_id: company.id }.merge(invalid_params)

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.status).to eq(422)
        expect(response.content_type).to include("application/json")
        expect(response.body).to be_valid_json

        json = JSON.parse(response.body)
        expect(json.keys).to contain_exactly("success", "error_message")
        expect(json["success"]).to be(false)
        expect(json["error_message"]).to be_present
        expect(json["error_message"]).to be_a(String)
        expect(json["error_message"]).to include("Validation failed")
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
        expect(response.status).to eq(403)
        expect(response.content_type).to include("application/json")
        expect(response.body).to be_valid_json

        json = JSON.parse(response.body)
        expect(json.keys).to contain_exactly("success", "error")
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
        expect(json["error"]).to be_a(String)
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

      expect(response).to have_http_status(:ok)
      expect(response.status).to eq(200)
      expect(response.content_type).to include("application/json")
      expect(response.body).to be_valid_json
    end

    it "returns complete computation data with outputs" do
      get :show, params: { company_id: company.id, id: dividend_computation.external_id }
      json = JSON.parse(response.body)

      expect(json).to be_a(Hash)
      expect(json.keys).to contain_exactly("dividend_computation")

      computation_data = json["dividend_computation"]

      expect(computation_data.keys).to contain_exactly(
        "id", "name", "total_amount_in_usd", "dividends_issuance_date",
        "return_of_capital", "outputs_count", "shareholder_count",
        "release_document", "created_at", "outputs"
      )

      expect(computation_data["id"]).to eq(dividend_computation.external_id)
      expect(computation_data["id"]).to be_a(String)

      expect(computation_data["total_amount_in_usd"]).to eq(dividend_computation.total_amount_in_usd.to_s)
      expect(computation_data["total_amount_in_usd"]).to be_a(String)
      expect { Float(computation_data["total_amount_in_usd"]) }.not_to raise_error

      expect(computation_data["outputs_count"]).to eq(1)
      expect(computation_data["outputs_count"]).to be_a(Integer)

      expect(computation_data["shareholder_count"]).to eq(1)
      expect(computation_data["shareholder_count"]).to be_a(Integer)

      expect(computation_data["outputs"]).to be_an(Array)
      expect(computation_data["outputs"].length).to eq(1)
    end

    it "validates output structure and content" do
      get :show, params: { company_id: company.id, id: dividend_computation.external_id }
      json = JSON.parse(response.body)

      output = json["dividend_computation"]["outputs"].first

      expect(output.keys).to contain_exactly(
        "investor_name", "share_class", "number_of_shares", "hurdle_rate",
        "original_issue_price_in_usd", "dividend_amount_in_usd",
        "preferred_dividend_amount_in_usd", "qualified_dividend_amount_usd",
        "total_amount_in_usd", "fee_in_usd"
      )

      expect(output["investor_name"]).to be_a(String)
      expect(output["share_class"]).to be_a(String)
      expect(output["number_of_shares"]).to be_a(Integer)
      expect(output["hurdle_rate"]).to be_nil
      expect(output["original_issue_price_in_usd"]).to be_nil
      expect(output["dividend_amount_in_usd"]).to be_a(String)
      expect { Float(output["dividend_amount_in_usd"]) }.not_to raise_error
      expect(output["preferred_dividend_amount_in_usd"]).to be_a(String)
      expect { Float(output["preferred_dividend_amount_in_usd"]) }.not_to raise_error
      expect(output["qualified_dividend_amount_usd"]).to be_a(String)
      expect { Float(output["qualified_dividend_amount_usd"]) }.not_to raise_error
      expect(output["total_amount_in_usd"]).to be_a(String)
      expect { Float(output["total_amount_in_usd"]) }.not_to raise_error
      expect(output["fee_in_usd"]).to be_a(Numeric)

      expect(output["fee_in_usd"]).to be >= 0
      expect(output["total_amount_in_usd"].to_f).to be > 0
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
        expect(response.status).to eq(403)
        expect(response.content_type).to include("application/json")
        expect(response.body).to be_valid_json

        json = JSON.parse(response.body)
        expect(json.keys).to contain_exactly("success", "error")
        expect(json["success"]).to be(false)
        expect(json["error"]).to eq("You are not allowed to perform this action.")
        expect(json["error"]).to be_a(String)
      end
    end
  end
end
