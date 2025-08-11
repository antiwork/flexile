# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::OauthController, type: :controller do
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
  let(:email) { "user@example.com" }
  let(:google_id) { "google_123456789" }
  let(:github_id) { "github_123456789" }

  describe "POST #google_login" do
    let!(:user) { create(:user, email: email) }

    context "with valid parameters" do
      it "returns a JWT token and user data" do
        post :google_login, params: { email: email, google_id: google_id, token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["id"]).to eq(user.id)
        expect(json_response["user"]["email"]).to eq(user.email)
        expect(json_response["user"]["name"]).to eq(user.name)
        expect(json_response["user"]["legal_name"]).to eq(user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(user.preferred_name)
      end

      it "updates user's google_uid when blank" do
        user.update!(google_uid: nil)

        post :google_login, params: { email: email, google_id: google_id, token: api_token }

        user.reload
        expect(user.google_uid).to eq(google_id)
      end

      it "does not update google_uid when already present" do
        existing_google_id = "existing_google_id"
        user.update!(google_uid: existing_google_id)

        post :google_login, params: { email: email, google_id: google_id, token: api_token }

        user.reload
        expect(user.google_uid).to eq(existing_google_id)
      end

      it "updates current_sign_in_at" do
        freeze_time do
          post :google_login, params: { email: email, google_id: google_id, token: api_token }

          user.reload
          expect(user.current_sign_in_at).to eq(Time.current)
        end
      end
    end

    context "with non-existent user" do
      it "returns not found" do
        post :google_login, params: { email: "nonexistent@example.com", google_id: google_id, token: api_token }

        expect(response).to have_http_status(:not_found)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :google_login, params: { google_id: google_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when google_id is missing" do
        post :google_login, params: { email: email, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Google ID is required")
      end

      it "returns bad request when API token is missing" do
        post :google_login, params: { email: email, google_id: google_id }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end

      it "returns bad request when all parameters are missing" do
        post :google_login, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :google_login, params: { email: "", google_id: google_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when google_id is empty string" do
        post :google_login, params: { email: email, google_id: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Google ID is required")
      end

      it "returns bad request when API token is empty string" do
        post :google_login, params: { email: email, google_id: google_id, token: "" }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with invalid API token" do
      it "returns unauthorized" do
        post :google_login, params: { email: email, google_id: google_id, token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid token")
      end
    end

    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :google_login, params: { email: email, google_id: google_id, token: api_token }

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
  end

  describe "POST #google_signup" do
    let(:new_email) { "newuser@example.com" }

    context "with valid parameters" do
      it "creates a new user and returns JWT" do
        expect do
          post :google_signup, params: { email: new_email, google_id: google_id, token: api_token }
        end.to change(User, :count).by(1)

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(new_email)

        new_user = User.find_by(email: new_email)
        expect(new_user).to be_present
        expect(new_user.google_uid).to eq(google_id)
        expect(new_user.confirmed_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present
        expect(new_user.tos_agreements).to exist
      end

      it "creates a default company for the user" do
        expect do
          post :google_signup, params: { email: new_email, google_id: google_id, token: api_token }
        end.to change(Company, :count).by(1)
          .and change(CompanyAdministrator, :count).by(1)

        new_user = User.find_by(email: new_email)
        expect(new_user.companies).to exist
      end
    end

    context "with invitation token" do
      let!(:company) { create(:company) }
      let!(:invite_link) { create(:company_invite_link, company: company) }

      it "creates user without default company when invitation token is provided" do
        expect do
          post :google_signup, params: {
            email: new_email,
            google_id: google_id,
            invitation_token: invite_link.token,
            token: api_token,
          }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(0)
          .and change(CompanyAdministrator, :count).by(0)

        new_user = User.find_by(email: new_email)
        expect(new_user.signup_invite_link).to eq(invite_link)
      end

      it "handles invalid invitation token gracefully" do
        expect do
          post :google_signup, params: {
            email: new_email,
            google_id: google_id,
            invitation_token: "invalid_token",
            token: api_token,
          }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(1)

        new_user = User.find_by(email: new_email)
        expect(new_user.signup_invite_link).to be_nil
      end
    end

    context "with existing user" do
      let!(:existing_user) { create(:user, email: new_email) }

      it "returns conflict error" do
        post :google_signup, params: { email: new_email, google_id: google_id, token: api_token }

        expect(response).to have_http_status(:conflict)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("An account with this email already exists. Please log in instead.")
      end

      it "does not create a new user" do
        expect do
          post :google_signup, params: { email: new_email, google_id: google_id, token: api_token }
        end.not_to change(User, :count)
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :google_signup, params: { google_id: google_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when google_id is missing" do
        post :google_signup, params: { email: new_email, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Google ID is required")
      end

      it "returns bad request when API token is missing" do
        post :google_signup, params: { email: new_email, google_id: google_id }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end

      it "returns bad request when all parameters are missing" do
        post :google_signup, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :google_signup, params: { email: "", google_id: google_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when google_id is empty string" do
        post :google_signup, params: { email: new_email, google_id: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Google ID is required")
      end

      it "returns bad request when API token is empty string" do
        post :google_signup, params: { email: new_email, google_id: google_id, token: "" }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with invalid API token" do
      it "returns unauthorized" do
        post :google_signup, params: { email: new_email, google_id: google_id, token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid token")
      end
    end

    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :google_signup, params: { email: new_email, google_id: google_id, token: api_token }

        json_response = JSON.parse(response.body)
        jwt_token = json_response["jwt"]

        jwt_secret = GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
        decoded_token = JWT.decode(jwt_token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        new_user = User.find_by(email: new_email)
        expect(payload["user_id"]).to eq(new_user.id)
        expect(payload["email"]).to eq(new_user.email)
        expect(payload["exp"]).to be > Time.current.to_i
        expect(payload["exp"]).to be <= 1.month.from_now.to_i
      end
    end
  end

  describe "POST #github_login" do
    let!(:user) { create(:user, email: email) }

    context "with valid parameters" do
      it "returns a JWT token and user data" do
        post :github_login, params: { email: email, github_id: github_id, token: api_token }

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["id"]).to eq(user.id)
        expect(json_response["user"]["email"]).to eq(user.email)
        expect(json_response["user"]["name"]).to eq(user.name)
        expect(json_response["user"]["legal_name"]).to eq(user.legal_name)
        expect(json_response["user"]["preferred_name"]).to eq(user.preferred_name)
      end

      it "updates user's github_uid when blank" do
        user.update!(github_uid: nil)

        post :github_login, params: { email: email, github_id: github_id, token: api_token }

        user.reload
        expect(user.github_uid).to eq(github_id)
      end

      it "does not update github_uid when already present" do
        existing_github_id = "existing_github_id"
        user.update!(github_uid: existing_github_id)

        post :github_login, params: { email: email, github_id: github_id, token: api_token }

        user.reload
        expect(user.github_uid).to eq(existing_github_id)
      end

      it "updates current_sign_in_at" do
        freeze_time do
          post :github_login, params: { email: email, github_id: github_id, token: api_token }

          user.reload
          expect(user.current_sign_in_at).to eq(Time.current)
        end
      end
    end

    context "with non-existent user" do
      it "returns not found" do
        post :github_login, params: { email: "nonexistent@example.com", github_id: github_id, token: api_token }

        expect(response).to have_http_status(:not_found)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("User not found")
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :github_login, params: { github_id: github_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when github_id is missing" do
        post :github_login, params: { email: email, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("GitHub ID is required")
      end

      it "returns bad request when API token is missing" do
        post :github_login, params: { email: email, github_id: github_id }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end

      it "returns bad request when all parameters are missing" do
        post :github_login, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :github_login, params: { email: "", github_id: github_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when github_id is empty string" do
        post :github_login, params: { email: email, github_id: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("GitHub ID is required")
      end

      it "returns bad request when API token is empty string" do
        post :github_login, params: { email: email, github_id: github_id, token: "" }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with invalid API token" do
      it "returns unauthorized" do
        post :github_login, params: { email: email, github_id: github_id, token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid token")
      end
    end

    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :github_login, params: { email: email, github_id: github_id, token: api_token }

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
  end

  describe "POST #github_signup" do
    let(:new_email) { "newuser@example.com" }

    context "with valid parameters" do
      it "creates a new user and returns JWT" do
        expect do
          post :github_signup, params: { email: new_email, github_id: github_id, token: api_token }
        end.to change(User, :count).by(1)

        expect(response).to have_http_status(:ok)

        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(new_email)

        new_user = User.find_by(email: new_email)
        expect(new_user).to be_present
        expect(new_user.github_uid).to eq(github_id)
        expect(new_user.confirmed_at).to be_present
        expect(new_user.invitation_accepted_at).to be_present
        expect(new_user.tos_agreements).to exist
      end

      it "creates a default company for the user" do
        expect do
          post :github_signup, params: { email: new_email, github_id: github_id, token: api_token }
        end.to change(Company, :count).by(1)
          .and change(CompanyAdministrator, :count).by(1)

        new_user = User.find_by(email: new_email)
        expect(new_user.companies).to exist
      end
    end

    context "with invitation token" do
      let!(:company) { create(:company) }
      let!(:invite_link) { create(:company_invite_link, company: company) }

      it "creates user without default company when invitation token is provided" do
        expect do
          post :github_signup, params: {
            email: new_email,
            github_id: github_id,
            invitation_token: invite_link.token,
            token: api_token,
          }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(0)
          .and change(CompanyAdministrator, :count).by(0)

        new_user = User.find_by(email: new_email)
        expect(new_user.signup_invite_link).to eq(invite_link)
      end

      it "handles invalid invitation token gracefully" do
        expect do
          post :github_signup, params: {
            email: new_email,
            github_id: github_id,
            invitation_token: "invalid_token",
            token: api_token,
          }
        end.to change(User, :count).by(1)
          .and change(Company, :count).by(1)

        new_user = User.find_by(email: new_email)
        expect(new_user.signup_invite_link).to be_nil
      end
    end

    context "with existing user" do
      let!(:existing_user) { create(:user, email: new_email) }

      it "returns conflict error" do
        post :github_signup, params: { email: new_email, github_id: github_id, token: api_token }

        expect(response).to have_http_status(:conflict)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("An account with this email already exists. Please log in instead.")
      end

      it "does not create a new user" do
        expect do
          post :github_signup, params: { email: new_email, github_id: github_id, token: api_token }
        end.not_to change(User, :count)
      end
    end

    context "with missing parameters" do
      it "returns bad request when email is missing" do
        post :github_signup, params: { github_id: github_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when github_id is missing" do
        post :github_signup, params: { email: new_email, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("GitHub ID is required")
      end

      it "returns bad request when API token is missing" do
        post :github_signup, params: { email: new_email, github_id: github_id }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end

      it "returns bad request when all parameters are missing" do
        post :github_signup, params: {}

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with empty parameters" do
      it "returns bad request when email is empty string" do
        post :github_signup, params: { email: "", github_id: github_id, token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns bad request when github_id is empty string" do
        post :github_signup, params: { email: new_email, github_id: "", token: api_token }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("GitHub ID is required")
      end

      it "returns bad request when API token is empty string" do
        post :github_signup, params: { email: new_email, github_id: github_id, token: "" }

        expect(response).to have_http_status(:bad_request)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end

    context "with invalid API token" do
      it "returns unauthorized" do
        post :github_signup, params: { email: new_email, github_id: github_id, token: "invalid_token" }

        expect(response).to have_http_status(:unauthorized)

        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Invalid token")
      end
    end

    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :github_signup, params: { email: new_email, github_id: github_id, token: api_token }

        json_response = JSON.parse(response.body)
        jwt_token = json_response["jwt"]

        jwt_secret = GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
        decoded_token = JWT.decode(jwt_token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        new_user = User.find_by(email: new_email)
        expect(payload["user_id"]).to eq(new_user.id)
        expect(payload["email"]).to eq(new_user.email)
        expect(payload["exp"]).to be > Time.current.to_i
        expect(payload["exp"]).to be <= 1.month.from_now.to_i
      end
    end
  end
end
