# frozen_string_literal: true

RSpec.describe GeoIp do
  describe ".lookup" do
    let(:result) { described_class.lookup(ip) }

    context "when an IP to location match is not possible" do
      let(:ip) { "127.0.0.1" }

      it "returns a nil result" do
        expect(result).to eq(nil)
      end
    end

    context "when an IP to location match is possible" do
      let(:ip) { "162.158.186.78" }

      it "returns a result" do
        expect(result.country_name).to eq("United States")
        expect(result.country_code).to eq("US")
      end
    end

    context "when an IPv6 to location match is possible" do
      let(:ip) { "2001:861:5bc0:cb60:500d:3535:e6a7:62a0" }

      it "returns a result" do
        expect(result.country_name).to eq("France")
        expect(result.country_code).to eq("FR")
      end
    end

    context "when an IP to location match is possible but the underlying GEOIP has invalid UTF-8 " \
            "in fields" do
      let(:ip) { "104.193.168.19" }

      before do
        expect(GeoIp::GEO_IP).to receive(:country).and_return(
          double(
            country: double({ name: "Unit\xB7ed States", iso_code: "U\xB7S" })
          )
        )
      end

      it "returns a result" do
        expect(result.country_name).to eq("Unit?ed States")
        expect(result.country_code).to eq("U?S")
      end
    end
  end
end
