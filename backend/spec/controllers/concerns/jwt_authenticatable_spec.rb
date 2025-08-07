# frozen_string_literal: true

require "spec_helper"

RSpec.describe JwtAuthenticatable, type: :controller do
  controller(ActionController::Base) do
    include JwtAuthenticatable

    def test_action
      render json: { message: "authenticated" }
    end

    private
      def set_paper_trail_whodunnit
        # Mock method for testing
      end
  end

  let(:user) { create(:user) }
  let(:jwt_secret) { Rails.application.secret_key_base }

  before do
    routes.draw { get "test_action" => "anonymous#test_action" }
  end

  describe "JWT authentication" do
    context "with valid JWT token" do
      it "authenticates the user" do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.month.from_now.to_i,
        }
        token = JWT.encode(payload, jwt_secret, "HS256")

        request.headers["x-flexile-auth"] = "Bearer #{token}"
        get :test_action

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["message"]).to eq("authenticated")
      end
    end

    context "with expired JWT token" do
      it "returns unauthorized" do
        payload = {
          user_id: user.id,
          email: user.email,
          exp: 1.hour.ago.to_i,
        }
        token = JWT.encode(payload, jwt_secret, "HS256")

        request.headers["x-flexile-auth"] = "Bearer #{token}"
        get :test_action

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with invalid JWT token" do
      it "returns unauthorized" do
        request.headers["x-flexile-auth"] = "Bearer invalid_token"
        get :test_action

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with non-existent user" do
      it "returns unauthorized" do
        payload = {
          user_id: 999999,
          email: "nonexistent@example.com",
          exp: 1.month.from_now.to_i,
        }
        token = JWT.encode(payload, jwt_secret, "HS256")

        request.headers["x-flexile-auth"] = "Bearer #{token}"
        get :test_action

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "without authorization header" do
      it "does not authenticate" do
        get :test_action

        expect(response).to have_http_status(:ok)
        expect(Current.user).to be_nil
      end
    end
  end
end
