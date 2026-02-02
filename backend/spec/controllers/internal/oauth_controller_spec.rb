# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::OauthController, type: :controller do
  let(:email) { "oauthuser@example.com" }
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }

  describe "POST #create" do
    context "with valid parameters" do
      it "creates a user and returns JWT" do
        expect do
          post :create, params: { email: email, token: api_token }
        end.to change(User, :count).by(1)
        expect(response).to have_http_status(:created).or have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)
      end

      it "returns existing user if already present" do
        User.create!(email: email)
        expect do
          post :create, params: { email: email, token: api_token }
        end.not_to change(User, :count)
        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["user"]["email"]).to eq(email)
      end

      it "updates current_sign_in_at for existing user on login" do
        user = User.create!(email: email, current_sign_in_at: 2.days.ago)
        expect do
          post :create, params: { email: email, token: api_token }
        end.not_to change(User, :count)
        user.reload
        expect(user.current_sign_in_at).to be_within(5.seconds).of(Time.current)
      end
    end

    context "with missing parameters" do
      it "returns error if email is missing" do
        post :create, params: { token: api_token }
        expect(response).to have_http_status(:bad_request).or have_http_status(:unprocessable_entity)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end

      it "returns error if token is missing" do
        post :create, params: { email: email }
        expect(response).to have_http_status(:bad_request)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Token is required")
      end
    end


    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :create, params: { email: email, token: api_token }
        json_response = JSON.parse(response.body)
        jwt_token = json_response["jwt"]

        jwt_secret = GlobalConfig.get("JWT_SECRET", Rails.application.secret_key_base)
        decoded_token = JWT.decode(jwt_token, jwt_secret, true, { algorithm: "HS256" })
        payload = decoded_token[0]

        user = User.find_by(email: email)
        expect(payload["user_id"]).to eq(user.id)
        expect(payload["email"]).to eq(user.email)
        expect(payload["exp"]).to be > Time.current.to_i
        expect(payload["exp"]).to be <= 1.month.from_now.to_i
      end
    end

    context "with GitHub parameters" do
      let(:github_uid) { "12345" }
      let(:github_username) { "testuser" }
      let(:github_access_token) { "gho_test_token" }

      it "creates a new user with GitHub info when user does not exist" do
        expect do
          post :create, params: {
            email: email,
            token: api_token,
            github_uid: github_uid,
            github_username: github_username,
            github_access_token: github_access_token,
          }
        end.to change(User, :count).by(1)

        expect(response).to have_http_status(:created)
        user = User.find_by(email: email)
        expect(user.github_uid).to eq(github_uid)
        expect(user.github_username).to eq(github_username)
        expect(user.github_access_token).to eq(github_access_token)
      end

      it "updates existing user with GitHub info when logging in" do
        user = User.create!(email: email)
        expect(user.github_uid).to be_nil

        post :create, params: {
          email: email,
          token: api_token,
          github_uid: github_uid,
          github_username: github_username,
          github_access_token: github_access_token,
        }

        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.github_uid).to eq(github_uid)
        expect(user.github_username).to eq(github_username)
        expect(user.github_access_token).to eq(github_access_token)
      end

      it "finds existing user by github_uid even with different email" do
        existing_user = User.create!(email: "other@example.com", github_uid: github_uid, github_username: "oldusername")

        expect do
          post :create, params: {
            email: email,
            token: api_token,
            github_uid: github_uid,
            github_username: github_username,
            github_access_token: github_access_token,
          }
        end.not_to change(User, :count)

        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["user"]["email"]).to eq("other@example.com")

        existing_user.reload
        expect(existing_user.github_username).to eq(github_username)
        expect(existing_user.github_access_token).to eq(github_access_token)
      end

      it "does not update GitHub info if user already has a different github_uid" do
        user = User.create!(email: email, github_uid: "99999", github_username: "originaluser")

        post :create, params: {
          email: email,
          token: api_token,
          github_uid: github_uid,
          github_username: github_username,
          github_access_token: github_access_token,
        }

        expect(response).to have_http_status(:ok)
        user.reload
        expect(user.github_uid).to eq("99999")
        expect(user.github_username).to eq("originaluser")
      end

      it "does not store GitHub info if only github_uid is provided" do
        expect do
          post :create, params: {
            email: email,
            token: api_token,
            github_uid: github_uid,
          }
        end.to change(User, :count).by(1)

        user = User.find_by(email: email)
        expect(user.github_uid).to be_nil
      end

      it "does not store GitHub info if only github_username is provided" do
        expect do
          post :create, params: {
            email: email,
            token: api_token,
            github_username: github_username,
          }
        end.to change(User, :count).by(1)

        user = User.find_by(email: email)
        expect(user.github_username).to be_nil
      end
    end
  end
end
