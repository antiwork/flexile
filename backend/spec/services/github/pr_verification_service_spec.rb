# frozen_string_literal: true

RSpec.describe Github::PrVerificationService do
  let(:company) { create(:company) }
  let(:service) { described_class.new(company: company) }

  describe "#verify_pr_url" do
    context "when GitHub integration is not connected" do
      it "returns an error" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile/pull/242")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("GitHub integration not connected")
      end
    end

    context "when GitHub integration is disconnected" do
      let!(:integration) { create(:github_integration, :disconnected, company: company) }

      it "returns an error" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile/pull/242")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("GitHub integration not connected")
      end
    end

    context "when GitHub access token is expired" do
      let!(:integration) { create(:github_integration, :expired_token, company: company) }

      it "returns an error" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile/pull/242")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("GitHub access token is invalid or expired")
      end
    end

    context "when URL format is invalid" do
      let!(:integration) { create(:github_integration, company: company) }

      it "returns an error for non-GitHub URL" do
        result = service.verify_pr_url(url: "https://gitlab.com/antiwork/flexile/merge_requests/242")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("Invalid GitHub PR URL format")
      end

      it "returns an error for GitHub URL without PR number" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("Invalid GitHub PR URL format")
      end
    end

    context "when PR verification is successful" do
      let!(:integration) { create(:github_integration, company: company) }

      before do
        allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
        allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
        allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")

        stub_request(:get, "https://api.github.com/repos/antiwork/flexile/pulls/242")
          .to_return(
            status: 200,
            body: {
              number: 242,
              title: "Migrate to accessible date picker",
              state: "closed",
              merged: true,
              merged_at: "2024-01-15T10:30:00Z",
              html_url: "https://github.com/antiwork/flexile/pull/242",
              user: {
                login: "laugardie",
                id: 123,
                avatar_url: "https://avatars.githubusercontent.com/u/123",
              },
              head: {
                ref: "feat/date-picker",
                repo: { full_name: "antiwork/flexile" },
              },
              base: { ref: "main" },
            }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns the PR details" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile/pull/242")

        expect(result[:success]).to be true
        expect(result[:pr][:number]).to eq(242)
        expect(result[:pr][:title]).to eq("Migrate to accessible date picker")
        expect(result[:pr][:merged]).to be true
        expect(result[:pr][:author_login]).to eq("laugardie")
        expect(result[:pr][:repository]).to eq("antiwork/flexile")
      end
    end

    context "when PR is not found" do
      let!(:integration) { create(:github_integration, company: company) }

      before do
        allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
        allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
        allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")

        stub_request(:get, "https://api.github.com/repos/antiwork/flexile/pulls/99999")
          .to_return(status: 404)
      end

      it "returns an error" do
        result = service.verify_pr_url(url: "https://github.com/antiwork/flexile/pull/99999")

        expect(result[:success]).to be false
        expect(result[:error]).to eq("Pull request not found or not accessible")
      end
    end
  end

  describe "#parse_pr_url" do
    it "parses a valid GitHub PR URL" do
      result = service.parse_pr_url("https://github.com/antiwork/flexile/pull/242")

      expect(result[:owner]).to eq("antiwork")
      expect(result[:repo]).to eq("flexile")
      expect(result[:number]).to eq(242)
    end

    it "returns nil for an invalid URL" do
      result = service.parse_pr_url("https://gitlab.com/antiwork/flexile/merge_requests/242")

      expect(result).to be_nil
    end

    it "handles URLs with query parameters" do
      result = service.parse_pr_url("https://github.com/antiwork/flexile/pull/242?diff=unified")

      expect(result[:owner]).to eq("antiwork")
      expect(result[:repo]).to eq("flexile")
      expect(result[:number]).to eq(242)
    end
  end
end
