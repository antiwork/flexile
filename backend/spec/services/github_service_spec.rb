# frozen_string_literal: true

RSpec.describe GithubService do
  subject(:service) { described_class.new(token: "mock_token") }

  describe "#extract_bounty_amount" do
    it "extracts simple amounts" do
      expect(service.send(:extract_bounty_amount, "Bounty: $100")).to eq(100)
    end

    it "extracts thousands (K suffix)" do
      expect(service.send(:extract_bounty_amount, "$5K")).to eq(5_000)
      expect(service.send(:extract_bounty_amount, "5k")).to eq(5_000)
    end

    it "extracts millions (M suffix)" do
      expect(service.send(:extract_bounty_amount, "$2.5M")).to eq(2_500_000)
    end

    it "handles decimal K amounts" do
      expect(service.send(:extract_bounty_amount, "$1.5K")).to eq(1_500)
    end

    it "returns nil for invalid strings" do
      expect(service.send(:extract_bounty_amount, "No bounty")).to be_nil
    end
  end

  describe "#fetch_pull_request" do
    let(:url) { "https://github.com/org/repo/pull/123" }
    let(:api_url) { "https://api.github.com/repos/org/repo/pulls/123" }
    let(:mock_response) { double(success?: true, code: 200, parsed_response: pr_data) }
    let(:pr_data) do
      {
        "id" => 1,
        "title" => "Test PR",
        "state" => "open",
        "html_url" => url,
        "number" => 123,
        "user" => { "login" => "author" },
        "labels" => [],
      }
    end

    before do
      allow(HTTParty).to receive(:get).and_return(mock_response)
    end

    it "returns PR details" do
      result = service.fetch_pull_request(url: url)
      expect(result.title).to eq("Test PR")
      expect(result.author).to eq("author")
    end

    context "with bounty label" do
      let(:pr_data) do
        super().merge("labels" => [{ "name" => "bounty: $500" }])
      end

      it "extracts bounty amount" do
        result = service.fetch_pull_request(url: url)
        expect(result.bounty_amount).to eq(500)
      end
    end

    context "with company validation" do
      let(:company) { create(:company) }
      let!(:integration) do
        create(:integration, :github, company: company, configuration: { "organization" => "org" })
      end

      it "allows PRs from configured org" do
        result = service.fetch_pull_request(url: url, company_id: company.id)
        expect(result.error).to be_nil
      end

      it "rejects PRs from other orgs" do
        other_url = "https://github.com/other/repo/pull/123"
        result = service.fetch_pull_request(url: other_url, company_id: company.id)
        expect(result.error).to eq("wrong_organization")
      end
    end

    context "with issue fallback" do
      let(:pr_data) do
        super().merge(
          "labels" => [],
          "body" => "Fixes #456"
        )
      end
      let(:issue_url) { "https://api.github.com/repos/org/repo/issues/456" }
      let(:issue_response) { double(success?: true, code: 200, parsed_response: issue_data) }
      let(:issue_data) do
        { "labels" => [{ "name" => "Bounty: $1K" }] }
      end

      before do
        allow(HTTParty).to receive(:get).with(issue_url, anything).and_return(issue_response)
      end

      it "fetches bounty from linked issue" do
        result = service.fetch_pull_request(url: url)
        expect(result.bounty_amount).to eq(1000)
      end
    end
  end
end
