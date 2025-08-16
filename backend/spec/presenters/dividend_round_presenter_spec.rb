# frozen_string_literal: true

RSpec.describe DividendRoundPresenter do
  let(:company) { create(:company, dividends_allowed: true) }
  let(:dividend_round) do
    create(:dividend_round,
           company: company,
           external_id: "DIV_2024_Q1",
           total_amount_in_cents: 250_000, # $2,500.00
           issued_at: 10.days.from_now,
           number_of_shareholders: 5,
           number_of_shares: 10_000,
           status: "Issued",
           return_of_capital: false,
           ready_for_payment: true,
           created_at: Time.zone.parse("2024-03-15T10:00:00Z"),
           updated_at: Time.zone.parse("2024-03-15T15:30:00Z"))
  end

  let(:user1) { create(:user, legal_name: "John Doe", email: "john@example.com") }
  let(:user2) { create(:user, legal_name: "Jane Smith", email: "jane@example.com") }
  let(:company_investor1) { create(:company_investor, company: company, user: user1) }
  let(:company_investor2) { create(:company_investor, company: company, user: user2) }

  let!(:dividend1) do
    create(:dividend,
           dividend_round: dividend_round,
           company_investor: company_investor1,
           total_amount_in_cents: 120_000, # $1,200.00
           number_of_shares: 4_000,
           qualified_amount_cents: 80_000, # $800.00
           status: "Issued")
  end

  let!(:dividend2) do
    create(:dividend,
           dividend_round: dividend_round,
           company_investor: company_investor2,
           total_amount_in_cents: 130_000, # $1,300.00
           number_of_shares: 6_000,
           qualified_amount_cents: 100_000, # $1,000.00
           status: "Processing")
  end

  let!(:investor_dividend_round1) do
    create(:investor_dividend_round,
           dividend_round: dividend_round,
           company_investor: company_investor1,
           dividend_issued_email_sent: true,
           sanctioned_country_email_sent: false,
           payout_below_threshold_email_sent: false)
  end

  let!(:investor_dividend_round2) do
    create(:investor_dividend_round,
           dividend_round: dividend_round,
           company_investor: company_investor2,
           dividend_issued_email_sent: false,
           sanctioned_country_email_sent: true,
           payout_below_threshold_email_sent: false)
  end

  let(:presenter) { described_class.new(dividend_round) }

  describe "#summary" do
    subject { presenter.summary }

    it "returns comprehensive dividend round summary" do
      expect(subject).to eq({
        id: "DIV_2024_Q1",
        total_amount_in_cents: 250_000,
        total_amount_in_usd: 2500.0,
        issued_at: "2024-03-15T14:30:00Z",
        number_of_shareholders: 5,
        number_of_shares: 10_000,
        status: "Issued",
        return_of_capital: false,
        ready_for_payment: true,
        created_at: "2024-03-15T10:00:00Z",
        updated_at: "2024-03-15T15:30:00Z",
        payment_fees: {
          dividend_amount_cents: 250_000,
          dividend_amount_usd: 2500.0,
          processing_fee_cents: 7280, # 250_000 * 0.029 + 30 = 7250 + 30
          processing_fee_usd: 72.8,
          transfer_fee_cents: 500,
          transfer_fee_usd: 5.0,
          total_with_fees_cents: 257_780,
          total_with_fees_usd: 2577.8,
        },
      })
    end

    context "when dividend round is return of capital" do
      before { dividend_round.update!(return_of_capital: true) }

      it "includes return_of_capital as true" do
        expect(subject[:return_of_capital]).to be true
      end
    end

    context "when dividend round is not ready for payment" do
      before { dividend_round.update!(ready_for_payment: false) }

      it "includes ready_for_payment as false" do
        expect(subject[:ready_for_payment]).to be false
      end
    end

    context "with different dividend amounts" do
      before { dividend_round.update!(total_amount_in_cents: 100_000) }

      it "calculates fees correctly for different amounts" do
        fees = subject[:payment_fees]

        expect(fees[:dividend_amount_cents]).to eq(100_000)
        expect(fees[:dividend_amount_usd]).to eq(1000.0)
        expect(fees[:processing_fee_cents]).to eq(2930) # 100_000 * 0.029 + 30
        expect(fees[:processing_fee_usd]).to eq(29.3)
        expect(fees[:transfer_fee_cents]).to eq(500)
        expect(fees[:transfer_fee_usd]).to eq(5.0)
        expect(fees[:total_with_fees_cents]).to eq(103_430)
        expect(fees[:total_with_fees_usd]).to eq(1034.3)
      end
    end
  end

  describe "#detailed_view" do
    subject { presenter.detailed_view }

    it "includes all summary data plus detailed information" do
      expect(subject).to include({
        id: "DIV_2024_Q1",
        total_amount_in_cents: 250_000,
        total_amount_in_usd: 2500.0,
        status: "Issued",
      })

      expect(subject).to have_key(:dividends)
      expect(subject).to have_key(:investor_dividend_rounds)
      expect(subject).to have_key(:payment_fees)
    end

    describe "dividends" do
      let(:dividends) { subject[:dividends] }

      it "returns array of dividend data" do
        expect(dividends).to be_an(Array)
        expect(dividends.length).to eq(2)
      end

      it "includes dividend details for first investor" do
        dividend = dividends.find { |d| d[:investor_name] == "John Doe" }

        expect(dividend).to include({
          id: dividend1.id,
          investor_name: "John Doe",
          investor_email: "john@example.com",
          total_amount_in_cents: 120_000,
          total_amount_in_usd: 1200.0,
          number_of_shares: 4_000,
          qualified_amount_cents: 80_000,
          qualified_amount_usd: 800.0,
          non_qualified_amount_usd: 400.0, # (120_000 - 80_000) / 100
          status: "Issued",
        })
      end

      it "includes dividend details for second investor" do
        dividend = dividends.find { |d| d[:investor_name] == "Jane Smith" }

        expect(dividend).to include({
          id: dividend2.id,
          investor_name: "Jane Smith",
          investor_email: "jane@example.com",
          total_amount_in_cents: 130_000,
          total_amount_in_usd: 1300.0,
          number_of_shares: 6_000,
          qualified_amount_cents: 100_000,
          qualified_amount_usd: 1000.0,
          non_qualified_amount_usd: 300.0, # (130_000 - 100_000) / 100
          status: "Processing",
        })
      end

      context "when dividend has no status" do
        before { dividend1.update!(status: nil) }

        it "defaults status to 'pending'" do
          dividend = dividends.find { |d| d[:investor_name] == "John Doe" }
          expect(dividend[:status]).to eq("pending")
        end
      end
    end

    describe "investor_dividend_rounds" do
      let(:investor_rounds) { subject[:investor_dividend_rounds] }

      it "returns array of investor dividend round data" do
        expect(investor_rounds).to be_an(Array)
        expect(investor_rounds.length).to eq(2)
      end

      it "includes email status for first investor" do
        investor_round = investor_rounds.find { |idr| idr[:investor_name] == "John Doe" }

        expect(investor_round).to eq({
          investor_name: "John Doe",
          dividend_issued_email_sent: true,
          sanctioned_country_email_sent: false,
          payout_below_threshold_email_sent: false,
        })
      end

      it "includes email status for second investor" do
        investor_round = investor_rounds.find { |idr| idr[:investor_name] == "Jane Smith" }

        expect(investor_round).to eq({
          investor_name: "Jane Smith",
          dividend_issued_email_sent: false,
          sanctioned_country_email_sent: true,
          payout_below_threshold_email_sent: false,
        })
      end
    end
  end

  describe "edge cases" do
    context "when dividend round has no dividends" do
      before { dividend_round.dividends.destroy_all }

      it "returns empty dividends array" do
        expect(presenter.detailed_view[:dividends]).to eq([])
      end
    end

    context "when dividend round has no investor dividend rounds" do
      before { dividend_round.investor_dividend_rounds.destroy_all }

      it "returns empty investor dividend rounds array" do
        expect(presenter.detailed_view[:investor_dividend_rounds]).to eq([])
      end
    end

    context "with zero qualified dividend amount" do
      before { dividend1.update!(qualified_amount_cents: 0) }

      it "calculates non-qualified amount correctly" do
        dividends = presenter.detailed_view[:dividends]
        dividend = dividends.find { |d| d[:investor_name] == "John Doe" }

        expect(dividend[:qualified_amount_usd]).to eq(0.0)
        expect(dividend[:non_qualified_amount_usd]).to eq(1200.0)
      end
    end

    context "with all qualified dividend amount" do
      before { dividend1.update!(qualified_amount_cents: 120_000) }

      it "calculates non-qualified amount as zero" do
        dividends = presenter.detailed_view[:dividends]
        dividend = dividends.find { |d| d[:investor_name] == "John Doe" }

        expect(dividend[:qualified_amount_usd]).to eq(1200.0)
        expect(dividend[:non_qualified_amount_usd]).to eq(0.0)
      end
    end

    context "with large dividend amounts" do
      before { dividend_round.update!(total_amount_in_cents: 1_000_000_000) } # $10M

      it "handles large amounts correctly" do
        fees = presenter.summary[:payment_fees]

        expect(fees[:dividend_amount_usd]).to eq(10_000_000.0)
        expect(fees[:processing_fee_cents]).to eq(29_000_030) # 1B * 0.029 + 30
        expect(fees[:processing_fee_usd]).to eq(290_000.3)
        expect(fees[:total_with_fees_usd]).to eq(10_290_005.3)
      end
    end

    context "when company_investor user is missing" do
      before do
        allow(dividend1.company_investor).to receive(:user).and_return(nil)
      end

      it "handles gracefully when user is missing" do
        dividends = presenter.detailed_view[:dividends]
        dividend = dividends.find { |d| d[:id] == dividend1.id }

        expect(dividend[:investor_name]).to be_nil
        expect(dividend[:investor_email]).to be_nil
      end
    end
  end

  describe "private method #calculate_payment_fees" do
    it "correctly calculates all fee components" do
      fees = presenter.send(:calculate_payment_fees)

      expect(fees).to include({
        dividend_amount_cents: 250_000,
        dividend_amount_usd: 2500.0,
        processing_fee_cents: 7_280,
        processing_fee_usd: 72.8,
        transfer_fee_cents: 500,
        transfer_fee_usd: 5.0,
        total_with_fees_cents: 257_780,
        total_with_fees_usd: 2577.8,
      })
    end

    context "with minimal dividend amount" do
      before { dividend_round.update!(total_amount_in_cents: 100) } # $1.00

      it "applies minimum processing fees correctly" do
        fees = presenter.send(:calculate_payment_fees)

        expect(fees[:processing_fee_cents]).to eq(33) # 100 * 0.029 + 30 = 2.9 + 30 rounded
        expect(fees[:total_with_fees_cents]).to eq(633) # 100 + 33 + 500
      end
    end
  end
end
