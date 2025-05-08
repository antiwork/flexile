# frozen_string_literal: true

RSpec.describe TenderOfferBid do
  describe "associations" do
    it { is_expected.to belong_to(:tender_offer) }
    it { is_expected.to belong_to(:company_investor) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:number_of_shares) }
    it { is_expected.to validate_numericality_of(:number_of_shares).is_greater_than(0) }
    it { is_expected.to validate_numericality_of(:accepted_shares).is_greater_than_or_equal_to(0) }
    it { is_expected.to validate_presence_of(:share_price_cents) }
    it { is_expected.to validate_numericality_of(:share_price_cents).only_integer.is_greater_than(0) }
    it { is_expected.to validate_presence_of(:share_class) }

    describe "#tender_offer_must_be_open" do
      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return([
                                                                                                       { class_name: "A", count: 500 },
                                                                                                     ])
      end

      it "is valid when creating a bid during the tender offer period" do
        tender_offer = create(:tender_offer, starts_at: 1.day.ago, ends_at: 1.day.from_now)
        bid = build(:tender_offer_bid, tender_offer:)

        expect(bid.valid?).to eq(true)
      end

      it "is invalid when creating a bid before the tender offer start date" do
        tender_offer = create(:tender_offer, starts_at: 1.day.from_now, ends_at: 2.days.from_now)
        bid = build(:tender_offer_bid, tender_offer:)

        expect(bid.valid?).to eq(false)
        expect(bid.errors[:base]).to include("Tender offer is not open")
      end

      it "is invalid when creating a bid after the tender offer end date" do
        tender_offer = create(:tender_offer, starts_at: 2.days.ago, ends_at: 1.day.ago)
        bid = build(:tender_offer_bid, tender_offer:)

        expect(bid.valid?).to eq(false)
        expect(bid.errors[:base]).to include("Tender offer is not open")
      end

      it "is valid when creating a bid exactly at the tender offer start date", :freeze_time do
        tender_offer = create(:tender_offer, starts_at: Time.current, ends_at: 1.day.from_now)
        bid = build(:tender_offer_bid, tender_offer:)

        expect(bid.valid?).to eq(true)
      end

      it "is valid when creating a bid exactly at the tender offer end date", :freeze_time do
        tender_offer = create(:tender_offer, starts_at: 1.day.ago, ends_at: Time.current)
        bid = build(:tender_offer_bid, tender_offer:)

        expect(bid.valid?).to eq(true)
      end

      it "is valid when updating a bid after the tender offer is closed" do
        tender_offer = create(:tender_offer, starts_at: 2.days.ago, ends_at: 2.days.from_now)
        bid = create(:tender_offer_bid, tender_offer:)
        tender_offer.update!(ends_at: 1.day.ago)

        bid.update!(accepted_shares: 200)
        expect(bid.valid?).to eq(true)
      end

      it "is valid when destroying a bid when the tender offer is open" do
        tender_offer = create(:tender_offer, starts_at: 1.day.ago, ends_at: 1.day.from_now)
        bid = create(:tender_offer_bid, tender_offer:)

        expect { bid.destroy! }.not_to raise_error
        expect(bid.persisted?).to eq(false)
      end

      it "is invalid when destroying a bid after the tender offer is closed" do
        tender_offer = create(:tender_offer, starts_at: 2.days.ago, ends_at: 2.days.from_now)
        bid = create(:tender_offer_bid, tender_offer:)

        travel_to(3.days.from_now) do
          expect { bid.destroy! }.to raise_error(ActiveRecord::RecordNotDestroyed)
          expect(bid.reload.persisted?).to eq(true)
        end
      end
    end

    describe "#investor_must_have_adequate_securities" do
      let(:tender_offer) { create(:tender_offer) }
      let(:company_investor) { create(:company_investor) }

      before do
        allow(tender_offer).to receive(:securities_available_for_purchase)
                                 .with(company_investor).and_return([
                                                                      { class_name: "Class A", count: 500 },
                                                                      { class_name: "Class B", count: 300 },
                                                                    ])
      end

      it "is valid when investor has sufficient shares" do
        bid = build(:tender_offer_bid, tender_offer:, company_investor:, share_class: "Class A", number_of_shares: 400)

        expect(bid.valid?).to eq(true)
      end

      it "is invalid when investor has insufficient shares" do
        bid = build(:tender_offer_bid, tender_offer:, company_investor:, share_class: "Class A", number_of_shares: 600)

        expect(bid.valid?).to eq(false)
        expect(bid.errors[:base]).to include("Insufficient Class A shares")
      end

      it "is invalid when share class is not available" do
        bid = build(:tender_offer_bid, tender_offer:, company_investor:, share_class: "Class C", number_of_shares: 100)

        expect(bid.valid?).to eq(false)
        expect(bid.errors[:base]).to include("Insufficient Class C shares")
      end

      it "is valid when number of shares equals available shares" do
        bid = build(:tender_offer_bid, tender_offer:, company_investor:, share_class: "Class B", number_of_shares: 300)

        expect(bid.valid?).to eq(true)
      end
    end
  end
end
