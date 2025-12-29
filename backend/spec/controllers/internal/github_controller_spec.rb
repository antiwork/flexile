# frozen_string_literal: true

RSpec.describe Internal::GithubController do
  let(:user) { create(:user) }
  let(:jwt_token) { JwtService.generate_token(user) }

  before do
    request.headers["x-flexile-auth"] = "Bearer #{jwt_token}"
    allow(GlobalConfig).to receive(:get).and_call_original
    allow(GlobalConfig).to receive(:get).with("GH_CLIENT_ID").and_return("test_client_id")
    allow(GlobalConfig).to receive(:get).with("GH_CLIENT_SECRET").and_return("test_client_secret")
  end

  describe "GET #oauth_url" do

    it "returns a GitHub OAuth URL" do
      get :oauth_url, params: { redirect_uri: "https://example.com/callback" }

      expect(response).to have_http_status(:ok)

      json_response = response.parsed_body
      expect(json_response["url"]).to include("github.com/login/oauth/authorize")
      expect(json_response["url"]).to include("client_id=test_client_id")
      expect(json_response["url"]).to include("redirect_uri=")
    end

    it "stores state in session" do
      get :oauth_url

      expect(session[:github_oauth_state]).to be_present
    end

    context "without authentication" do
      before do
        request.headers["x-flexile-auth"] = nil
      end

      it "returns unauthorized" do
        get :oauth_url

        expect(response).to have_http_status(:unauthorized)
      end
    end
  end

  describe "POST #callback" do
    let(:oauth_state) { SecureRandom.hex(32) }

    before do
      session[:github_oauth_state] = oauth_state
    end

    it "exchanges code for token and saves GitHub info" do
      stub_request(:post, "https://github.com/login/oauth/access_token")
        .to_return(
          status: 200,
          body: { access_token: "gho_test_token" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/user")
        .to_return(
          status: 200,
          body: {
            id: 12345,
            login: "testuser",
            email: "test@github.com",
            avatar_url: "https://avatars.githubusercontent.com/u/12345",
            name: "Test User"
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      post :callback, params: {
        code: "test_code",
        state: oauth_state,
        redirect_uri: "https://example.com/callback"
      }

      expect(response).to have_http_status(:ok)

      json_response = response.parsed_body
      expect(json_response["success"]).to be true
      expect(json_response["github_username"]).to eq("testuser")

      user.reload
      expect(user.github_uid).to eq("12345")
      expect(user.github_username).to eq("testuser")
      expect(user.github_access_token).to eq("gho_test_token")
    end

    it "clears OAuth state from session after successful callback" do
      stub_request(:post, "https://github.com/login/oauth/access_token")
        .to_return(
          status: 200,
          body: { access_token: "gho_test_token" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/user")
        .to_return(
          status: 200,
          body: { id: 12345, login: "testuser" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      post :callback, params: { code: "test_code", state: oauth_state }

      expect(session[:github_oauth_state]).to be_nil
    end

    it "returns error when state is invalid" do
      post :callback, params: { code: "test_code", state: "invalid_state" }

      expect(response).to have_http_status(:bad_request)

      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Invalid state parameter")
    end

    it "returns error when state is missing" do
      post :callback, params: { code: "test_code" }

      expect(response).to have_http_status(:bad_request)

      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Invalid state parameter")
    end

    it "returns conflict when GitHub account is already connected to another user" do
      other_user = create(:user, github_uid: "12345", github_username: "testuser")

      stub_request(:post, "https://github.com/login/oauth/access_token")
        .to_return(
          status: 200,
          body: { access_token: "gho_test_token" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/user")
        .to_return(
          status: 200,
          body: { id: 12345, login: "testuser" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      post :callback, params: { code: "test_code", state: oauth_state }

      expect(response).to have_http_status(:conflict)

      json_response = response.parsed_body
      expect(json_response["error"]).to eq("This GitHub account is already connected to another user")
    end

    it "returns error when OAuth fails" do
      stub_request(:post, "https://github.com/login/oauth/access_token")
        .to_return(
          status: 200,
          body: { error: "bad_verification_code", error_description: "The code is invalid" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      post :callback, params: { code: "bad_code", state: oauth_state }

      expect(response).to have_http_status(:bad_request)

      json_response = response.parsed_body
      expect(json_response["error"]).to eq("The code is invalid")
    end
  end

  describe "DELETE #disconnect" do
    before do
      user.update!(
        github_uid: "12345",
        github_username: "testuser",
        github_access_token: "gho_test_token"
      )
    end

    it "removes GitHub connection from user" do
      delete :disconnect

      expect(response).to have_http_status(:no_content)

      user.reload
      expect(user.github_uid).to be_nil
      expect(user.github_username).to be_nil
      expect(user.github_access_token).to be_nil
    end

    context "when user has no GitHub connection" do
      before do
        user.update!(github_uid: nil, github_username: nil, github_access_token: nil)
      end

      it "returns forbidden" do
        delete :disconnect

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe "GET #pr" do
    before do
      user.update!(github_access_token: "gho_test_token")
    end

    it "fetches PR details from GitHub" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [{ name: "$100" }],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      get :pr, params: { url: "https://github.com/owner/repo/pull/123" }

      expect(response).to have_http_status(:ok)

      json_response = response.parsed_body
      expect(json_response["pr"]["number"]).to eq(123)
      expect(json_response["pr"]["title"]).to eq("Fix bug")
      expect(json_response["pr"]["bounty_cents"]).to eq(10000)
    end

    it "returns error for invalid PR URL" do
      get :pr, params: { url: "https://github.com/owner/repo" }

      expect(response).to have_http_status(:bad_request)

      json_response = response.parsed_body
      expect(json_response["error"]).to eq("Invalid GitHub PR URL")
    end

    context "when user has no GitHub connection" do
      before do
        user.update!(github_access_token: nil)
      end

      it "returns error" do
        get :pr, params: { url: "https://github.com/owner/repo/pull/123" }

        expect(response).to have_http_status(:unprocessable_entity)

        json_response = response.parsed_body
        expect(json_response["error"]).to eq("GitHub account not connected")
      end
    end
  end
end
