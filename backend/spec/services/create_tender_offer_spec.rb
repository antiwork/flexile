# frozen_string_literal: true

RSpec.describe CreateTenderOffer do
  let(:company) { create(:company) }
  let(:valid_attributes) do
    {
      starts_at: Date.new(2024, 12, 15).to_s,
      ends_at: Date.new(2024, 12, 30).to_s,
      minimum_valuation: 1_000_000.to_s,
      attachment: fixture_file_upload("sample.zip"),
    }
  end

  describe "#perform" do
    subject(:result) { described_class.new(company:, attributes:).perform }

    context "with valid attributes" do
      let(:attributes) { valid_attributes }

      it "creates a new tender offer" do
        expect { result }.to change(company.tender_offers, :count).by(1)
        tender_offer = company.tender_offers.last
        expect(tender_offer.company).to eq(company)
        expect(tender_offer.starts_at).to eq(attributes[:starts_at])
        expect(tender_offer.ends_at).to eq(attributes[:ends_at])
        expect(tender_offer.minimum_valuation).to eq(attributes[:minimum_valuation].to_f)
        expect(tender_offer.attachment).to be_present
      end

      it "returns a success result" do
        expect(result[:success]).to be true
        expect(result[:tender_offer]).to be_a(TenderOffer)
      end
    end

    context "with invalid attributes" do
      let(:attributes) { valid_attributes.merge(starts_at: nil) }

      it "does not create a new tender offer" do
        expect { result }.not_to change(company.tender_offers, :count)
      end

      it "returns a failure result" do
        expect(result[:success]).to be false
        expect(result[:error_message]).to be_present
      end
    end
  end
end
