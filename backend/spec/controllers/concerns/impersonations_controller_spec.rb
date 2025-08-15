# frozen_string_literal: true

require "spec_helper"

RSpec.describe Admin::ImpersonationsController, type: :controller do
  let!(:team_member) { FactoryBot.create(:user, team_member: true) }
  let!(:user) { FactoryBot.create(:user, team_member: false) }
  let!(:other_admin) { FactoryBot.create(:user, team_member: true) }

  before do
    allow(JwtService).to receive(:token_present_in_request?).and_return(true)
    allow(JwtService).to receive(:user_from_request).and_return(team_member)
  end

  def json
    JSON.parse(response.body)
  end

  describe "POST #create" do
    context "with valid user_id" do
      it "returns a signed token for impersonation" do
        post :create, params: { user_id: user.id }, format: :json
        expect(response).to have_http_status(:ok)
        expect(json["token"]).to be_present
        expect(json["target_user_id"]).to eq(user.id)
        expect(Time.iso8601(json["expires_at"]).future?).to be true
      end
    end

    context "with email" do
      it "returns a signed token for impersonation" do
        post :create, params: { email: user.email }, format: :json
        expect(response).to have_http_status(:ok)
        expect(json["token"]).to be_present
        expect(json["target_user_id"]).to eq(user.id)
      end
    end

    context "user not found" do
      it "returns 404" do
        post :create, params: { email: "missing@example.com" }, format: :json
        expect(response).to have_http_status(:not_found)
        expect(json["error"]).to eq("User not found")
      end
    end

    context "target is admin" do
      it "returns 403" do
        post :create, params: { user_id: other_admin.id }, format: :json
        expect(response).to have_http_status(:forbidden)
        expect(json["error"]).to eq("Cannot impersonate an admin")
      end
    end

    context "unauthorized (non admin)" do
      it "returns 401" do
        allow(JwtService).to receive(:user_from_request).and_return(nil)
        post :create, params: { user_id: user.id }, format: :json
        expect(response).to have_http_status(:unauthorized)
        expect(json["error"]).to eq("Unauthorized")
      end
    end
  end

  describe "POST #exchange" do
    let(:valid_token) { user.signed_id(expires_in: 5.minutes, purpose: :impersonate) }

    it "returns a JWT for the impersonated user" do
      post :exchange, params: { token: valid_token }, format: :json
      expect(response).to have_http_status(:ok)
      expect(json["jwt"]).to be_present
      expect(json["user_id"]).to eq(user.id)
      expect(json["impersonator_id"]).to eq(team_member.id)
      expect(Time.iso8601(json["expires_at"]).future?).to be true
    end

    it "returns 422 for invalid/expired token" do
      post :exchange, params: { token: "invalid" }, format: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json["error"]).to eq("Invalid or expired token")
    end

    it "returns 403 when token is for an admin user" do
      admin_token = other_admin.signed_id(expires_in: 5.minutes, purpose: :impersonate)
      post :exchange, params: { token: admin_token }, format: :json
      expect(response).to have_http_status(:forbidden)
      expect(json["error"]).to eq("Cannot impersonate an admin")
    end

    it "returns 401 when requester is not admin" do
      allow(JwtService).to receive(:user_from_request).and_return(nil)
      post :exchange, params: { token: valid_token }, format: :json
      expect(response).to have_http_status(:unauthorized)
      expect(json["error"]).to eq("Unauthorized")
    end
  end

  describe "DELETE #destroy" do
    it "returns a JWT for the admin to stop impersonation" do
      delete :destroy, params: { id: 0 }, format: :json
      expect(response).to have_http_status(:ok)
      expect(json["jwt"]).to be_present
      expect(json["user_id"]).to eq(team_member.id)
    end

    it "returns 401 when requester is not admin" do
      allow(JwtService).to receive(:user_from_request).and_return(nil)
      delete :destroy, params: { id: 0 }, format: :json
      expect(response).to have_http_status(:unauthorized)
      expect(json["error"]).to eq("Unauthorized")
    end
  end
end
