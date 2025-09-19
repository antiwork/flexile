# frozen_string_literal: true

RSpec.describe Internal::Admin::ImpersonationController do
  let(:admin_user) { create(:user, team_member: true) }
  let(:regular_user) { create(:user, team_member: false) }
  let(:target_user) { create(:user, email: "target@example.com") }
  let(:another_admin) { create(:user, team_member: true) }
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
        expect(json_response["user"]["id"]).to eq(target_user.id)
        expect(json_response["user"]["name"]).to eq(target_user.name)
        expect(json_response["user"]["legal_name"]).to eq(target_user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(target_user.preferred_name)
      end

      it "returns a valid JWT token that can be decoded" do
        post :create, params: { email: target_user.email }

        json_response = JSON.parse(response.body)
        impersonation_jwt = json_response["impersonation_jwt"]

        # Verify the JWT can be decoded and contains correct user info
        decoded_user = JwtService.user_from_token(impersonation_jwt)
        expect(decoded_user).to eq(target_user)
      end

      it "returns error for non-existent user" do
        post :create, params: { email: "nonexistent@example.com" }

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("User not found")
      end

      it "prevents impersonating admin users" do
        post :create, params: { email: another_admin.email }

        expect(response).to have_http_status(:forbidden)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Cannot impersonate admin users")
      end

      it "prevents impersonating themselves" do
        post :create, params: { email: admin_user.email }

        expect(response).to have_http_status(:forbidden)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Cannot impersonate admin users")
      end

      it "handles missing email parameter" do
        post :create, params: {}

        expect(response).to have_http_status(:bad_request)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Email is required")
      end

      it "handles empty email parameter" do
        post :create, params: { email: "" }

        expect(response).to have_http_status(:bad_request)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Email is required")
      end

      it "handles whitespace-only email parameter" do
        post :create, params: { email: "   " }

        expect(response).to have_http_status(:bad_request)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be false
        expect(json_response["error"]).to eq("Email is required")
      end

      it "finds users by exact email match" do
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["success"]).to be true
        expect(json_response["user"]["email"]).to eq(target_user.email)
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

      it "denies access even for non-existent users" do
        post :create, params: { email: "nonexistent@example.com" }

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

      it "returns unauthorized even with invalid bearer token" do
        request.headers["x-flexile-auth"] = "Bearer invalid_token"
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:unauthorized)
      end

      it "returns unauthorized with malformed authorization header" do
        request.headers["x-flexile-auth"] = "InvalidFormat token"
        post :create, params: { email: target_user.email }

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context "with edge cases" do
      before do
        set_auth_header(admin_jwt)
      end

      it "handles very long email addresses" do
        long_email = "#{'a' * 100}@example.com"
        post :create, params: { email: long_email }

        expect(response).to have_http_status(:not_found)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end

      it "handles email with special characters" do
        special_email = "test+special@example.com"
        create(:user, email: special_email)

        post :create, params: { email: special_email }

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["user"]["email"]).to eq(special_email)
      end
    end
  end
end
