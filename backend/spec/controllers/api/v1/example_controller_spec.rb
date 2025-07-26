# frozen_string_literal: true

require "spec_helper"

RSpec.describe Api::V1::ExampleController, type: :controller do
  let(:user) { create(:user) }
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
  let(:jwt_secret) { GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base) }

  describe "GET #protected_action" do
    context "with valid API token and JWT token" do
      let(:jwt_token) do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        JWT.encode(payload, jwt_secret, "HS256")
      end

      before do
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"
      end

      it "returns user data when properly authenticated" do
        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["message"]).to eq("This is a protected endpoint")
        expect(json_response["user"]["id"]).to eq(user.id)
        expect(json_response["user"]["email"]).to eq(user.email)
        expect(json_response["user"]["name"]).to eq(user.name)
      end
    end

    context "with invalid API token" do
      let(:jwt_token) do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        JWT.encode(payload, jwt_secret, "HS256")
      end

      before do
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"
      end

      it "returns unauthorized when API token is invalid" do
        get :protected_action, params: { token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid token")
      end

      it "returns bad request when API token is missing" do
        get :protected_action, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end

      it "returns bad request when API token is empty" do
        get :protected_action, params: { token: "" }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with valid API token but invalid JWT token" do
      it "raises NoMethodError when JWT token is missing (Current.user is nil)" do
        expect do
          get :protected_action, params: { token: api_token }
        end.to raise_error(NoMethodError, /undefined method.*id.*for nil/)
      end

      it "returns unauthorized when JWT token is invalid" do
        request.headers["x-flexile-auth"] = "Bearer invalid_jwt_token"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Unauthorized")
      end

      it "returns unauthorized when JWT token is expired" do
        expired_payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.hour.ago.to_i,
        }
        expired_jwt_token = JWT.encode(expired_payload, jwt_secret, "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{expired_jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Unauthorized")
      end

      it "returns unauthorized when JWT token has invalid signature" do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        invalid_jwt_token = JWT.encode(payload, "wrong_secret", "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{invalid_jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Unauthorized")
      end

      it "returns unauthorized when JWT token references non-existent user" do
        non_existent_user_payload = {
          user_id: 999999,
          email: "nonexistent@example.com",
          exp: 1.month.from_now.to_i,
        }
        jwt_token = JWT.encode(non_existent_user_payload, jwt_secret, "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Unauthorized")
      end

      it "raises NoMethodError when Authorization header is malformed (JWT auth skipped)" do
        request.headers["x-flexile-auth"] = "InvalidFormat jwt_token"

        expect do
          get :protected_action, params: { token: api_token }
        end.to raise_error(NoMethodError, /undefined method.*id.*for nil/)
      end

      it "raises NoMethodError when Authorization header is empty (JWT auth skipped)" do
        request.headers["x-flexile-auth"] = ""

        expect do
          get :protected_action, params: { token: api_token }
        end.to raise_error(NoMethodError, /undefined method.*id.*for nil/)
      end
    end

    context "JWT token validation" do
      it "accepts valid JWT token with correct structure" do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        jwt_token = JWT.encode(payload, jwt_secret, "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:ok)
      end

      it "rejects JWT token with missing user_id" do
        payload = {
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        jwt_token = JWT.encode(payload, jwt_secret, "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:unauthorized)
      end

      it "accepts JWT token with missing exp (JWT library default behavior)" do
        payload = {
          user_id: user.id,
          email: user.email,
        }
        jwt_token = JWT.encode(payload, jwt_secret, "HS256")
        request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"

        get :protected_action, params: { token: api_token }

        expect(response).to have_http_status(:ok)
      end
    end
  end
end
