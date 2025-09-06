# frozen_string_literal: true

RSpec.describe Internal::Admin::ImpersonationController do
  let(:admin_user) { create(:user, team_member: true) }
  let(:regular_user) { create(:user, team_member: false) }
  let(:target_user) { create(:user, email: "target@example.com") }
  let(:admin_jwt) { JwtService.generate_token(admin_user) }
  let(:regular_jwt) { JwtService.generate_token(regular_user) }

  def set_auth_header(jwt)
    request.headers["x-flexile-auth"] = "Bearer #{jwt}"
  end

  describe "POST #create" do
    context "when user is admin" do
      before do
        set_auth_header(admin_jwt)
      end

      it "creates impersonation JWT for valid user" do
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be true
        expect(json_response["impersonation_jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(target_user.email)
      end

      it "returns error for non-existent user" do
        post :create, params: { email: "nonexistent@example.com" }

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("User not found")
      end

      it "prevents impersonating admin users" do
        admin_target = create(:user, email: "admin@example.com", team_member: true)
        post :create, params: { email: admin_target.email }

        expect(response).to have_http_status(:forbidden)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Cannot impersonate admin users")
      end
    end

    context "when user is not admin" do
      before do
        set_auth_header(regular_jwt)
      end

      it "denies access" do
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:forbidden)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Admin access required")
      end
    end

    context "when user is not authenticated" do
      it "returns unauthorized" do
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
