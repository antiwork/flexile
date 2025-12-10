# frozen_string_literal: true

RSpec.describe Github::OauthService do
  let(:company) { create(:company) }
  let(:service) { described_class.new(company: company) }

  describe "#authorization_url" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    it "returns a valid GitHub OAuth authorization URL" do
      url = service.authorization_url

      expect(url).to start_with("https://github.com/login/oauth/authorize?")
      expect(url).to include("client_id=test_client_id")
      expect(url).to include("scope=read%3Aorg")
      expect(url).to include("allow_signup=false")
      expect(url).to include("redirect_uri=")
      expect(url).to include("state=")
    end
  end

  describe "#valid_state?" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    it "returns true for a valid state" do
      state = Base64.strict_encode64("#{company.external_id}|#{Time.current.iso8601}")
      expect(service.valid_state?(state)).to be true
    end

    it "returns false for an expired state" do
      state = Base64.strict_encode64("#{company.external_id}|#{15.minutes.ago.iso8601}")
      expect(service.valid_state?(state)).to be false
    end

    it "returns false for a state with wrong company" do
      state = Base64.strict_encode64("wrong_company_id|#{Time.current.iso8601}")
      expect(service.valid_state?(state)).to be false
    end

    it "returns false for invalid base64" do
      expect(service.valid_state?("not_valid_base64!!!")).to be false
    end

    it "returns false for blank state" do
      expect(service.valid_state?(nil)).to be false
      expect(service.valid_state?("")).to be false
    end
  end

  describe "#exchange_code_for_token" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    context "when the request is successful" do
      before do
        stub_request(:post, "https://github.com/login/oauth/access_token")
          .to_return(
            status: 200,
            body: {
              access_token: "gho_test_token",
              token_type: "bearer",
              scope: "read:org",
            }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns the access token data" do
        result = service.exchange_code_for_token(code: "test_code")

        expect(result[:access_token]).to eq("gho_test_token")
        expect(result[:token_type]).to eq("bearer")
        expect(result[:scope]).to eq("read:org")
      end
    end

    context "when GitHub returns an error" do
      before do
        stub_request(:post, "https://github.com/login/oauth/access_token")
          .to_return(
            status: 200,
            body: {
              error: "bad_verification_code",
              error_description: "The code passed is incorrect or expired.",
            }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "raises an OauthError" do
        expect do
          service.exchange_code_for_token(code: "bad_code")
        end.to raise_error(Github::OauthService::OauthError, "The code passed is incorrect or expired.")
      end
    end

    context "when the request fails" do
      before do
        stub_request(:post, "https://github.com/login/oauth/access_token")
          .to_return(status: 500)
      end

      it "raises an OauthError" do
        expect do
          service.exchange_code_for_token(code: "test_code")
        end.to raise_error(Github::OauthService::OauthError)
      end
    end
  end

  describe "#fetch_user_organizations" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    context "when the request is successful" do
      before do
        stub_request(:get, "https://api.github.com/user/orgs")
          .to_return(
            status: 200,
            body: [
              {
                id: 12345,
                login: "Antiwork",
                avatar_url: "https://avatars.githubusercontent.com/u/12345",
                description: "Building the future",
              },
              {
                id: 67890,
                login: "Gumroad",
                avatar_url: "https://avatars.githubusercontent.com/u/67890",
                description: "Selling things",
              }
            ].to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns a list of organizations" do
        result = service.fetch_user_organizations(access_token: "test_token")

        expect(result.length).to eq(2)
        expect(result[0][:login]).to eq("Antiwork")
        expect(result[0][:id]).to eq(12345)
        expect(result[1][:login]).to eq("Gumroad")
      end
    end

    context "when the request fails" do
      before do
        stub_request(:get, "https://api.github.com/user/orgs")
          .to_return(status: 401)
      end

      it "raises an ApiError" do
        expect do
          service.fetch_user_organizations(access_token: "bad_token")
        end.to raise_error(Github::OauthService::ApiError)
      end
    end
  end

  describe "#fetch_organization" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    context "when the request is successful" do
      before do
        stub_request(:get, "https://api.github.com/orgs/Antiwork")
          .to_return(
            status: 200,
            body: {
              id: 12345,
              login: "Antiwork",
              name: "Antiwork Inc.",
              avatar_url: "https://avatars.githubusercontent.com/u/12345",
              description: "Building the future",
            }.to_json,
            headers: { "Content-Type" => "application/json" }
          )
      end

      it "returns organization details" do
        result = service.fetch_organization(access_token: "test_token", org_name: "Antiwork")

        expect(result[:login]).to eq("Antiwork")
        expect(result[:name]).to eq("Antiwork Inc.")
        expect(result[:id]).to eq(12345)
      end
    end
  end

  describe "#verify_pull_request" do
    before do
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_ID").and_return("test_client_id")
      allow(ENV).to receive(:fetch).with("GITHUB_CLIENT_SECRET").and_return("test_client_secret")
      allow(ENV).to receive(:fetch).with("NEXT_PUBLIC_URL", anything).and_return("http://localhost:3001")
    end

    context "when the PR exists and is merged" do
      before do
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
        result = service.verify_pull_request(
          access_token: "test_token",
          owner: "antiwork",
          repo: "flexile",
          pr_number: 242
        )

        expect(result[:number]).to eq(242)
        expect(result[:title]).to eq("Migrate to accessible date picker")
        expect(result[:merged]).to be true
        expect(result[:user][:login]).to eq("laugardie")
      end
    end

    context "when the PR does not exist" do
      before do
        stub_request(:get, "https://api.github.com/repos/antiwork/flexile/pulls/99999")
          .to_return(status: 404)
      end

      it "returns nil" do
        result = service.verify_pull_request(
          access_token: "test_token",
          owner: "antiwork",
          repo: "flexile",
          pr_number: 99999
        )

        expect(result).to be_nil
      end
    end
  end
end
