# frozen_string_literal: true

RSpec.describe GithubService do
  describe ".oauth_url" do
    it "generates a valid OAuth URL with required parameters" do
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_ID").and_return("test_client_id")

      url = described_class.oauth_url(state: "test_state", redirect_uri: "https://example.com/callback")

      uri = URI.parse(url)
      params = CGI.parse(uri.query)

      expect(uri.host).to eq("github.com")
      expect(uri.path).to eq("/login/oauth/authorize")
      expect(params["client_id"]).to eq(["test_client_id"])
      expect(params["state"]).to eq(["test_state"])
      expect(params["redirect_uri"]).to eq(["https://example.com/callback"])
      expect(params["scope"]).to eq(["read:user user:email"])
    end

    it "raises ConfigurationError when GH_CLIENT_ID is not set" do
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_ID").and_return(nil)

      expect do
        described_class.oauth_url(state: "test_state", redirect_uri: "https://example.com/callback")
      end.to raise_error(GithubService::ConfigurationError, "GH_CLIENT_ID is not configured")
    end
  end

  describe ".exchange_code_for_token" do
    before do
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_ID").and_return("test_client_id")
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_SECRET").and_return("test_client_secret")
    end

    it "exchanges a code for an access token" do
      stub_request(:post, "https://github.com/login/oauth/access_token")
        .with(
          body: {
            "client_id" => "test_client_id",
            "client_secret" => "test_client_secret",
            "code" => "test_code",
            "redirect_uri" => "https://example.com/callback",
          }
        )
        .to_return(
          status: 200,
          body: { access_token: "gho_test_token" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      token = described_class.exchange_code_for_token(
        code: "test_code",
        redirect_uri: "https://example.com/callback"
      )

      expect(token).to eq("gho_test_token")
    end

    it "raises OAuthError when GitHub returns an error" do
      stub_request(:post, "https://github.com/login/oauth/access_token")
        .to_return(
          status: 200,
          body: { error: "bad_verification_code", error_description: "The code passed is incorrect" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect do
        described_class.exchange_code_for_token(code: "bad_code", redirect_uri: "https://example.com/callback")
      end.to raise_error(GithubService::OAuthError, "The code passed is incorrect")
    end

    it "raises ConfigurationError when GH_CLIENT_SECRET is not set" do
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_ID").and_return("test_client_id")
      allow(GlobalConfig).to receive(:get).with("GH_CLIENT_SECRET").and_return(nil)

      expect do
        described_class.exchange_code_for_token(code: "test_code", redirect_uri: "https://example.com/callback")
      end.to raise_error(GithubService::ConfigurationError, "GH_CLIENT_SECRET is not configured")
    end
  end

  describe ".fetch_user_info" do
    it "fetches user information from GitHub API" do
      stub_request(:get, "https://api.github.com/user")
        .with(headers: { "Authorization" => "Bearer test_token" })
        .to_return(
          status: 200,
          body: {
            id: 12345,
            login: "testuser",
            email: "test@example.com",
            avatar_url: "https://avatars.githubusercontent.com/u/12345",
            name: "Test User",
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      user_info = described_class.fetch_user_info(access_token: "test_token")

      expect(user_info[:uid]).to eq("12345")
      expect(user_info[:username]).to eq("testuser")
      expect(user_info[:email]).to eq("test@example.com")
      expect(user_info[:avatar_url]).to eq("https://avatars.githubusercontent.com/u/12345")
      expect(user_info[:name]).to eq("Test User")
    end

    it "raises ApiError when API request fails" do
      stub_request(:get, "https://api.github.com/user")
        .to_return(
          status: 401,
          body: { message: "Bad credentials" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect do
        described_class.fetch_user_info(access_token: "invalid_token")
      end.to raise_error(GithubService::ApiError, "Bad credentials")
    end
  end

  describe ".fetch_pr_details" do
    let(:pr_response) do
      {
        html_url: "https://github.com/owner/repo/pull/123",
        number: 123,
        title: "Fix bug in parser",
        state: "open",
        user: {
          login: "contributor",
          avatar_url: "https://avatars.githubusercontent.com/u/999",
        },
        labels: [],
        created_at: "2024-01-15T10:00:00Z",
        merged_at: nil,
        closed_at: nil,
      }
    end

    before do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .with(headers: { "Authorization" => "Bearer test_token" })
        .to_return(
          status: 200,
          body: pr_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "fetches PR details from GitHub API" do
      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:url]).to eq("https://github.com/owner/repo/pull/123")
      expect(pr_details[:number]).to eq(123)
      expect(pr_details[:title]).to eq("Fix bug in parser")
      expect(pr_details[:state]).to eq("open")
      expect(pr_details[:author]).to eq("contributor")
      expect(pr_details[:repo]).to eq("owner/repo")
    end

    it "returns merged state when PR is merged" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/456")
        .to_return(
          status: 200,
          body: pr_response.merge(
            number: 456,
            state: "closed",
            merged_at: "2024-01-20T15:00:00Z"
          ).to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 456
      )

      expect(pr_details[:state]).to eq("merged")
    end

    it "returns closed state when PR is closed without merge" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/789")
        .to_return(
          status: 200,
          body: pr_response.merge(
            number: 789,
            state: "closed",
            closed_at: "2024-01-20T15:00:00Z"
          ).to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 789
      )

      expect(pr_details[:state]).to eq("closed")
    end
  end

  describe ".parse_pr_url" do
    it "parses a valid GitHub PR URL" do
      result = described_class.parse_pr_url("https://github.com/antiwork/flexile/pull/1507")

      expect(result[:owner]).to eq("antiwork")
      expect(result[:repo]).to eq("flexile")
      expect(result[:pr_number]).to eq(1507)
    end

    it "parses URL with www prefix" do
      result = described_class.parse_pr_url("https://www.github.com/owner/repo/pull/42")

      expect(result[:owner]).to eq("owner")
      expect(result[:repo]).to eq("repo")
      expect(result[:pr_number]).to eq(42)
    end

    it "returns nil for invalid URLs" do
      expect(described_class.parse_pr_url("https://github.com/owner/repo")).to be_nil
      expect(described_class.parse_pr_url("https://github.com/owner/repo/issues/123")).to be_nil
      expect(described_class.parse_pr_url("https://gitlab.com/owner/repo/pull/123")).to be_nil
      expect(described_class.parse_pr_url("not a url")).to be_nil
    end
  end

  describe ".valid_pr_url?" do
    it "returns true for valid PR URLs" do
      expect(described_class.valid_pr_url?("https://github.com/owner/repo/pull/123")).to be true
    end

    it "returns false for invalid URLs" do
      expect(described_class.valid_pr_url?("https://github.com/owner/repo")).to be false
      expect(described_class.valid_pr_url?("https://github.com/owner/repo/issues/123")).to be false
    end
  end

  describe ".extract_bounty_from_labels" do
    it "extracts bounty from $100 format" do
      labels = [{ "name" => "$100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from $1,000 format with commas" do
      labels = [{ "name" => "$1,000" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(100000)
    end

    it "extracts bounty from $100.00 format with cents" do
      labels = [{ "name" => "$100.50" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10050)
    end

    it "extracts bounty from bounty:100 format" do
      labels = [{ "name" => "bounty:100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from bounty-100 format" do
      labels = [{ "name" => "bounty-100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from bounty_100 format" do
      labels = [{ "name" => "bounty_100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from bounty 100 format with space" do
      labels = [{ "name" => "bounty 100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from 100 USD format" do
      labels = [{ "name" => "100 USD" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "extracts bounty from 100 dollars format" do
      labels = [{ "name" => "100 dollars" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(10000)
    end

    it "is case insensitive for bounty patterns" do
      labels = [{ "name" => "BOUNTY:500" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(50000)
    end

    it "returns nil when no bounty label is found" do
      labels = [{ "name" => "bug" }, { "name" => "enhancement" }]
      expect(described_class.extract_bounty_from_labels(labels)).to be_nil
    end

    it "returns nil for empty labels" do
      expect(described_class.extract_bounty_from_labels([])).to be_nil
      expect(described_class.extract_bounty_from_labels(nil)).to be_nil
    end

    it "returns the first bounty found when multiple labels match" do
      labels = [{ "name" => "$50" }, { "name" => "$100" }]
      expect(described_class.extract_bounty_from_labels(labels)).to eq(5000)
    end
  end

  describe ".fetch_issue_labels" do
    it "fetches issue labels from GitHub API" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: {
            number: 42,
            labels: [{ "name" => "$500" }, { "name" => "bug" }],
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      labels = described_class.fetch_issue_labels(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        issue_number: 42
      )

      expect(labels).to eq([{ "name" => "$500" }, { "name" => "bug" }])
    end

    it "returns nil when issue is not found" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/999")
        .to_return(
          status: 404,
          body: { message: "Not Found" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      labels = described_class.fetch_issue_labels(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        issue_number: 999
      )

      expect(labels).to be_nil
    end
  end

  describe "issue label fallback for bounty" do
    it "fetches bounty from linked issue when PR has no bounty label" do
      # PR without bounty label
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Fixes #42",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [{ "name" => "bug" }],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # Issue with bounty label
      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: {
            number: 42,
            labels: [{ "name" => "$500" }],
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(50000)
    end

    it "uses PR bounty when both PR and issue have bounty labels" do
      # PR with bounty label
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Fixes #42",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [{ "name" => "$100" }],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # Should not fetch issue since PR has bounty
      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(10000)
    end

    it "handles 'closes' keyword" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Closes #42",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "bounty:200" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(20000)
    end

    it "handles 'resolves' keyword" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Resolves #42",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "$300" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(30000)
    end

    it "returns nil bounty when neither PR nor issue has bounty" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Fixes #42",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [{ "name" => "bug" }],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "enhancement" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to be_nil
    end

    it "handles PR with no linked issues" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "This is just a description without any issue reference",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to be_nil
    end

    it "handles PR with nil body" do
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: nil,
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to be_nil
    end
  end

  describe ".fetch_pr_details_from_url" do
    it "parses URL and fetches PR details" do
      stub_request(:get, "https://api.github.com/repos/antiwork/flexile/pulls/1507")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/antiwork/flexile/pull/1507",
            number: 1507,
            title: "GitHub Integration",
            state: "open",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [{ name: "$3000" }],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details_from_url(
        access_token: "test_token",
        url: "https://github.com/antiwork/flexile/pull/1507"
      )

      expect(pr_details[:number]).to eq(1507)
      expect(pr_details[:bounty_cents]).to eq(300000)
    end

    it "returns nil for invalid URLs" do
      result = described_class.fetch_pr_details_from_url(
        access_token: "test_token",
        url: "https://github.com/owner/repo"
      )

      expect(result).to be_nil
    end
  end
end
