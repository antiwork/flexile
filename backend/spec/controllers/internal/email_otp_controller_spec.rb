# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::EmailOtpController, type: :controller do
  describe "POST #create" do
    let(:user) { create(:user) }
    let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }

    context "with valid parameters" do
      it "sends OTP email successfully" do
        expect do
          post :create, params: { email: user.email, token: api_token }
        end.to have_enqueued_mail(UserMailer, :otp_code).with(user.id)

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["message"]).to eq("OTP sent successfully")
      end
    end

    context "with non-existent user" do
      it "returns not found" do
        post :create, params: { email: "nonexistent@example.com", token: api_token }

        expect(response).to have_http_status(:not_found)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end

      it "does not send any email" do
        expect do
          post :create, params: { email: "nonexistent@example.com", token: api_token }
        end.not_to have_enqueued_mail(UserMailer, :otp_code)
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :create, params: { token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :create, params: { email: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "when user is OTP rate limited" do
      before do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(true)
      end

      it "returns too many requests with retry_after" do
        post :create, params: { email: user.email, token: api_token }

        expect(response).to have_http_status(:too_many_requests)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Too many login attempts. Please wait before trying again.")
        expect(json_response["retry_after"]).to eq(10.minutes.to_i)
      end

      it "does not send any email" do
        expect do
          post :create, params: { email: user.email, token: api_token }
        end.not_to have_enqueued_mail(UserMailer, :otp_code)
      end
    end

    context "mailer integration" do
      it "calls UserMailer.otp_code with correct user id" do
        expect(UserMailer).to receive(:otp_code).with(user.id).and_call_original

        post :create, params: { email: user.email, token: api_token }
      end

      it "calls deliver_later on the mailer" do
        mailer_double = double("UserMailer")
        expect(UserMailer).to receive(:otp_code).with(user.id).and_return(mailer_double)
        expect(mailer_double).to receive(:deliver_later)

        post :create, params: { email: user.email, token: api_token }
      end
    end

    context "rate limiting behavior" do
      it "calls otp_rate_limited? method on user" do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(false)

        post :create, params: { email: user.email, token: api_token }

        expect(user).to have_received(:otp_rate_limited?).at_least(:once)
      end

      it "does not send email when rate limited" do
        allow(User).to receive(:find_by).with(email: user.email).and_return(user)
        allow(user).to receive(:otp_rate_limited?).and_return(true)
        allow(UserMailer).to receive(:otp_code)

        post :create, params: { email: user.email, token: api_token }

        expect(UserMailer).not_to have_received(:otp_code)
      end
    end
  end
end
