# frozen_string_literal: true

RSpec.describe GithubService do
  # Helper to stub the GitHub App token flow
  def stub_app_token(org_name: "owner", token: "test_token")
    allow(GlobalConfig).to receive(:get).with("GH_APP_ID").and_return("12345")
    allow(GlobalConfig).to receive(:get).with("GH_APP_PRIVATE_KEY").and_return(OpenSSL::PKey::RSA.generate(2048).to_pem)

    stub_request(:get, "https://api.github.com/app/installations")
      .to_return(
        status: 200,
        body: [{ "id" => 999, "account" => { "login" => org_name, "id" => 1 } }].to_json,
        headers: { "Content-Type" => "application/json" }
      )

    stub_request(:post, "https://api.github.com/app/installations/999/access_tokens")
      .to_return(
        status: 201,
        body: { "token" => token }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  # Helper to stub GraphQL requests for linked issues
  def stub_graphql_linked_issues(owner:, repo:, pr_number:, issues: [])
    graphql_response = {
      "data" => {
        "repository" => {
          "pullRequest" => {
            "closingIssuesReferences" => {
              "nodes" => issues.map do |issue|
                {
                  "number" => issue[:number],
                  "labels" => {
                    "nodes" => (issue[:labels] || []).map { |l| { "name" => l } },
                  },
                }
              end,
            },
          },
        },
      },
    }

    stub_request(:post, "https://api.github.com/graphql")
      .to_return(
        status: 200,
        body: graphql_response.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end
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
      end.to raise_error(GithubService::ConfigurationError, "GH_CLIENT_ID not configured")
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
      end.to raise_error(GithubService::ConfigurationError, "GH_CLIENT_SECRET not configured")
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
      stub_app_token(org_name: "owner")

      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .with(headers: { "Authorization" => "Bearer test_token" })
        .to_return(
          status: 200,
          body: pr_response.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])
    end

    it "fetches PR details from GitHub API" do
      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
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
      expect(pr_details[:linked_issue_number]).to be_nil
      expect(pr_details[:linked_issue_repo]).to be_nil
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
      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 456, issues: [])

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
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
      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 789, issues: [])

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
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


  describe "issue label fallback for bounty" do
    before do
      stub_app_token(org_name: "owner")
    end

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

      # GraphQL returns no UI-linked issues, so it falls back to parsing PR body
      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      # Issue with bounty label (fetched via REST after parsing PR body)
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
        org_name: "owner",
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
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(10000)
      # When bounty is on PR itself, no linked issue info
      expect(pr_details[:linked_issue_number]).to be_nil
      expect(pr_details[:linked_issue_repo]).to be_nil
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

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "bounty:200" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(20000)
      expect(pr_details[:linked_issue_number]).to eq(42)
      expect(pr_details[:linked_issue_repo]).to eq("owner/repo")
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

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "$300" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(30000)
      expect(pr_details[:linked_issue_number]).to eq(42)
      expect(pr_details[:linked_issue_repo]).to eq("owner/repo")
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

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      stub_request(:get, "https://api.github.com/repos/owner/repo/issues/42")
        .to_return(
          status: 200,
          body: { number: 42, labels: [{ "name" => "enhancement" }] }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
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

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
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

      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to be_nil
    end

    it "fetches bounty from UI-linked issue (via GraphQL)" do
      # PR without bounty label and no issue reference in body
      stub_request(:get, "https://api.github.com/repos/owner/repo/pulls/123")
        .to_return(
          status: 200,
          body: {
            html_url: "https://github.com/owner/repo/pull/123",
            number: 123,
            title: "Fix bug",
            state: "open",
            body: "Just a description, no issue keywords",
            user: { login: "contributor", avatar_url: "https://example.com/avatar" },
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # GraphQL returns UI-linked issue with bounty label
      stub_graphql_linked_issues(
        owner: "owner",
        repo: "repo",
        pr_number: 123,
        issues: [{ number: 42, labels: ["$500"] }]
      )

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      # Should get bounty from UI-linked issue without needing to parse body
      expect(pr_details[:bounty_cents]).to eq(50000)
      expect(pr_details[:linked_issue_number]).to eq(42)
      expect(pr_details[:linked_issue_repo]).to eq("owner/repo")
    end

    it "avoids duplicate API calls when issue is both UI-linked and in PR body" do
      # PR with issue reference in body
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
            labels: [],
            created_at: "2024-01-15T10:00:00Z",
            merged_at: nil,
            closed_at: nil,
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # GraphQL returns the same issue (UI-linked) with bounty
      stub_graphql_linked_issues(
        owner: "owner",
        repo: "repo",
        pr_number: 123,
        issues: [{ number: 42, labels: ["$500"] }]
      )

      # Should NOT make a REST call for issue #42 since GraphQL already returned it
      # (No stub_request for issues/42, so test would fail if it tries to fetch)

      pr_details = described_class.fetch_pr_details(
        org_name: "owner",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(pr_details[:bounty_cents]).to eq(50000)
      expect(pr_details[:linked_issue_number]).to eq(42)
      expect(pr_details[:linked_issue_repo]).to eq("owner/repo")
    end
  end

  describe ".fetch_linked_issues" do
    it "fetches UI-linked issues via GraphQL API" do
      stub_graphql_linked_issues(
        owner: "owner",
        repo: "repo",
        pr_number: 123,
        issues: [
          { number: 42, labels: ["$500", "bug"] },
          { number: 99, labels: ["enhancement"] },
        ]
      )

      issues = described_class.fetch_linked_issues(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(issues.length).to eq(2)
      expect(issues[0][:number]).to eq(42)
      expect(issues[0][:labels]).to eq([{ "name" => "$500" }, { "name" => "bug" }])
      expect(issues[1][:number]).to eq(99)
      expect(issues[1][:labels]).to eq([{ "name" => "enhancement" }])
    end

    it "returns empty array when no issues are linked" do
      stub_graphql_linked_issues(owner: "owner", repo: "repo", pr_number: 123, issues: [])

      issues = described_class.fetch_linked_issues(
        access_token: "test_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(issues).to eq([])
    end

    it "returns empty array when GraphQL request fails" do
      stub_request(:post, "https://api.github.com/graphql")
        .to_return(
          status: 401,
          body: { message: "Bad credentials" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      issues = described_class.fetch_linked_issues(
        access_token: "invalid_token",
        owner: "owner",
        repo: "repo",
        pr_number: 123
      )

      expect(issues).to eq([])
    end
  end

  describe ".extract_linked_issue_numbers" do
    let(:owner) { "antiwork" }
    let(:repo) { "gumroad" }

    it "extracts issue numbers from 'fixes #123' format" do
      body = "This PR fixes #42"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([42])
    end

    it "extracts issue numbers from 'closes #123' format" do
      body = "Closes #99"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([99])
    end

    it "extracts issue numbers from 'resolves #123' format" do
      body = "Resolves #7"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([7])
    end

    it "handles various verb tenses (fix, fixed, fixes)" do
      body = "Fix #1, fixed #2, fixes #3"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to contain_exactly(1, 2, 3)
    end

    it "extracts issue numbers from cross-repo references" do
      body = "Fixes antiwork/gumroad#123"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([123])
    end

    it "extracts issue numbers from 'Issue: #123' format (PR template)" do
      body = "Issue: #456\n\n# Description\nSome description here"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([456])
    end

    it "handles 'Issue: #' format case-insensitively" do
      body = "issue: #789"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([789])
    end

    it "handles 'Issue:' with varying whitespace" do
      body = "Issue:   #321"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([321])
    end

    it "extracts issue numbers from full GitHub issue URLs" do
      body = "Issue: https://github.com/antiwork/gumroad/issues/42"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([42])
    end

    it "handles https and http URLs" do
      body = "http://github.com/antiwork/gumroad/issues/42"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([42])
    end

    it "only matches URLs for the same owner/repo" do
      body = "https://github.com/other/repo/issues/42"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([])
    end

    it "extracts multiple issue numbers from mixed formats" do
      body = <<~BODY
        Issue: #1

        # Description
        This also fixes #2 and closes #3

        Related: https://github.com/antiwork/gumroad/issues/4
      BODY
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to contain_exactly(1, 2, 3, 4)
    end

    it "returns unique issue numbers when duplicates exist" do
      body = "Fixes #42, also closes #42"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([42])
    end

    it "returns empty array when no issues are linked" do
      body = "This is just a description with no issue references"
      expect(described_class.send(:extract_linked_issue_numbers, body, owner, repo)).to eq([])
    end

    it "handles nil body" do
      expect(described_class.send(:extract_linked_issue_numbers, nil.to_s, owner, repo)).to eq([])
    end

    it "handles empty body" do
      expect(described_class.send(:extract_linked_issue_numbers, "", owner, repo)).to eq([])
    end
  end
end
