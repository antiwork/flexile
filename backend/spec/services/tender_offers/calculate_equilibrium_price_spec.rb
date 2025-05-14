# frozen_string_literal: true

RSpec.describe TenderOffers::CalculateEquilibriumPrice do
  let(:company) { create(:company) }
  let(:tender_offer) do
    create(:tender_offer, company: company, starts_at: 2.days.ago, ends_at: 1.day.ago,
                          number_of_shares: 1_000, total_amount_in_cents: 10_000_00)
  end
  let(:company_investor_1) { create(:company_investor, company: company) }
  let(:company_investor_2) { create(:company_investor, company: company) }

  describe "#perform" do
    subject { described_class.new(tender_offer:, total_amount_cents:, total_shares:).perform }

    let(:total_amount_cents) { nil }
    let(:total_shares) { nil }

    context "when the tender offer has not ended" do
      before do
        travel_to(tender_offer.ends_at - 1.hour)
      end

      it "returns nil" do
        expect(subject).to be_nil
        expect(tender_offer.accepted_price_cents).to be_nil
      end
    end

    context "when there are no bids" do
      before do
        travel_to(tender_offer.ends_at + 1.hour)
      end

      it "returns nil" do
        expect(subject).to be_nil
        expect(tender_offer.accepted_price_cents).to be_nil
      end
    end

    context "when the tender offer has ended" do
      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000 },
            { class_name: "Class B", count: 1_000 }
          ]
        )

        travel_to(tender_offer.ends_at + 1.hour)
      end

      describe "real scenario" do
        before do
          allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
            [
              { class_name: "Class A", count: 10_500 },
              { class_name: "Class B", count: 1_000_000 }
            ]
          )

          tender_offer.update!(number_of_shares: 10_000, total_amount_in_cents: 10_000_00_00_00)

          travel_to(tender_offer.starts_at + 1.hour) do
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                      number_of_shares: 400, share_price_cents: 10_00, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                      number_of_shares: 10_000, share_price_cents: 11_38, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                      number_of_shares: 5_000, share_price_cents: 13_38, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                      number_of_shares: 3_000, share_price_cents: 11_38, share_class: "Class B")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                      number_of_shares: 3_000, share_price_cents: 22_00, share_class: "Class B")

            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 500, share_price_cents: 10_00, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 10_000, share_price_cents: 11_38, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 10_500, share_price_cents: 13_38, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 10_000, share_price_cents: 11_38, share_class: "Class A")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 2_000, share_price_cents: 11_38, share_class: "Class B")
            create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                      number_of_shares: 3_000, share_price_cents: 22_00, share_class: "Class B")
          end
        end

        it "calculates the equilibrium price and allocates shares across multiple share classes proportionally" do
          expect(subject).to eq(11_38)
          expect(tender_offer.accepted_price_cents).to eq(11_38)

          # Investor 1 has bid 13,500 shares below the $11.38 price
          #   Bids:
          #   Class A: 10,400 shares
          #     400 shares at $10.00
          #     10,000 shares at $11.38
          #   Class B: 3,000 shares at $11.38
          # Investor 2 has bid 12,500 shares below the $11.38 price
          #   Bids:
          #   Class A: 10,500 shares
          #     500 shares at $10.00
          #     10,000 shares at $11.38
          #     10,000 shares at $11.38 - these are ignored because the max limit i.e. 10.5k is reached
          #   Class B: 2,000 shares at $11.38
          expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
            .to match_array([
                              ["Class A", 400.to_d, 10_00],
                              ["Class A", 3_615.to_d, 11_38],
                              ["Class A", 0.to_d, 13_38],
                              ["Class B", 0.to_d, 22_00],
                              ["Class B", 1_158.to_d, 11_38],
                            ])
          # Class A allocated = (3,615 + 400) / (10,400) = 38.60%
          # Class B allocated = (1,158) / (3,000) = 38.6%
          expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
            .to match_array([
                              ["Class A", 500.to_d, 10_00],
                              ["Class A", 0.to_d, 11_38],
                              ["Class A", 0.to_d, 13_38],
                              ["Class A", 3_554.to_d, 11_38],
                              ["Class B", 0.to_d, 22_00],
                              ["Class B", 772.to_d, 11_38]
                            ])
          # Class A allocated = (3,554 + 500) / 10,500 = 38.60%
          # Class B allocated = 772 / 2,000 = 38.60%
        end
      end

      it "calculates the equilibrium price and sets accepted_shares" do
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 100, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 200, share_price_cents: 12_00, share_class: "Class A")
        end
        expect(subject).to eq(12_00)
        expect(tender_offer.accepted_price_cents).to eq(12_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 100.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 200.to_d, 12_00]])
      end

      it "respects the total shares limit and sets accepted_shares" do
        tender_offer.update(number_of_shares: 150)
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 100, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 200, share_price_cents: 12_00, share_class: "Class A")
        end
        expect(subject).to eq(12_00)
        expect(tender_offer.accepted_price_cents).to eq(12_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 50.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 100.to_d, 12_00]])
      end

      it "respects the total amount limit and sets accepted_shares" do
        tender_offer.update(total_amount_in_cents: 150_000)
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 100, share_price_cents: 1000, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 200, share_price_cents: 1200, share_class: "Class A")
        end
        expect(subject).to eq(12_00)
        expect(tender_offer.accepted_price_cents).to eq(12_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 41.to_d, 1000]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 83.to_d, 1200]])
      end

      it "handles multiple bids from the same investor and sets accepted_shares" do
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 50, share_price_cents: 11_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 50, share_price_cents: 10_00, share_class: "Class A")
        end
        expect(subject).to eq(11_00)
        expect(tender_offer.accepted_price_cents).to eq(11_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([
                            ["Class A", 50.to_d, 11_00],
                            ["Class A", 50.to_d, 10_00]
                          ])
      end

      it "handles edge case with exact share limit and sets accepted_shares" do
        tender_offer.update(number_of_shares: 300)
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 100, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 200, share_price_cents: 12_00, share_class: "Class A")
        end
        expect(subject).to eq(12_00)
        expect(tender_offer.accepted_price_cents).to eq(12_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 100.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 200.to_d, 12_00]])
      end

      it "handles edge case with exact amount limit and sets accepted_shares" do
        tender_offer.update(total_amount_in_cents: 3_000_00)
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 100, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 200, share_price_cents: 12_00, share_class: "Class A")
        end
        expect(subject).to eq(12_00)
        expect(tender_offer.accepted_price_cents).to eq(12_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 83.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 166.to_d, 12_00]])
      end


      it "allocates a large number of shares across multiple share classes proportionally and efficiently" do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000_000 },
            { class_name: "Class B", count: 1_500_000 }
          ]
        )

        tender_offer.update!(number_of_shares: 200_000, total_amount_in_cents: 2_000_000_00)

        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                    number_of_shares: 1_000_000, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                    number_of_shares: 1_000_000, share_price_cents: 10_00, share_class: "Class B")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                    number_of_shares: 500_000, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                    number_of_shares: 1_500_000, share_price_cents: 10_00, share_class: "Class B")
        end

        result = subject
        expect(result).to eq(10_00)
        expect(tender_offer.accepted_price_cents).to eq(10_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([
                            ["Class A", 50_000.to_d, 10_00],
                            ["Class B", 50_000.to_d, 10_00]
                          ])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([
                            ["Class A", 25_000.to_d, 10_00],
                            ["Class B", 75_000.to_d, 10_00]
                          ])
      end
    end

    context "when custom total_amount_cents and total_shares are provided" do
      let(:total_amount_cents) { 5_000_00 }
      let(:total_shares) { 500 }

      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000 },
            { class_name: "Class B", count: 1_000 }
          ]
        )
      end

      it "uses the custom values instead of tender_offer values" do
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 300, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 300, share_price_cents: 10_00, share_class: "Class A")
        end
        expect(subject).to eq(10_00)
        expect(tender_offer.accepted_price_cents).to eq(10_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 10_00]])
      end
    end

    context "when only custom total_amount_cents is provided" do
      let(:total_amount_cents) { 5_000_00 }

      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000 },
            { class_name: "Class B", count: 1_000 }
          ]
        )
      end

      it "uses the custom total_amount_cents and tender_offer's number_of_shares" do
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 600, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 600, share_price_cents: 10_00, share_class: "Class A")
        end
        expect(subject).to eq(10_00)
        expect(tender_offer.accepted_price_cents).to eq(10_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 10_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 10_00]])
      end
    end

    context "when only custom total_shares is provided" do
      let(:total_shares) { 500 }

      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000 },
            { class_name: "Class B", count: 1_000 }
          ]
        )
      end

      it "uses the custom total_shares and tender_offer's total_amount_in_cents" do
        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_1,
                                    number_of_shares: 300, share_price_cents: 20_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor_2,
                                    number_of_shares: 300, share_price_cents: 20_00, share_class: "Class A")
        end
        expect(subject).to eq(20_00)
        expect(tender_offer.accepted_price_cents).to eq(20_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 20_00]])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([["Class A", 250.to_d, 20_00]])
      end
    end

    context "when there are bids for whole number shares and Crowd SAFE shares" do
      before do
        allow_any_instance_of(TenderOffer).to receive(:securities_available_for_purchase).and_return(
          [
            { class_name: "Class A", count: 1_000 },
            { class_name: "Class B", count: 1_000 },
            { class_name: "Crowd SAFE 2021", count: 1_000.20 },
          ]
        )

        tender_offer.update!(number_of_shares: 1_000, total_amount_in_cents: 10_000_00)

        travel_to(tender_offer.starts_at + 1.hour) do
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                    number_of_shares: 200, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                    number_of_shares: 300, share_price_cents: 11_00, share_class: "Class B")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_1,
                                    number_of_shares: 150.5, share_price_cents: 11_00, share_class: "Crowd SAFE 2021")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                    number_of_shares: 250, share_price_cents: 10_00, share_class: "Class A")
          create(:tender_offer_bid, tender_offer:, company_investor: company_investor_2,
                                    number_of_shares: 200.75, share_price_cents: 11_00, share_class: "Crowd SAFE 2021")
        end
      end

      it "calculates the equilibrium price and sets accepted_shares for both whole number and decimal shares" do
        expect(subject).to eq(11_00)
        expect(tender_offer.accepted_price_cents).to eq(11_00)

        expect(tender_offer.bids.where(company_investor: company_investor_1).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([
                            ["Class A", 165.to_d, 10_00], # 82.5%
                            ["Class B", 247.to_d, 11_00], # 82.33%
                            ["Crowd SAFE 2021", 124.to_d, 11_00] # 82.39%
                          ])
        expect(tender_offer.bids.where(company_investor: company_investor_2).pluck(:share_class, :accepted_shares, :share_price_cents))
          .to match_array([
                            ["Class A", 206.to_d, 10_00], # 82.4%
                            ["Crowd SAFE 2021", 166.to_d, 11_00] # 82.68%
                          ])
        # Note how the percentages are different. This is because the decimal share is not a whole number and is
        # allocated across all share classes proportionally.
      end
    end
  end
end
