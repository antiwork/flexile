# frozen_string_literal: true

RSpec.describe ProcessDividendPayment do
  let(:company) { create(:company, equity_enabled: true) }
  let(:dividend_round) { create(:dividend_round, company: company, status: "Issued", total_amount_in_cents: 100_000) }
  let(:service) { described_class.new(dividend_round) }

  # Mock Stripe objects
  let(:mock_payment_intent) do
    double("Stripe::PaymentIntent",
           id: "pi_test_123",
           latest_charge: double(id: "ch_test_456"))
  end
  let(:mock_payout) { double("Stripe::Payout", id: "po_test_789") }

  before do
    # Mock company bank account setup
    allow(company).to receive(:bank_account_ready?).and_return(true)

    # Mock Stripe calls
    allow(Stripe::PaymentIntent).to receive(:create).and_return(mock_payment_intent)
    allow(Stripe::Payout).to receive(:create).and_return(mock_payout)
  end

  describe "#process!" do
    context "when prerequisites are not met" do
      it "raises an error if company does not have a bank account set up" do
        allow(company).to receive(:bank_account_ready?).and_return(false)

        expect { service.process! }.to raise_error(
          ProcessDividendPayment::Error,
          "Company does not have a bank account set up"
        )
      end

      it "raises an error if dividend round is not ready for payment" do
        dividend_round.update!(status: "Draft")

        expect { service.process! }.to raise_error(
          ProcessDividendPayment::Error,
          "Dividend round is not ready for payment"
        )
      end

      it "raises an error if dividend round has no dividends to pay" do
        allow(dividend_round.dividends).to receive(:empty?).and_return(true)

        expect { service.process! }.to raise_error(
          ProcessDividendPayment::Error,
          "Dividend round has no dividends to pay"
        )
      end
    end

    context "when prerequisites are met" do
      before do
        # Create some dividends for the round
        create(:dividend, dividend_round: dividend_round)
        create(:dividend, dividend_round: dividend_round)
      end

      it "successfully processes payment and returns payment details" do
        result = service.process!

        expect(result).to include(
          payment_intent_id: "pi_test_123",
          payout_id: "po_test_789",
          total_amount_with_fees: 103_430 # 100_000 + 2_900 + 30 + 500
        )
      end

      it "calculates fees correctly" do
        service.process!

        expect(Stripe::PaymentIntent).to have_received(:create).with(
          hash_including(amount: 103_430) # Base amount + processing fee + transfer fee
        )

        expect(Stripe::Payout).to have_received(:create).with(
          hash_including(amount: 100_000) # Only dividend amount, not fees
        )
      end

      it "creates payment intent with correct parameters" do
        allow(company).to receive_message_chain(:bank_account, :stripe_setup_intent).and_return(
          double(payment_method: "pm_test", customer: "cus_test")
        )

        service.process!

        expect(Stripe::PaymentIntent).to have_received(:create).with(
          hash_including(
            payment_method_types: ["us_bank_account"],
            payment_method: "pm_test",
            customer: "cus_test",
            confirm: true,
            amount: 103_430,
            currency: "USD",
            capture_method: "automatic",
            description: "Dividend payment for round #{dividend_round.external_id}",
            metadata: hash_including(
              dividend_round_id: dividend_round.id,
              company_id: company.id,
              purpose: "dividend_funding"
            )
          )
        )
      end

      it "creates payout with correct parameters" do
        service.process!

        expect(Stripe::Payout).to have_received(:create).with(
          hash_including(
            amount: 100_000,
            currency: "usd",
            description: "Dividend payout for round #{dividend_round.external_id}",
            statement_descriptor: "Flexile Dividend",
            metadata: hash_including(
              dividend_round_id: dividend_round.id,
              company_id: company.id,
              source_payment_intent: "pi_test_123"
            )
          )
        )
      end

      it "updates dividend round status to Paid" do
        service.process!

        dividend_round.reload
        expect(dividend_round.status).to eq("Paid")
        expect(dividend_round.ready_for_payment).to be true
      end
    end

    context "when Stripe payment intent creation fails" do
      before do
        create(:dividend, dividend_round: dividend_round)
        allow(Stripe::PaymentIntent).to receive(:create).and_raise(
          Stripe::CardError.new("Payment failed", nil, code: "card_declined")
        )
      end

      it "raises a ProcessDividendPayment::Error with payment failure message" do
        expect { service.process! }.to raise_error(
          ProcessDividendPayment::Error,
          /Failed to collect payment from company: Payment failed/
        )
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:error).with(
          /Failed to pull funds for dividend round #{dividend_round.id}: Payment failed/
        )

        expect { service.process! }.to raise_error(ProcessDividendPayment::Error)
      end
    end

    context "when Stripe payout creation fails" do
      before do
        create(:dividend, dividend_round: dividend_round)
        allow(Stripe::Payout).to receive(:create).and_raise(
          Stripe::InvalidRequestError.new("Insufficient funds", nil)
        )
      end

      it "raises a ProcessDividendPayment::Error with payout failure message" do
        expect { service.process! }.to raise_error(
          ProcessDividendPayment::Error,
          /Failed to create payout: Insufficient funds/
        )
      end

      it "logs the error" do
        expect(Rails.logger).to receive(:error).with(
          /Failed to create payout for dividend round #{dividend_round.id}: Insufficient funds/
        )

        expect { service.process! }.to raise_error(ProcessDividendPayment::Error)
      end
    end

    context "in development environment with SKIP_STRIPE_PAYMENTS enabled" do
      before do
        create(:dividend, dividend_round: dividend_round)
        allow(Rails.env).to receive(:development?).and_return(true)
        allow(ENV).to receive(:[]).with("SKIP_STRIPE_PAYMENTS").and_return("true")
      end

      it "simulates payment without calling Stripe" do
        result = service.process!

        expect(Stripe::PaymentIntent).not_to have_received(:create)
        expect(Stripe::Payout).not_to have_received(:create)

        expect(result[:payment_intent_id]).to start_with("sim_pi_")
        expect(result[:payout_id]).to start_with("sim_po_")
      end

      it "logs simulation messages" do
        expect(Rails.logger).to receive(:info).with(
          /SIMULATED: Payment pull of \$1034.3 for dividend round #{dividend_round.external_id}/
        )
        expect(Rails.logger).to receive(:info).with(
          /SIMULATED: Payout of \$1000.0 for dividend round #{dividend_round.external_id}/
        )

        service.process!
      end
    end
  end

  describe "private methods" do
    describe "#calculate_total_amount_with_fees" do
      it "calculates correct fees for dividend amount" do
        # Test fee calculation: 100_000 * 0.029 + 30 + 500 = 2900 + 30 + 500 = 3430
        total = service.send(:calculate_total_amount_with_fees)
        expect(total).to eq(103_430)
      end

      it "handles different dividend amounts correctly" do
        dividend_round.update!(total_amount_in_cents: 50_000)

        # 50_000 * 0.029 + 30 + 500 = 1450 + 30 + 500 = 1980
        total = service.send(:calculate_total_amount_with_fees)
        expect(total).to eq(51_980)
      end
    end
  end
end
