# frozen_string_literal: true

require "spec_helper"

RSpec.describe Admin::ImpersonationController, type: :controller do
  let(:admin_user) { create(:user, without_bank_account: true, team_member: true) }
  let(:target_user) { create(:user, without_bank_account: true, team_member: false) }

  before do
    allow(Current).to receive(:user=)
    allow(Current).to receive(:user).and_return(admin_user)
    allow(controller).to receive(:current_context)
    allow(controller).to receive(:authenticate_user!)
  end

  describe "POST #create" do
    context "with valid token" do
      it "returns JWT token for the target user" do
        token = target_user.to_signed_global_id(purpose: :impersonate, expires_in: 5.minutes).to_s

        post :create, params: { token: token }

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["token"]).to be_present
        expect(json_response["user"]["id"]).to eq(target_user.id)
        expect(json_response["user"]["email"]).to eq(target_user.email)
        expect(json_response["user"]["display_name"]).to eq(target_user.display_name)
      end
    end

    context "with invalid token" do
      it "returns error" do
        post :create, params: { token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid or expired impersonation token")
      end
    end

    context "with expired token" do
      it "returns error" do
        token = target_user.to_signed_global_id(purpose: :impersonate, expires_in: -1.minute).to_s

        post :create, params: { token: token }

        expect(response).to have_http_status(:unauthorized)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid or expired impersonation token")
      end
    end

    context "with blank token" do
      it "returns error" do
        post :create, params: { token: "" }

        expect(response).to have_http_status(:bad_request)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid impersonation token")
      end
    end

    context "when user not found" do
      it "returns error" do
        fake_user = build(:user, id: 99999)
        token = fake_user.to_signed_global_id(purpose: :impersonate, expires_in: 5.minutes).to_s

        post :create, params: { token: token }

        # Should return unauthorized to not leak information about user existence
        expect(response).to have_http_status(:unauthorized)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid or expired impersonation token")
      end
    end
  end
end
