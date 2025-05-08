# frozen_string_literal: true

RSpec.describe IntegrationApi::Github, :vcr do
  let(:company) { create(:company) }
  let(:contractor) { create(:company_worker, company:) }
  let(:client_id) { GlobalConfig.get("GH_CLIENT_ID") }
  let(:client_secret) { GlobalConfig.get("GH_CLIENT_SECRET") }
  let(:state) { Base64.strict_encode64("#{company.external_id}:#{company.name}") }

  subject(:client) { described_class.new(company_id: company.id) }

  describe "#initialize" do
    it "fails initialization if the company is not found" do
      expect do
        described_class.new(company_id: "abc")
      end.to raise_error(ActiveRecord::RecordNotFound)
    end

    it "sets attributes for a valid company" do
      expect(client.send(:company)).to eq(company)
      expect(client.send(:integration)).to eq(nil)
      expect(client.send(:client_id)).to eq(client_id)
      expect(client.send(:client_secret)).to eq(client_secret)
      expect(client.send(:state)).to eq(state)
      expect(client.send(:integration)).to eq(nil)
      expect(client.account_id).to eq(nil)
      expect(client.access_token).to eq(nil)
    end

    context "when an integration is present" do
      let!(:github_integration) { create(:github_integration, company:) }

      it "sets attributes for a valid company" do
        expect(client.send(:company)).to eq(company)
        expect(client.send(:integration)).to eq(github_integration)
        expect(client.send(:client_id)).to eq(client_id)
        expect(client.send(:client_secret)).to eq(client_secret)
        expect(client.send(:state)).to eq(state)
        expect(client.account_id).to eq(github_integration.account_id)
        expect(client.access_token).to eq(github_integration.access_token)
      end
    end
  end

  describe "#oauth_location" do
    it "returns the OAuth connect URL" do
      expect(client.oauth_location).to eq(
        URI(
          "https://github.com/login/oauth/authorize?" \
          "client_id=#{client_id}&" \
          "scope=#{CGI.escape("repo,admin:org_hook")}&" \
          "redirect_uri=#{CGI.escape(Rails.application.routes.url_helpers.oauth_redirect_url)}&" \
          "state=#{CGI.escape(state)}"
        )
      )
    end
  end

  describe "#get_oauth_token" do
    it "returns the OAuth access token" do
      stub_const("IntegrationApi::Github::OAUTH_REDIRECT_URL", "https://app.flexile.dev/oauth_redirect")
      response = client.get_oauth_token("488cbdff3ae96e96802b")

      expect(response.ok?).to eq(true)
      expect(response.parsed_response["access_token"]).to eq("gho_aGogSNKXswlREuTd3NLISAMPLE")
    end
  end

  describe "#fetch_account_id" do
    it "returns the account ID" do
      expect(client.fetch_account_id("gho_aGogSNKXswlREuTd3NLISAMPLE")).to eq(1855287)
    end
  end

  describe "#revoke_token" do
    let!(:github_integration) { create(:github_integration, company:) }

    it "revokes the integration refresh token" do
      stub = WebMock.stub_request(:delete, "https://api.github.com/applications/#{client_id}/grant")
                    .with(
                      {
                        body: { access_token: github_integration.access_token }.to_json,
                        headers: {
                          "Accept" => "application/vnd.github+json",
                          "X-GitHub-Api-Version" => "2022-11-28",
                          "Authorization" => "Basic #{Base64.strict_encode64("#{client_id}:#{client_secret}")}",
                        },
                      }
                    )
                    .to_return(status: 200, body: "", headers: { content_type: "application/json" })

      response = client.revoke_token

      expect(response.ok?).to eq(true)
      assert_requested(stub)
    end
  end

  describe "#fetch_organizations" do
    it "returns the organizations the authenticated user belongs to" do
      expect(client.fetch_organizations("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")).to eq(["gumroad", "sunergos-ro"])
    end
  end
end
