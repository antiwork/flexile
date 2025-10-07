# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Api::ImpersonationController, type: :controller do
  let(:user) { create(:user, email: "test@example.com", without_bank_account: true) }
  let(:admin_user) { create(:user, email: "admin@example.com", team_member: true, without_bank_account: true) }
  let(:non_admin_user) { create(:user, email: "nonadmin@example.com", team_member: false, without_bank_account: true) }

  before do
    # Set up JWT authentication by mocking the request headers
    admin_token = JwtService.generate_token(admin_user)
    request.headers['x-flexile-auth'] = "Bearer #{admin_token}"
  end

  describe "POST #start" do
    context "with valid impersonation URL token" do
      let(:url_token) { ImpersonationService.generate_impersonation_url_token(user) }

      it "starts impersonation session successfully" do
        post :start, params: { token: url_token }

        expect(response).to have_http_status(:ok)
        
        json_response = JSON.parse(response.body)
        expect(json_response["impersonation_token"]).to be_present
        expect(json_response["impersonated_user"]["email"]).to eq(user.email)
        expect(json_response["admin_user"]["email"]).to eq(admin_user.email)
      end
    end

    context "with invalid token" do
      it "returns unauthorized" do
        post :start, params: { token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid or expired token")
      end
    end

    context "with missing token" do
      it "returns bad request" do
        post :start

        expect(response).to have_http_status(:bad_request)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "when current user is not admin" do
      before do
        non_admin_token = JwtService.generate_token(non_admin_user)
        request.headers['x-flexile-auth'] = "Bearer #{non_admin_token}"
      end

      it "returns forbidden" do
        url_token = ImpersonationService.generate_impersonation_url_token(user)
        post :start, params: { token: url_token }

        expect(response).to have_http_status(:forbidden)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Admin access required")
      end
    end
  end

  describe "POST #stop" do
    context "when impersonating" do
      before do
        # Set up impersonation session
        session_token = ImpersonationService.generate_impersonation_session_token(user, admin_user)
        request.headers['x-flexile-impersonation'] = "Bearer #{session_token}"
      end

      it "stops impersonation successfully" do
        post :stop

        expect(response).to have_http_status(:ok)
        
        json_response = JSON.parse(response.body)
        expect(json_response["message"]).to eq("Impersonation stopped successfully")
      end
    end

    context "when not impersonating" do
      before do
        # Use regular JWT auth (no impersonation header)
        # Admin token is already set in the main before block
      end

      it "returns bad request" do
        post :stop

        expect(response).to have_http_status(:bad_request)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Not currently impersonating")
      end
    end
  end

  describe "GET #status" do
    context "when impersonating" do
      before do
        # Set up impersonation session
        session_token = ImpersonationService.generate_impersonation_session_token(user, admin_user)
        request.headers['x-flexile-impersonation'] = "Bearer #{session_token}"
      end

      it "returns impersonation status" do
        get :status

        expect(response).to have_http_status(:ok)
        
        json_response = JSON.parse(response.body)
        expect(json_response["impersonating"]).to be true
        expect(json_response["impersonated_user"]["email"]).to eq(user.email)
        expect(json_response["admin_user"]["email"]).to eq(admin_user.email)
      end
    end

    context "when not impersonating" do
      before do
        # Use regular JWT auth (no impersonation header)
        # Admin token is already set in the main before block
      end

      it "returns not impersonating status" do
        get :status

        expect(response).to have_http_status(:ok)
        
        json_response = JSON.parse(response.body)
        expect(json_response["impersonating"]).to be false
      end
    end
  end

  describe "POST #generate_url" do
    context "with valid user ID" do
      it "generates impersonation URL successfully" do
        post :generate_url, params: { user_id: user.external_id }

        expect(response).to have_http_status(:ok)
        
        json_response = JSON.parse(response.body)
        expect(json_response["impersonation_url"]).to be_present
        expect(json_response["token"]).to be_present
        expect(json_response["user"]["email"]).to eq(user.email)
      end
    end

    context "with invalid user ID" do
      it "returns not found" do
        post :generate_url, params: { user_id: "invalid_id" }

        expect(response).to have_http_status(:not_found)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end
    end

    context "with missing user ID" do
      it "returns bad request" do
        post :generate_url

        expect(response).to have_http_status(:bad_request)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User ID is required")
      end
    end

    context "when current user is not admin" do
      before do
        non_admin_token = JwtService.generate_token(non_admin_user)
        request.headers['x-flexile-auth'] = "Bearer #{non_admin_token}"
      end

      it "returns forbidden" do
        post :generate_url, params: { user_id: user.external_id }

        expect(response).to have_http_status(:forbidden)
        
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Admin access required")
      end
    end
  end
end
