# frozen_string_literal: true

RSpec.describe Internal::GithubController, type: :controller do
  let(:user) { create(:user) }
  let(:token) { "gh_token" }

  before do
    request.env["devise.mapping"] = Devise.mappings[:user]
    allow(request.env["warden"]).to receive(:authenticate!).and_return(user)
    allow(controller).to receive(:current_user).and_return(user)
    request.headers["X-Github-Access-Token"] = token
  end

  describe "GET #pull_request" do
    let(:url) { "https://github.com/org/repo/pull/123" }
    let(:service) { instance_double(GithubService) }
    let(:result) do
      GithubService::Result.new(
        id: 1, title: "PR", state: "open", merged: false, html_url: url, number: 123,
        owner: "org", repo: "repo", bounty_amount: 100, author: "dev", is_paid: false,
        is_verified: true, type: "pull", error: nil
      )
    end

    before do
      allow(GithubService).to receive(:new).with(token: token).and_return(service)
    end

    it "returns success json" do
      expect(service).to receive(:fetch_pull_request).with(
        url: url,
        invoice_id: nil,
        company_id: nil,
        user: user
      ).and_return(result)

      get :pull_request, params: { url: url }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["title"]).to eq("PR")
      expect(json["bountyAmount"]).to eq(100)
    end

    it "returns error json when service fails" do
      error_result = GithubService::Result.new(
        id: nil, title: nil, state: nil, merged: nil, html_url: nil, number: 123,
        owner: "org", repo: "repo", bounty_amount: nil, author: nil, is_paid: false,
        is_verified: nil, type: "pull", error: "wrong_organization"
      )

      expect(service).to receive(:fetch_pull_request).and_return(error_result)

      get :pull_request, params: { url: url }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["error"]).to eq("wrong_organization")
    end
  end
end
