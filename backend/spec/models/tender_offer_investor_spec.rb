# frozen_string_literal: true

RSpec.describe TenderOfferInvestor do
  describe "associations" do
    it { is_expected.to belong_to(:tender_offer) }
    it { is_expected.to belong_to(:company_investor) }
  end

  describe "validations" do
    subject { build(:tender_offer_investor) }

    it { is_expected.to validate_uniqueness_of(:tender_offer_id).scoped_to(:company_investor_id) }

    it "prevents duplicate tender_offer_id and company_investor_id combinations" do
      tender_offer = create(:tender_offer)
      company_investor = create(:company_investor, company: tender_offer.company)

      create(:tender_offer_investor, tender_offer: tender_offer, company_investor: company_investor)

      duplicate = build(:tender_offer_investor, tender_offer: tender_offer, company_investor: company_investor)

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:tender_offer_id]).to include("has already been taken")
    end

    it "allows same company_investor for different tender_offers" do
      company_investor = create(:company_investor)
      tender_offer1 = create(:tender_offer, company: company_investor.company)
      tender_offer2 = create(:tender_offer, company: company_investor.company)

      create(:tender_offer_investor, tender_offer: tender_offer1, company_investor: company_investor)
      second = build(:tender_offer_investor, tender_offer: tender_offer2, company_investor: company_investor)

      expect(second).to be_valid
    end

    it "allows same tender_offer for different company_investors" do
      company = create(:company)
      tender_offer = create(:tender_offer, company: company)
      company_investor1 = create(:company_investor, company: company)
      company_investor2 = create(:company_investor, company: company)

      create(:tender_offer_investor, tender_offer: tender_offer, company_investor: company_investor1)
      second = build(:tender_offer_investor, tender_offer: tender_offer, company_investor: company_investor2)

      expect(second).to be_valid
    end
  end
end
