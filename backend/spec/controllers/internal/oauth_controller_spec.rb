# frozen_string_literal: true

require "spec_helper"

RSpec.describe Internal::OauthController, type: :controller do
  let(:email) { "oauthuser@example.com" }

  describe "POST #create" do
    context "with valid parameters" do
      it "creates a user and returns JWT" do
        expect do
          post :create, params: { email: email }
        end.to change(User, :count).by(1)
        expect(response).to have_http_status(:created).or have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)
      end

      it "returns existing user if already present" do
        User.create!(email: email)
        expect do
          post :create, params: { email: email }
        end.not_to change(User, :count)
        expect(response).to have_http_status(:ok)
        json_response = JSON.parse(response.body)
        expect(json_response["user"]["email"]).to eq(email)
      end

      it "updates current_sign_in_at for existing user on login" do
        user = User.create!(email: email, current_sign_in_at: 2.days.ago)
        expect do
          post :create, params: { email: email }
        end.not_to change(User, :count)
        user.reload
        expect(user.current_sign_in_at).to be_within(5.seconds).of(Time.current)
      end
    end

    context "with missing parameters" do
      it "returns error if email is missing" do
        post :create, params: {}
        expect(response).to have_http_status(:bad_request).or have_http_status(:unprocessable_entity)
        json_response = JSON.parse(response.body)
        expect(json_response["error"]).to eq("Email is required")
      end
    end


    context "JWT token validation" do
      it "generates a valid JWT token" do
        post :create, params: { email: email }
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
  end
end
