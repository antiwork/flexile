# frozen_string_literal: true

RSpec.describe TenderOffer do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to have_many(:bids).class_name("TenderOfferBid") }
    it { is_expected.to have_many(:equity_buyback_rounds) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:attachment) }
    it { is_expected.to validate_presence_of(:starts_at) }
    it { is_expected.to validate_presence_of(:ends_at) }
    it { is_expected.to validate_presence_of(:minimum_valuation) }
    it { is_expected.to validate_numericality_of(:minimum_valuation).only_integer.is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_numericality_of(:number_of_shares).only_integer.is_greater_than_or_equal_to(0).allow_nil }
    it { is_expected.to validate_numericality_of(:number_of_shareholders).only_integer.is_greater_than(0).allow_nil }
    it { is_expected.to validate_numericality_of(:total_amount_in_cents).only_integer.is_greater_than(0).allow_nil }
    it { is_expected.to validate_numericality_of(:accepted_price_cents).only_integer.is_greater_than(0).allow_nil }

    describe "#ends_at_must_be_after_starts_at" do
      it "is valid when ends_at is after starts_at" do
        tender_offer = build(:tender_offer, starts_at: 1.day.ago, ends_at: Time.zone.now)

        expect(tender_offer.valid?).to eq(true)
        expect(tender_offer.errors[:ends_at]).to be_empty
      end

      it "is invalid when ends_at is before starts_at" do
        tender_offer = build(:tender_offer, starts_at: Time.zone.now, ends_at: 1.day.ago)

        expect(tender_offer.valid?).to eq(false)
        expect(tender_offer.errors[:ends_at]).to include("must be after starts at")
      end
    end

    describe "attachment validation" do
      it "allows ZIP file attachments" do
        tender_offer = build(:tender_offer)
        zip_file = fixture_file_upload("sample.zip", "application/zip")
        tender_offer.attachment.attach(zip_file)

        expect(tender_offer).to be_valid
      end

      it "does not allow non-ZIP file attachments" do
        tender_offer = build(:tender_offer)
        pdf_file = fixture_file_upload("sample.pdf", "application/pdf")
        tender_offer.attachment.attach(pdf_file)

        expect(tender_offer).not_to be_valid
        expect(tender_offer.errors[:attachment]).to include("must be a ZIP file")
      end
    end
  end

  describe "#open?" do
    it "returns true when current time is between starts_at and ends_at" do
      tender_offer = build(:tender_offer, starts_at: 1.day.ago, ends_at: 1.day.from_now)

      expect(tender_offer.open?).to eq(true)
    end

    it "returns false when current time is before starts_at" do
      tender_offer = build(:tender_offer, starts_at: 1.day.from_now, ends_at: 2.days.from_now)

      expect(tender_offer.open?).to eq(false)
    end

    it "returns false when current time is after ends_at" do
      tender_offer = build(:tender_offer, starts_at: 2.days.ago, ends_at: 1.day.ago)

      expect(tender_offer.open?).to eq(false)
    end
  end

  describe "#securities_available_for_purchase" do
    let(:company) { create(:company) }
    let(:other_company) { create(:company) }
    let(:company_investor_1) { create(:company_investor, company:) }
    let(:company_investor_2) { create(:company_investor, company:) }
    let(:other_company_investor) { create(:company_investor, company: other_company) }
    let(:tender_offer) { create(:tender_offer, company:) }
    let(:option_pool) { create(:option_pool, company:) }

    before do
      create(:share_class, name: "Class X", company:).tap do |share_class|
        create(:share_holding, company_investor: company_investor_1, share_class:, number_of_shares: 2_450)
        create(:share_holding, company_investor: company_investor_2, share_class:, number_of_shares: 500)
      end
      create(:share_class, name: "Class Y", company:).tap do |share_class|
        create(:share_holding, company_investor: company_investor_1, share_class:, number_of_shares: 4_690)
      end
      create(:equity_grant, company_investor: company_investor_1, number_of_shares: 10_000, option_pool:,
                            vested_shares: 2_000,
                            unvested_shares: 5_000,
                            exercised_shares: 2_000,
                            forfeited_shares: 1_000)
      create(:equity_grant, company_investor: company_investor_1, number_of_shares: 5_000, option_pool:,
                            vested_shares: 5_000)
      create(:equity_grant, company_investor: company_investor_2, number_of_shares: 5_000, option_pool:,
                            vested_shares: 5_000)
      create(:equity_grant, company_investor: other_company_investor, number_of_shares: 5_000,
                            vested_shares: 5_000)

      create(:share_class, name: "Class Z", company: other_company).tap do |share_class|
        create(:share_holding, company_investor: other_company_investor, share_class:, number_of_shares: 1_000)
      end
    end

    it "returns the securities available for purchase in an expected format" do
      expect(tender_offer.securities_available_for_purchase(company_investor_1)).to match_array([
                                                                                                  { class_name: "Class X", count: 2_450 },
                                                                                                  { class_name: "Class Y", count: 4_690 },
                                                                                                  { class_name: TenderOffer::VESTED_SHARES_CLASS, count: 7_000 },
                                                                                                ])

      expect(tender_offer.securities_available_for_purchase(company_investor_2)).to match_array([
                                                                                                  { class_name: "Class X", count: 500 },
                                                                                                  { class_name: TenderOffer::VESTED_SHARES_CLASS, count: 5_000 },
                                                                                                ])
    end

    it "does not include unvested shares in the count" do
      result = tender_offer.securities_available_for_purchase(company_investor_1)
      vested_shares = result.find { |s| s[:class_name] == described_class::VESTED_SHARES_CLASS }
      expect(vested_shares[:count]).to eq(7_000)
    end

    it "does not include forfeited shares in the count" do
      result = tender_offer.securities_available_for_purchase(company_investor_1)
      vested_shares = result.find { |s| s[:class_name] == described_class::VESTED_SHARES_CLASS }
      expect(vested_shares[:count]).to eq(7_000)
    end
  end
end
