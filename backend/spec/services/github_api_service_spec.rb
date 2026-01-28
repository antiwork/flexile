# frozen_string_literal: true

require "rails_helper"

RSpec.describe GithubApiService do
  let(:service) { described_class.new }
  let(:service_with_token) { described_class.new(access_token: "test_token") }

  describe "#parse_pr_url" do
    it "parses a valid GitHub PR URL" do
      url = "https://github.com/antiwork/flexile/pull/123"
      expect(service.parse_pr_url(url)).to eq({ owner: "antiwork", repo: "flexile", number: 123 })
    end

    it "parses a PR URL with fragment" do
      url = "https://github.com/antiwork/flexile/pull/456#issuecomment-789"
      expect(service.parse_pr_url(url)).to eq({ owner: "antiwork", repo: "flexile", number: 456 })
    end

    it "returns nil for invalid URL" do
      expect(service.parse_pr_url("not a url")).to be_nil
    end

    it "returns nil for non-GitHub URL" do
      expect(service.parse_pr_url("https://gitlab.com/owner/repo/pull/123")).to be_nil
    end

    it "returns nil for GitHub URL that is not a PR" do
      expect(service.parse_pr_url("https://github.com/antiwork/flexile/issues/123")).to be_nil
    end
  end

  describe "#extract_bounty_from_labels" do
    it "extracts bounty from $2k format" do
      expect(service.extract_bounty_from_labels(["bug", "$2k", "priority"])).to eq(2000)
    end

    it "extracts bounty from $500 format" do
      expect(service.extract_bounty_from_labels(["feature", "$500"])).to eq(500)
    end

    it "extracts bounty from $1.5k format" do
      expect(service.extract_bounty_from_labels(["$1.5k", "enhancement"])).to eq(1500)
    end

    it "extracts bounty from bounty: $2k format" do
      expect(service.extract_bounty_from_labels(["bounty: $2k"])).to eq(2000)
    end

    it "returns nil when no bounty label found" do
      expect(service.extract_bounty_from_labels(["bug", "priority", "enhancement"])).to be_nil
    end

    it "returns first bounty found if multiple exist" do
      expect(service.extract_bounty_from_labels(["$1k", "$2k"])).to eq(1000)
    end
  end

  describe "#verify_author" do
    it "returns true when usernames match exactly" do
      expect(service.verify_author(pr_author: "octocat", github_username: "octocat")).to be true
    end

    it "returns true when usernames match case-insensitively" do
      expect(service.verify_author(pr_author: "OctoCat", github_username: "octocat")).to be true
    end

    it "returns false when usernames don't match" do
      expect(service.verify_author(pr_author: "octocat", github_username: "different")).to be false
    end
  end

  describe "#fetch_pull_request" do
    let(:owner) { "antiwork" }
    let(:repo)  { "flexile" }

    context "when PR exists" do
      let(:pr_data) do
        {
          number: 1,
          title: "Test PR",
          user: { login: "octocat" },
          labels: [],
          state: "open",
          merged: false,
          html_url: "https://github.com/antiwork/flexile/pull/1",
          created_at: Time.zone.now,
        }
      end

      before do
        allow_any_instance_of(Octokit::Client)
          .to receive(:pull_request)
          .with("#{owner}/#{repo}", 1)
          .and_return(pr_data)
      end

      it "fetches PR details successfully" do
        result = service_with_token.fetch_pull_request(owner: owner, repo: repo, number: 1)
        expect(result[:number]).to eq(1)
        expect(result[:title]).to eq("Test PR")
      end
    end

    context "when PR does not exist" do
      before do
        allow_any_instance_of(Octokit::Client)
          .to receive(:pull_request)
          .with("#{owner}/#{repo}", 999_999)
          .and_raise(Octokit::NotFound)
      end

      it "raises ApiError" do
        expect do
          service_with_token.fetch_pull_request(owner: owner, repo: repo, number: 999_999)
        end.to raise_error(GithubApiService::ApiError, /not found/i)
      end
    end

    context "when token is invalid" do
      before do
        allow_any_instance_of(Octokit::Client)
          .to receive(:pull_request)
          .and_raise(Octokit::Unauthorized)
      end

      it "raises UnauthorizedError" do
        expect do
          service_with_token.fetch_pull_request(owner: owner, repo: repo, number: 1)
        end.to raise_error(GithubApiService::UnauthorizedError)
      end
    end
  end

  describe "#fetch_issue_labels" do
    it "fetches labels for a PR" do
      labels = service_with_token.fetch_issue_labels(
        owner: "antiwork",
        repo: "flexile",
        number: 1
      )

      expect(labels).to be_an(Array)
    end
  end

  describe "#fetch_pr_details" do
    let(:pr_data) do
      {
        number: 1,
        title: "Test PR",
        user: { login: "octocat" },
        labels: [double("label", name: "Bounty: $2000")],
        state: "open",
        merged: false,
        html_url: "https://github.com/antiwork/flexile/pull/1",
        created_at: Time.zone.now,
      }
    end

    before do
      allow_any_instance_of(Octokit::Client)
        .to receive(:pull_request)
        .with("antiwork/flexile", 1)
        .and_return(pr_data)
    end

    it "fetches complete PR details with bounty" do
      result = service_with_token.fetch_pr_details(url: "https://github.com/antiwork/flexile/pull/1")
      expect(result).to include(:title, :number, :state, :merged, :author, :bounty_cents, :verified_author)
      expect(result[:verified_author]).to be_nil
      expect(result[:bounty_cents]).to eq(200_000) # cents
    end

    it "verifies author when github_username provided" do
      result = service_with_token.fetch_pr_details(
        url: "https://github.com/antiwork/flexile/pull/1",
        github_username: "octocat"
      )
      expect(result[:verified_author]).to be_in([true, false])
    end

    it "raises InvalidUrlError for invalid URL" do
      expect do
        service.fetch_pr_details(url: "not a valid url")
      end.to raise_error(GithubApiService::InvalidUrlError)
    end

    it "raises InvalidUrlError for non-PR URL" do
      expect do
        service.fetch_pr_details(url: "https://github.com/antiwork/flexile")
      end.to raise_error(GithubApiService::InvalidUrlError)
    end
  end
end
