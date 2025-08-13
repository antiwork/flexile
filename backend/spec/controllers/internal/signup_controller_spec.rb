# frozen_string_literal: true

RSpec.describe Internal::SignupController do
  let(:api_token) { GlobalConfig.get("API_SECRET_TOKEN", Rails.application.secret_key_base) }
  let(:email) { "newuser@example.com" }

  describe "POST #send_otp" do
    context "with valid email" do
      it "creates a temporary user and sends OTP" do
        expect do
          post :send_otp, params: { email: email, token: api_token }
        end.to change(User, :count).by(1)
          .and have_enqueued_mail(UserMailer, :otp_code)

        expect(response).to have_http_status(:ok)
        json_response = response.parsed_body
        expect(json_response["message"]).to eq("OTP sent successfully")

        temp_user = User.find_by(email: email)
        expect(temp_user).to be_present
        expect(temp_user.email).to eq(email)
      end
    end

    context "with existing user" do
      let!(:existing_user) { create(:user, email: email) }

      it "returns conflict error" do
        post :send_otp, params: { email: email, token: api_token }

        expect(response).to have_http_status(:conflict)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("An account with this email already exists. Please log in instead.")
      end
    end

    context "with missing email" do
      it "returns bad request" do
        post :send_otp, params: { token: api_token }

        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Email is required")
      end
    end
  end

  describe "POST #verify_and_create" do
    let!(:temp_user) { User.create!(email: email, otp_secret_key: User.otp_random_secret) }
    let(:valid_otp) { temp_user.otp_code }

    context "with valid parameters" do
      it "completes user signup and returns JWT" do
        post :verify_and_create, params: {
          email: email,
          otp_code: valid_otp,
          token: api_token,
        }

        expect(response).to have_http_status(:created)
        json_response = response.parsed_body
        expect(json_response["jwt"]).to be_present
        expect(json_response["user"]["email"]).to eq(email)

        temp_user.reload
        expect(temp_user.confirmed_at).to be_present
        expect(temp_user.invitation_accepted_at).to be_present
        expect(temp_user.tos_agreements).to exist
      end

      it "creates a default company for the user" do
        expect do
          post :verify_and_create, params: {
            email: email,
            otp_code: valid_otp,
            token: api_token,
          }
        end.to change(Company, :count).by(1)
          .and change(CompanyAdministrator, :count).by(1)

        temp_user.reload
        expect(temp_user.companies).to exist
      end
    end

    context "with invalid OTP" do
      it "returns unauthorized" do
        post :verify_and_create, params: {
          email: email,
          otp_code: "999999",
          token: api_token,
        }

        expect(response).to have_http_status(:unauthorized)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Invalid verification code, please try again.")
      end
    end

    context "with invalid email" do
      it "returns not found" do
        post :verify_and_create, params: {
          email: "nonexistent@example.com",
          otp_code: valid_otp,
          token: api_token,
        }

        expect(response).to have_http_status(:not_found)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Invalid signup session")
      end
    end

    context "with missing parameters" do
      it "returns bad request when params are missing" do
        post :verify_and_create, params: { token: api_token }

        expect(response).to have_http_status(:bad_request)
        json_response = response.parsed_body
        expect(json_response["error"]).to eq("Email and OTP code are required")
      end
    end
  end
end
