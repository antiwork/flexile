# frozen_string_literal: true

RSpec.describe TenderOffers::FinalizeBuyback do
  let(:company) { create(:company, fully_diluted_shares: 1_000_000) }
  let(:tender_offer) { create(:tender_offer, company: company, accepted_price_cents: 10_00) }
  let(:service) { described_class.new(tender_offer: tender_offer) }

  describe "#perform" do
    let(:mock_equity_buyback_round) { double("EquityBuybackRound", equity_buybacks: []) }

    before do
      allow(TenderOffers::GenerateEquityBuybacks).to receive(:new).and_return(double(perform: true))
      allow(TenderOffers::UpdateCapTable).to receive(:new).and_return(double(perform: true))
      allow(tender_offer).to receive(:equity_buyback_rounds).and_return(double(sole: mock_equity_buyback_round))
    end

    context "when tender offer has accepted price" do
      it "generates equity buybacks" do
        expect(TenderOffers::GenerateEquityBuybacks).to receive(:new).with(tender_offer: tender_offer)
        service.perform
      end

      it "updates implied valuation" do
        expect { service.perform }.to change { tender_offer.reload.implied_valuation }
          .to(10_000_000) # 10_00 * 1_000_000 / 100
      end

      it "updates cap table" do
        expect(TenderOffers::UpdateCapTable).to receive(:new).with(equity_buyback_round: mock_equity_buyback_round)
        service.perform
      end

      it "sends notification emails to investors with bids" do
        company_investor1 = create(:company_investor, company: company)
        company_investor2 = create(:company_investor, company: company)

        allow(tender_offer).to receive(:securities_available_for_purchase).and_return([
                                                                                        { class_name: "A", count: 1000 }
                                                                                      ])

        create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor1,
                                  accepted_shares: 100, share_price_cents: 10_00, share_class: "A")
        create(:tender_offer_bid, tender_offer: tender_offer, company_investor: company_investor2,
                                  accepted_shares: 50, share_price_cents: 10_00, share_class: "A")

        expect { service.perform }.to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_closed).exactly(2).times
      end

      context "with eligible investors for payment processing" do
        let!(:company_investor1) { create(:company_investor, company: company) }
        let!(:company_investor2) { create(:company_investor, company: company) }
        let!(:user1) { company_investor1.user }
        let!(:user2) { company_investor2.user }
        let!(:equity_buyback1) { double("EquityBuyback", company_investor: company_investor1) }
        let!(:equity_buyback2) { double("EquityBuyback", company_investor: company_investor2) }

        before do
          allow(user1).to receive(:has_verified_tax_id?).and_return(true)
          allow(user1).to receive(:restricted_payout_country_resident?).and_return(false)
          allow(user1).to receive(:sanctioned_country_resident?).and_return(false)
          allow(user1).to receive(:tax_information_confirmed_at).and_return(1.day.ago)
          allow(company_investor1).to receive(:completed_onboarding?).and_return(true)

          allow(user2).to receive(:has_verified_tax_id?).and_return(false)
          allow(company_investor2).to receive(:completed_onboarding?).and_return(true)

          allow(mock_equity_buyback_round).to receive(:equity_buybacks).and_return([equity_buyback1, equity_buyback2])
        end

        it "processes payments for eligible investors only" do
          expect(InvestorEquityBuybacksPaymentJob).to receive(:perform_in).with(2.seconds, company_investor1.id)
          expect(InvestorEquityBuybacksPaymentJob).not_to receive(:perform_in).with(anything, company_investor2.id)

          service.perform
        end
      end

      context "with investors from restricted countries" do
        let!(:company_investor1) { create(:company_investor, company: company) }
        let!(:company_investor2) { create(:company_investor, company: company) }
        let!(:user1) { company_investor1.user }
        let!(:user2) { company_investor2.user }
        let!(:equity_buyback1) { double("EquityBuyback", company_investor: company_investor1) }
        let!(:equity_buyback2) { double("EquityBuyback", company_investor: company_investor2) }

        before do
          allow(user1).to receive(:has_verified_tax_id?).and_return(true)
          allow(user1).to receive(:restricted_payout_country_resident?).and_return(false)
          allow(user1).to receive(:sanctioned_country_resident?).and_return(false)
          allow(user1).to receive(:tax_information_confirmed_at).and_return(1.day.ago)
          allow(company_investor1).to receive(:completed_onboarding?).and_return(true)

          allow(user2).to receive(:has_verified_tax_id?).and_return(true)
          allow(user2).to receive(:restricted_payout_country_resident?).and_return(true)
          allow(user2).to receive(:sanctioned_country_resident?).and_return(false)
          allow(company_investor2).to receive(:completed_onboarding?).and_return(true)

          allow(mock_equity_buyback_round).to receive(:equity_buybacks).and_return([equity_buyback1, equity_buyback2])
        end

        it "processes payments only for investors from allowed countries" do
          expect(InvestorEquityBuybacksPaymentJob).to receive(:perform_in).with(2.seconds, company_investor1.id)
          expect(InvestorEquityBuybacksPaymentJob).not_to receive(:perform_in).with(anything, company_investor2.id)

          service.perform
        end
      end
    end

    context "when tender offer has no accepted price" do
      let(:tender_offer) { create(:tender_offer, company: company, accepted_price_cents: nil) }

      it "raises an error during implied valuation calculation" do
        expect { service.perform }.to raise_error(ArgumentError, "Accepted price must be set before finalizing")
      end

      it "does not send notification emails" do
        expect { service.perform rescue nil }.not_to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_closed)
      end

      it "does not process any payments" do
        expect(InvestorEquityBuybacksPaymentJob).not_to receive(:perform_in)
        service.perform rescue nil
      end
    end

    context "when no investors have bids" do
      it "does not process any payments" do
        expect(InvestorEquityBuybacksPaymentJob).not_to receive(:perform_in)
        service.perform
      end

      it "does not send notification emails" do
        expect { service.perform }.not_to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_closed)
      end
    end

    context "when equity buyback generation fails" do
      before do
        allow(TenderOffers::GenerateEquityBuybacks).to receive(:new).and_raise(ActiveRecord::RecordInvalid.new(tender_offer))
      end

      it "raises the error and does not proceed" do
        expect { service.perform }.to raise_error(ActiveRecord::RecordInvalid)
      end

      it "does not update implied valuation" do
        expect { service.perform rescue nil }.not_to change { tender_offer.reload.implied_valuation }
      end

      it "does not send notifications" do
        expect { service.perform rescue nil }.not_to have_enqueued_mail(CompanyInvestorMailer, :tender_offer_closed)
      end
    end

    context "with payment processing delays" do
      let!(:users_and_investors) do
        3.times.map do |i|
          company_investor = create(:company_investor, company: company)
          user = company_investor.user

          allow(user).to receive(:has_verified_tax_id?).and_return(true)
          allow(user).to receive(:restricted_payout_country_resident?).and_return(false)
          allow(user).to receive(:sanctioned_country_resident?).and_return(false)
          allow(user).to receive(:tax_information_confirmed_at).and_return(1.day.ago)
          allow(company_investor).to receive(:completed_onboarding?).and_return(true)

          [user, company_investor]
        end
      end

      let(:equity_buybacks) do
        users_and_investors.map { |_, investor| double("EquityBuyback", company_investor: investor) }
      end

      before do
        allow(mock_equity_buyback_round).to receive(:equity_buybacks).and_return(equity_buybacks)
      end

      it "schedules payments with increasing delays" do
        users_and_investors.each_with_index do |(_user, investor), index|
          expected_delay = ((index + 1) * 2).seconds
          expect(InvestorEquityBuybacksPaymentJob).to receive(:perform_in).with(expected_delay, investor.id)
        end

        service.perform
      end
    end
  end
end
