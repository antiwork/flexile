# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::LoginController, type: :controller do
  describe "POST #create" do
    let(:user) { create(:user) }
    let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
    let(:valid_otp) { user.otp_code }
    let(:invalid_otp) { "999999" }
    let(:expired_otp) { "123456" }

    context "with valid parameters" do
      it "returns a JWT token and user data" do
        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["id"]).to eq(user.id)
        expect(json_response["user"]["email"]).to eq(user.email)
        expect(json_response["user"]["name"]).to eq(user.name)
        expect(json_response["user"]["legal_name"]).to eq(user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(user.preferred_name)
      end
    end

    context "with invalid OTP code" do
      it "returns unauthorized" do
        post :create, params: { email: user.email, otp_code: invalid_otp, token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid verification code, please try again.")
      end
    end

    context "with expired OTP code" do
      before do
        allow(user).to receive(:verify_otp).with(expired_otp).and_return(false)
      end

      it "returns unauthorized" do
        post :create, params: { email: user.email, otp_code: expired_otp, token: api_token }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid verification code, please try again.")
      end
    end

    context "with non-existent user" do
      it "returns not found" do
        post :create, params: { email: "nonexistent@example.com", otp_code: valid_otp, token: api_token }

        expect(response).to have_http_status(:not_found)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :create, params: { otp_code: valid_otp, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when otp_code is missing" do
        post :create, params: { email: user.email, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("OTP code is required")
      end

      it "returns bad request when all parameters are missing" do
        post :create, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :create, params: { email: "", otp_code: valid_otp, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when otp_code is empty string" do
        post :create, params: { email: user.email, otp_code: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("OTP code is required")
      end
    end

    context "when user is OTP rate limited" do
      before do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(true)
      end

      it "returns too many requests with retry_after" do
        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        expect(response).to have_http_status(:too_many_requests)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Too many login attempts. Please wait before trying again.")
        expect(json_response["retry_after"]).to eq(10.minutes.to_i)
      end
    end

    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        json_response = JSON.parse(response.body)
        jwt_token = json_response["jwt"]

        jwt_secret = GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
        decoded_token = JWT.decode(jwt_token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        expect(payload["user_id"]).to eq(user.id)
        expect(payload["email"]).to eq(user.email)
        expect(payload["exp"]).to be > Time.current.to_i
        expect(payload["exp"]).to be <= 1.month.from_now.to_i
      end
    end

    context "OTP verification flow" do
      it "calls verify_otp method on user" do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:verify_otp).with(valid_otp).and_return(true)

        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        expect(user).to have_received(:verify_otp).with(valid_otp)
      end

      it "does not call verify_otp when user is rate limited" do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(true)
        allow(user).to receive(:verify_otp)

        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        expect(user).not_to have_received(:verify_otp)
      end

      it "calls otp_rate_limited? method on user" do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(false)

        post :create, params: { email: user.email, otp_code: valid_otp, token: api_token }

        expect(user).to have_received(:otp_rate_limited?).at_least(:once)
      end
    end
  end
end
