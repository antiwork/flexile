# frozen_string_literal: true

require "spec_helper"

RSpec.describe OtpValidation, type: :controller do
  controller(Api::BaseController) do
    include OtpValidation

    def test_validate_otp_params
      validate_otp_params(params[:email], params[:otp_code])
      head :ok
    end

    def test_find_user_by_email
      user = find_user_by_email(params[:email])
      render json: { found: user.present? }
    end

    def test_check_otp_rate_limit
      user = User.find(params[:user_id])
      check_otp_rate_limit(user)
      head :ok
    end
  end

  let(:user) { create(:user) }

  before do
    routes.draw do
      post "test_validate_otp_params" => "anonymous#test_validate_otp_params"
      post "test_find_user_by_email" => "anonymous#test_find_user_by_email"
      post "test_check_otp_rate_limit" => "anonymous#test_check_otp_rate_limit"
    end
  end

  describe "#validate_otp_params" do
    it "returns true when both email and otp_code are present" do
      post :test_validate_otp_params, params: { email: "test@example.com", otp_code: "123456", token: api_token }
      expect(response).to have_http_status(:ok)
    end

    it "renders error when email is blank" do
      post :test_validate_otp_params, params: { email: "", otp_code: "123456", token: api_token }
      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to eq("Email is required")
    end

    it "renders error when otp_code is blank" do
      post :test_validate_otp_params, params: { email: "test@example.com", otp_code: "", token: api_token }
      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to eq("OTP code is required")
    end
  end

  describe "#find_user_by_email" do
    it "returns user when found" do
      post :test_find_user_by_email, params: { email: user.email, token: api_token }
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["found"]).to be true
    end

    it "renders error when user not found" do
      post :test_find_user_by_email, params: { email: "nonexistent@example.com", token: api_token }
      expect(response).to have_http_status(:not_found)
      expect(JSON.parse(response.body)["error"]).to eq("User not found")
    end
  end

  describe "#check_otp_rate_limit" do
    it "returns true when user is not rate limited" do
      post :test_check_otp_rate_limit, params: { user_id: user.id, token: api_token }
      expect(response).to have_http_status(:ok)
    end

    it "renders error when user is rate limited" do
      allow_any_instance_of(User).to receive(:otp_rate_limited?).and_return(true)
      post :test_check_otp_rate_limit, params: { user_id: user.id, token: api_token }
      expect(response).to have_http_status(:too_many_requests)
      expect(JSON.parse(response.body)["error"]).to eq("Too many OTP attempts. Please wait before trying again.")
    end
  end

  private
    def api_token
      GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base)
    end
end
