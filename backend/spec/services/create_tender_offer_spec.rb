# frozen_string_literal: true

RSpec.describe CreateTenderOffer do
  let(:company) { create(:company) }
  let(:company_investor1) { create(:company_investor, company: company) }
  let(:company_investor2) { create(:company_investor, company: company) }
  let(:valid_attributes) do
    {
      name: "Q4 2024 Buyback",
      starts_at: Date.new(2024, 12, 15).to_s,
      ends_at: Date.new(2024, 12, 30).to_s,
      minimum_valuation: 1_000_000.to_s,
      attachment: fixture_file_upload("sample.zip"),
      letter_of_transmittal: fixture_file_upload("sample.pdf"),
    }
  end

  describe "#perform" do
    subject(:result) { described_class.new(company:, attributes:, investor_ids:).perform }

    context "with valid attributes" do
      let(:attributes) { valid_attributes }
      let(:investor_ids) { [company_investor1.external_id, company_investor2.external_id] }

      it "creates a new tender offer" do
        expect { result }.to change(company.tender_offers, :count).by(1)
        tender_offer = company.tender_offers.last
        expect(tender_offer.company).to eq(company)
        expect(tender_offer.name).to eq(attributes[:name])
        expect(tender_offer.starts_at).to eq(Date.parse(attributes[:starts_at]))
        expect(tender_offer.ends_at).to eq(Date.parse(attributes[:ends_at]))
        expect(tender_offer.minimum_valuation).to eq(attributes[:minimum_valuation].to_f)
        expect(tender_offer.attachment).to be_present
        expect(tender_offer.letter_of_transmittal).to be_present
      end

      it "creates tender offer investors" do
        expect { result }.to change(TenderOfferInvestor, :count).by(2)

        tender_offer = result[:tender_offer]
        expect(tender_offer.tender_offer_investors.pluck(:company_investor_id)).to match_array([company_investor1.id, company_investor2.id])
      end

      it "sends notification emails to selected investors" do
        expect { result }.to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_opened).exactly(2).times
      end

      it "includes correct parameters in email notifications" do
        expect { result }.to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_opened).with(
          company_investor1.id,
          tender_offer_id: kind_of(Integer)
        ).and have_enqueued_mail(CompanyInvestorMailer, :tender_offer_opened).with(
          company_investor2.id,
          tender_offer_id: kind_of(Integer)
        )
      end

      it "returns a success result" do
        expect(result[:success]).to be true
        expect(result[:tender_offer]).to be_a(TenderOffer)
      end
    end

    context "with non-existent investors" do
      let(:attributes) { valid_attributes.except(:investors, ["nonexistent-id"]) }
      let(:investor_ids) { ["nonexistent-id"] }

      it "fails to create tender offer due to no valid investors" do
        expect { result }.not_to change(company.tender_offers, :count)
        expect { result }.not_to change(TenderOfferInvestor, :count)
      end

      it "returns failure with validation error" do
        expect(result[:success]).to be false
        expect(result[:error_message]).to include("At least one investor must be selected")
      end
    end

    context "without investor selection" do
      let(:attributes) { valid_attributes.except(:investors) }
      let(:investor_ids) { [] }

      it "fails to create tender offer due to validation" do
        expect { result }.not_to change(company.tender_offers, :count)
        expect { result }.not_to change(TenderOfferInvestor, :count)
      end

      it "returns failure with validation error" do
        expect(result[:success]).to be false
        expect(result[:error_message]).to include("At least one investor must be selected")
      end
    end

    context "with invalid attributes" do
      let(:attributes) { valid_attributes.merge(starts_at: nil) }
      let(:investor_ids) { [company_investor1.external_id, company_investor2.external_id] }

      it "does not create a new tender offer" do
        expect { result }.not_to change(company.tender_offers, :count)
      end

      it "does not create tender offer investors" do
        expect { result }.not_to change(TenderOfferInvestor, :count)
      end

      it "does not send notification emails" do
        expect { result }.not_to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_opened)
      end

      it "returns a failure result" do
        expect(result[:success]).to be false
        expect(result[:error_message]).to be_present
      end
    end

    context "when validation fails after investor setup" do
      let(:attributes) { valid_attributes.merge(starts_at: Date.new(2024, 12, 30).to_s, ends_at: Date.new(2024, 12, 15).to_s) }
      let(:investor_ids) { [company_investor1.external_id, company_investor2.external_id] }

      it "does not create tender offer or investors" do
        expect { result }.not_to change(company.tender_offers, :count)
        expect { result }.not_to change(TenderOfferInvestor, :count)
      end

      it "returns validation errors" do
        expect(result[:success]).to be false
        expect(result[:error_message]).to include("must be after starts at")
      end
    end
  end
end
