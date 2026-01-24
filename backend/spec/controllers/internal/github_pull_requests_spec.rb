# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Internal::GithubPullRequests", type: :request do
  let(:user) { create(:user) }
  let(:company) { create(:company) }
  let(:external_id) { company.external_id }
  let(:user_jwt) { JwtService.generate_token(user) }
  let(:auth_headers) { { "x-flexile-auth" => "Bearer #{user_jwt}" } }

  before do
    # Associate user with company so Current.user.all_companies finds it
    create(:company_administrator, company: company, user: user)
  end

  describe "POST /internal/github_pull_requests/fetch" do
    let(:url) { "https://github.com/owner/repo/pull/123" }
    let(:params) do
      {
        url: url,
        company_id: external_id,
        target_username: "github_user",
      }
    end

    let(:pr_details) do
      {
        title: "Test PR",
        number: 123,
        state: "open",
        merged: false,
        author: "github_user",
        author_avatar: "https://avatar.url",
        html_url: url,
        repository: "owner/repo",
        created_at: Time.current,
        merged_at: nil,
        bounty_cents: 10000,
        verified_author: true,
      }
    end

    before do
      allow_any_instance_of(GithubApiService).to receive(:fetch_pr_details).and_return(pr_details)
    end

    it "returns PR details successfully" do
      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      expect(response).to have_http_status(:ok)

      json = JSON.parse(response.body)
      expect(json["success"]).to be true
      expect(json["pr"]["title"]).to eq("Test PR")
      expect(json["pr"]["bounty_cents"]).to eq(10000)
    end

    it "includes already_paid as false when no previous payments exist" do
      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      json = JSON.parse(response.body)
      expect(json["pr"]["already_paid"]).to be false
    end

    it "includes already_paid as true when previous payments exist" do
      contractor = create(:company_worker, company: company, user: user)
      invoice = create(:invoice, company: company, company_worker: contractor, status: :paid, invoice_number: "INV-1")
      create(:invoice_line_item, invoice: invoice, description: "Bounty for #{url}")

      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      json = JSON.parse(response.body)
      expect(json["success"]).to be(true), "Expected success to be true, but got: #{json["error"]}"
      expect(json["pr"]["already_paid"]).to be true
      expect(json["pr"]["paid_invoice_numbers"]).to include(hash_including("invoice_number" => "INV-1"))
    end

    it "includes already_paid as true when previous payments exist in prettified format" do
      contractor = create(:company_worker, company: company, user: user)
      invoice = create(:invoice, company: company, company_worker: contractor, status: :paid, invoice_number: "INV-1")
      create(:invoice_line_item, invoice: invoice, description: "[owner/repo #123] Fixed bug")

      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      json = JSON.parse(response.body)
      expect(json["pr"]["already_paid"]).to be true
    end

    it "includes already_paid as false when partial URL matches (pull/1 vs pull/123)" do
      url_v1 = "https://github.com/owner/repo/pull/1"
      contractor = create(:company_worker, company: company, user: user)
      invoice = create(:invoice, company: company, company_worker: contractor, status: :paid, invoice_number: "INV-1")
      create(:invoice_line_item, invoice: invoice, description: "Bounty for #{url_v1}")

      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      json = JSON.parse(response.body)
      expect(json["pr"]["already_paid"]).to be false
    end

    it "returns bad request for invalid URL" do
      allow_any_instance_of(GithubApiService).to receive(:fetch_pr_details).and_raise(GithubApiService::InvalidUrlError.new("Invalid URL"))

      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      expect(response).to have_http_status(:bad_request)
      expect(JSON.parse(response.body)["error"]).to eq("Invalid URL")
    end

    it "returns unauthorized when GitHub API fails" do
      allow_any_instance_of(GithubApiService).to receive(:fetch_pr_details).and_raise(GithubApiService::UnauthorizedError.new("Unauthorized"))

      post fetch_github_pull_requests_url, params: params, headers: auth_headers
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["needs_connection"]).to be true
    end
  end
end
