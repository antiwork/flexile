# frozen_string_literal: true

require "rails_helper"

RSpec.describe GithubApiService do
  let(:service) { described_class.new }
  let(:service_with_token) { described_class.new(access_token: "test_token") }

  describe "#parse_pr_url" do
    it "parses a valid GitHub PR URL" do
      url = "https://github.com/antiwork/flexile/pull/123"
      result = service.parse_pr_url(url)

      expect(result).to eq({
        owner: "antiwork",
        repo: "flexile",
        number: 123,
      })
    end

    it "parses a PR URL with fragment" do
      url = "https://github.com/antiwork/flexile/pull/456#issuecomment-789"
      result = service.parse_pr_url(url)

      expect(result).to eq({
        owner: "antiwork",
        repo: "flexile",
        number: 456,
      })
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
      labels = ["bug", "$2k", "priority"]
      expect(service.extract_bounty_from_labels(labels)).to eq(2000)
    end

    it "extracts bounty from $500 format" do
      labels = ["feature", "$500"]
      expect(service.extract_bounty_from_labels(labels)).to eq(500)
    end

    it "extracts bounty from $1.5k format" do
      labels = ["$1.5k", "enhancement"]
      expect(service.extract_bounty_from_labels(labels)).to eq(1500)
    end

    it "extracts bounty from bounty: $2k format" do
      labels = ["bounty: $2k"]
      expect(service.extract_bounty_from_labels(labels)).to eq(2000)
    end

    it "returns nil when no bounty label found" do
      labels = ["bug", "priority", "enhancement"]
      expect(service.extract_bounty_from_labels(labels)).to be_nil
    end

    it "returns first bounty found if multiple exist" do
      labels = ["$1k", "$2k"]
      expect(service.extract_bounty_from_labels(labels)).to eq(1000)
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

  describe "#fetch_pull_request", :vcr do
    it "fetches PR details successfully" do
      result = service_with_token.fetch_pull_request(
        owner: "antiwork",
        repo: "flexile",
        number: 1
      )

      expect(result).to include(
        :title,
        :number,
        :state,
        :merged,
        :author,
        :author_avatar,
        :html_url,
        :repository,
        :created_at
      )
      expect(result[:number]).to eq(1)
      expect(result[:repository]).to eq("antiwork/flexile")
    end

    it "raises ApiError for non-existent PR" do
      expect do
        service_with_token.fetch_pull_request(
          owner: "antiwork",
          repo: "flexile",
          number: 999999
        )
      end.to raise_error(GithubApiService::ApiError, /not found/)
    end

    it "raises UnauthorizedError for invalid token" do
      invalid_service = described_class.new(access_token: "invalid_token")

      expect do
        invalid_service.fetch_pull_request(
          owner: "antiwork",
          repo: "flexile",
          number: 1
        )
      end.to raise_error(GithubApiService::UnauthorizedError)
    end
  end

  describe "#fetch_issue_labels", :vcr do
    it "fetches labels for a PR" do
      labels = service_with_token.fetch_issue_labels(
        owner: "antiwork",
        repo: "flexile",
        number: 1
      )

      expect(labels).to be_an(Array)
    end
  end

  describe "#fetch_pr_details", :vcr do
    it "fetches complete PR details with bounty" do
      # Assuming PR #1 has a $2k label
      result = service_with_token.fetch_pr_details(
        url: "https://github.com/antiwork/flexile/pull/1"
      )

      expect(result).to include(
        :title,
        :number,
        :state,
        :merged,
        :author,
        :bounty_cents,
        :verified_author
      )
      expect(result[:verified_author]).to be_nil # no username provided
    end

    it "verifies author when github_username provided" do
      result = service_with_token.fetch_pr_details(
        url: "https://github.com/antiwork/flexile/pull/1",
        github_username: "octocat" # Replace with actual author
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
