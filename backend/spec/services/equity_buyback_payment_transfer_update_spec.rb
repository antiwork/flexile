# frozen_string_literal: true

RSpec.describe EquityBuybackPaymentTransferUpdate do
  let(:equity_buyback_payment) do
    create(:equity_buyback_payment, equity_buybacks: [equity_buyback1, equity_buyback2], transfer_id: SecureRandom.hex)
  end
  let(:equity_buyback1) { create(:equity_buyback) }
  let(:equity_buyback2) { create(:equity_buyback) }
  let(:current_time) { Time.current.change(usec: 0) }
  let(:transfer_estimate) { current_time + 2.days }
  let(:failed_transfer_payload) do
    {
      "data" => {
        "resource" => { "id" => equity_buyback_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::CANCELLED,
        "occurred_at" => current_time.iso8601,
      },
    }
  end

  before do
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:get_transfer).and_return({ "targetValue" => 1000, "sourceValue" => 1000.05 })
    )
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:delivery_estimate).and_return({ "estimatedDeliveryDate" => transfer_estimate.iso8601 })
    )
  end

  it "marks associated equity buybacks as paid for a successful transfer" do
    payload = {
      "data" => {
        "resource" => { "id" => equity_buyback_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::OUTGOING_PAYMENT_SENT,
        "occurred_at" => current_time.iso8601,
      },
    }

    expect do
      described_class.new(equity_buyback_payment, payload).process
    end.to have_enqueued_mail(CompanyInvestorMailer, :equity_buyback_payment).with(equity_buyback_payment_id: equity_buyback_payment.id)

    equity_buyback_payment.reload
    equity_buyback1.reload
    equity_buyback2.reload
    expect(equity_buyback_payment.status).to eq(Payment::SUCCEEDED)
    expect(equity_buyback_payment.transfer_status).to eq(Payments::Wise::OUTGOING_PAYMENT_SENT)
    expect(equity_buyback_payment.transfer_amount).to eq(1000)
    expect(equity_buyback_payment.wise_transfer_estimate).to eq(transfer_estimate)
    expect(equity_buyback1.status).to eq(EquityBuyback::PAID)
    expect(equity_buyback1.paid_at).to eq(current_time)
    expect(equity_buyback2.status).to eq(EquityBuyback::PAID)
    expect(equity_buyback2.paid_at).to eq(current_time)
  end

  it "marks the equity buyback payment as failed for a failed transfer" do
    described_class.new(equity_buyback_payment, failed_transfer_payload).process

    equity_buyback_payment.reload
    equity_buyback1.reload
    equity_buyback2.reload
    expect(equity_buyback_payment.transfer_status).to eq(Payments::Wise::CANCELLED)
    expect(equity_buyback_payment.status).to eq(Payment::FAILED)
    expect(equity_buyback1.paid_at).to be_nil
    expect(equity_buyback2.paid_at).to be_nil
  end

  it "marks the equity buyback payment as processing for a transfer in an intermediary state" do
    payload = {
      "data" => {
        "resource" => { "id" => equity_buyback_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::BOUNCED_BACK,
        "occurred_at" => current_time.iso8601,
      },
    }

    described_class.new(equity_buyback_payment, payload).process

    expect(equity_buyback_payment.reload.transfer_status).to eq(Payments::Wise::BOUNCED_BACK)
    expect(equity_buyback1.reload.status).to eq(EquityBuyback::PROCESSING)
    expect(equity_buyback2.reload.status).to eq(EquityBuyback::PROCESSING)
  end
end
