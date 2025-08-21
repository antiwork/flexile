# frozen_string_literal: true

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
      it "returns a JWT for the impersonated user" do
        post :create, params: { user_id: user.id }, format: :json
        expect(response).to have_http_status(:ok)
        expect(json["jwt"]).to be_present
        expect(json["user_id"]).to eq(user.id)
        expect(json["impersonator_id"]).to eq(team_member.id)
        expect(Time.iso8601(json["expires_at"]).future?).to be true
      end
    end

    context "with email" do
      it "returns a JWT for the impersonated user" do
        post :create, params: { email: user.email }, format: :json
        expect(response).to have_http_status(:ok)
        expect(json["jwt"]).to be_present
        expect(json["user_id"]).to eq(user.id)
        expect(json["impersonator_id"]).to eq(team_member.id)
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
end
