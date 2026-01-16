# frozen_string_literal: true

# spec/requests/internal/github_connections_spec.rb
require "rails_helper"

RSpec.describe "Internal::GithubConnections", type: :request do
  let(:user) { create(:user) }
  let(:state) { "random_secure_state_string" }

  before do
    # Assuming a helper method to sign in users for JSON requests
    sign_in(user)
    allow(SecureRandom).to receive(:hex).and_return(state)
    allow(ENV).to receive(:[]).with("GH_CLIENT_ID").and_return("test_id")
    allow(ENV).to receive(:[]).with("GH_CLIENT_SECRET").and_return("test_secret")
  end

  describe "POST /start" do
    it "returns a github authorization url and sets an encrypted cookie" do
      post "/internal/github_connection/start"

      expect(response).to have_http_status(:ok)
      expect(json_response["url"]).to include("state=#{state}")
      expect(json_response["url"]).to include("client_id=test_id")
      expect(cookies.encrypted[:github_oauth_state]).to eq(state)
    end
  end

  describe "POST /callback" do
    let(:code) { "valid_code" }

    context "with valid state and code" do
      before do
        # Manually set the encrypted cookie for the request
        cookies.encrypted[:github_oauth_state] = state

        # Mock Octokit Token Exchange
        allow(Octokit).to receive(:exchange_code_for_token).and_return({ access_token: "gh_token" })

        # Mock Octokit User Info
        mock_gh_user = double(id: 12345, login: "github_dev_user")
        allow_any_instance_of(Octokit::Client).to receive(:user).and_return(mock_gh_user)
      end

      it "updates the user and returns success" do
        post "/internal/github_connection/callback", params: { code: code, state: state }

        expect(response).to have_http_status(:ok)
        expect(json_response["success"]).to be true
        expect(json_response["github_username"]).to eq("github_dev_user")

        user.reload
        expect(user.github_uid).to eq(12345)
        expect(user.github_username).to eq("github_dev_user")
        expect(cookies[:github_oauth_state]).to be_nil # Check cleanup
      end
    end

    context "with invalid state" do
      it "returns unauthorized status" do
        cookies.encrypted[:github_oauth_state] = "different_state"

        post "/internal/github_connection/callback", params: { code: code, state: state }

        expect(response).to have_http_status(:unauthorized)
        expect(json_response["error"]).to eq("Invalid state")
      end
    end
  end

  describe "DELETE /disconnect" do
    before do
      user.update(github_uid: 123, github_username: "old_user")
    end

    it "clears github info from user" do
      delete "/internal/github_connection/disconnect"

      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.github_uid).to be_nil
      expect(user.github_username).to be_nil
    end
  end
end

# Helper for parsing JSON responses
def json_response
  JSON.parse(response.body)
end
