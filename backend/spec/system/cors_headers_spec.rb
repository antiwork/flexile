# frozen_string_literal: true

RSpec.describe "CORS support" do
  let(:application_domain) { "flexile.com" }
  let(:origin_domain) { "example.com" }

  describe "Request to API domain" do
    let(:api_domain) { "api.flexile.com" }

    before do
      stub_const("API_DOMAIN", api_domain)
    end

    it "returns a response with CORS headers" do
      get root_path, headers: { "HTTP_ORIGIN": origin_domain, "HTTP_HOST": api_domain }

      expect(response.headers["Access-Control-Allow-Origin"]).to eq "*"
      expect(response.headers["Access-Control-Allow-Methods"]).to eq "GET, POST, PUT, DELETE"
      expect(response.headers["Access-Control-Max-Age"]).to eq "7200"
    end
  end

  context "when the request is made to a CORS disabled domain" do
    it "returns a response without CORS headers" do
      get root_path, headers: { "HTTP_ORIGIN": origin_domain, "HTTP_HOST": application_domain }

      expect(response.headers["Access-Control-Allow-Origin"]).to be_nil
      expect(response.headers["Access-Control-Allow-Methods"]).to be_nil
      expect(response.headers["Access-Control-Max-Age"]).to be_nil
    end
  end
end
