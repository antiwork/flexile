# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::OauthController, type: :controller do
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
  let(:email) { "test@example.com" }

  describe "POST #create" do
    context "with missing email parameter" do
      it "returns bad request" do
        post :create, params: { token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "with empty email parameter" do
      it "returns bad request" do
        post :create, params: { email: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end

    context "when user exists" do
      let!(:existing_user) { create(:user, email: email) }

      it "logs in successfully and returns JWT" do
        post :create, params: { email: email, token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["id"]).to eq(existing_user.id)
        expect(json_response["user"]["email"]).to eq(existing_user.email)
        expect(json_response["user"]["name"]).to eq(existing_user.name)
        expect(json_response["user"]["legal_name"]).to eq(existing_user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(existing_user.preferred_name)

        existing_user.reload
        expect(existing_user.current_sign_in_at).to be_present
      end

      it "updates current_sign_in_at timestamp" do
        freeze_time do
          post :create, params: { email: email, token: api_token }

          existing_user.reload
          expect(existing_user.current_sign_in_at).to eq(Time.current)
        end
      end
    end

    context "when user does not exist" do
      it "registers successfully and returns JWT" do
        expect do
          post :create, params: { email: email, token: api_token }
        end.to change(User, :count).by(1)
          .and change(TosAgreement, :count).by(1)

        expect(response).to have_http_status(:created)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)

        new_user = User.find_by(email: email)
        expect(new_user).to be_present
        expect(new_user.confirmed_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present
        expect(new_user.current_sign_in_at).to be_present
      end

      it "creates a TOS agreement with IP address" do
        post :create, params: { email: email, token: api_token }

        new_user = User.find_by(email: email)
        tos_agreement = new_user.tos_agreements.first
        expect(tos_agreement.ip_address).to eq(request.remote_ip)
      end
    end
  end
end
