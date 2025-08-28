# frozen_string_literal: true

require "spec_helper"

RSpec.describe ApiTokenAuthenticatable do
  controller(ActionController::Base) do
    include ApiTokenAuthenticatable

    def test_action
      render json: { message: "authenticated" }
    end
  end

  before do
    routes.draw { get "test_action" => "anonymous#test_action" }
  end

  describe "API token authentication" do
    let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }

    context "with valid API token" do
      it "allows access when token is provided as parameter" do
        get :test_action, params: { token: api_token }

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response["message"]).to eq("authenticated")
      end
    end

    context "with invalid API token" do
      it "returns unauthorized for invalid token" do
        get :test_action, params: { token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Invalid token")
      end
    end

    context "with missing API token" do
      it "returns bad request when token is missing" do
        get :test_action, params: {}

        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with blank API token" do
      it "returns bad request when token is blank" do
        get :test_action, params: { token: "" }

        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Token is required")
      end
    end
  end
end
