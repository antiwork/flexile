# frozen_string_literal: true

# spec/requests/internal/github_connections_spec.rb
require "rails_helper"

RSpec.describe "Internal::GithubConnections", type: :request do
  let(:user) { create(:user) }
  let(:state) { "random_secure_state_string".dup }
  let(:user_jwt) { JwtService.generate_token(user) }
  let(:auth_headers) { { "x-flexile-auth" => "Bearer #{user_jwt}" } }

  before do
    create(:company_worker, user: user)
    allow(JwtService).to receive(:generate_oauth_state).and_return(state)
    allow(JwtService).to receive(:decode_oauth_state).with(state).and_return({ user_id: user.id })
    allow(ENV).to receive(:[]).and_call_original
    allow(ENV).to receive(:[]).with("GH_CLIENT_ID").and_return("test_id")
    allow(ENV).to receive(:[]).with("GH_CLIENT_SECRET").and_return("test_secret")
    allow(ENV).to receive(:[]).with("PROTOCOL").and_return("http")
    allow(ENV).to receive(:[]).with("DOMAIN").and_return("localhost:3100")
    allow(ENV).to receive(:[]).with("APP_DOMAIN").and_return("localhost:3100")
    allow(ENV).to receive(:[]).with("API_DOMAIN").and_return("localhost:3101")
  end

  describe "POST /start" do
    it "returns a github authorization url and sets a cookie" do
      post "/internal/github_connection/start", headers: auth_headers
      expect(response).to have_http_status(:ok)

      json_response = JSON.parse(response.body)
      expect(json_response["url"]).to include("github.com/login/oauth/authorize")
      expect(json_response["url"]).to include("client_id=test_id")

      expected_callback = callback_github_connection_url(protocol: PROTOCOL, host: API_DOMAIN)
      expect(json_response["url"]).to include("redirect_uri=#{CGI.escape(expected_callback)}")
      expect(json_response["url"]).to include("state=#{state}")
    end
  end

  describe "GET /internal/github_connection/callback" do
    let(:code) { "valid_code" }
    let(:github_user) { double("GithubUser", id: 12345, login: "github_dev_user") }
    let(:token_response) { { access_token: "gh_token" } }

    before do
      allow(Octokit).to receive(:exchange_code_for_token).and_return(token_response)
      allow(Octokit::Client).to receive(:new).and_return(double(user: github_user))
    end

    context "with valid state and code" do
      it "updates the user and redirects to frontend" do
        get "/internal/github_connection/callback", params: { code: code, state: state }

        expect(response).to have_http_status(:redirect)
        expect(response).to redirect_to("#{PROTOCOL}://#{DOMAIN}/settings/account?github=success")

        user.reload
        expect(user.github_uid.to_s).to eq("12345")
        expect(user.github_username).to eq("github_dev_user")
      end

      it "redirects to custom redirect_url if provided" do
        custom_url = "#{PROTOCOL}://#{DOMAIN}/custom"
        cookies[:github_oauth_redirect_url] = custom_url
        get "/internal/github_connection/callback", params: { code: code, state: state }
        expect(response).to redirect_to("#{custom_url}?github=success")
      end
    end

    context "with invalid state" do
      it "returns unauthorized status" do
        allow(JwtService).to receive(:decode_oauth_state).with("different_state").and_return(nil)
        get "/internal/github_connection/callback", params: { code: code, state: "different_state" }
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "DELETE /disconnect" do
    before do
      user.update(github_uid: 123, github_username: "old_user")
    end

    it "clears github info from user" do
      delete "/internal/github_connection/disconnect", headers: auth_headers

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
