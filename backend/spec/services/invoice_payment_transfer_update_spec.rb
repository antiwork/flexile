# frozen_string_literal: true

RSpec.describe InvoicePaymentTransferUpdate do
  let(:wise_credential) { create(:wise_credential) }
  let(:invoice) { create(:invoice, :processing) }
  let(:payment) do
    create(:payment,
           invoice:,
           wise_credential:,
           wise_transfer_id: "12345",
           wise_transfer_status: Payments::Wise::PROCESSING,
           status: Payment::INITIAL)
  end
  let(:current_time) { Time.current.change(usec: 0) }
  let(:transfer_estimate) { current_time + 2.days }

  before do
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:get_transfer).and_return({ "targetValue" => 50.0, "sourceValue" => 60.0 })
    )
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:delivery_estimate).and_return({ "estimatedDeliveryDate" => transfer_estimate.iso8601 })
    )
  end

  it "marks the payment as succeeded and invoice as paid for a successful transfer" do
    described_class.new(payment, current_state: Payments::Wise::OUTGOING_PAYMENT_SENT, occurred_at: current_time).process

    payment.reload
    invoice.reload
    expect(payment.status).to eq(Payment::SUCCEEDED)
    expect(payment.wise_transfer_status).to eq(Payments::Wise::OUTGOING_PAYMENT_SENT)
    expect(payment.wise_transfer_amount).to eq(50.0)
    expect(payment.wise_transfer_estimate).to eq(transfer_estimate)
    expect(invoice.status).to eq(Invoice::PAID)
    expect(invoice.paid_at).to eq(current_time)
  end

  it "marks the payment and invoice as failed for a failed transfer" do
    expect do
      described_class.new(payment, current_state: Payments::Wise::CANCELLED).process
    end.to change { PaymentBalanceTransaction.count }.by(1)

    payment.reload
    invoice.reload
    expect(payment.status).to eq(Payment::FAILED)
    expect(payment.wise_transfer_status).to eq(Payments::Wise::CANCELLED)
    expect(invoice.status).to eq(Invoice::FAILED)

    balance_transaction = payment.balance_transactions.last
    expect(balance_transaction.amount_cents).to eq(-6000)
    expect(balance_transaction.transaction_type).to eq(BalanceTransaction::PAYMENT_FAILED)
  end

  it "keeps the invoice in processing for an intermediary transfer state" do
    described_class.new(payment, current_state: Payments::Wise::FUNDS_CONVERTED).process

    payment.reload
    invoice.reload
    expect(payment.wise_transfer_status).to eq(Payments::Wise::FUNDS_CONVERTED)
    expect(invoice.status).to eq(Invoice::PROCESSING)
  end

  it "does not create duplicate balance transactions when payment is already failed" do
    payment.update!(status: Payment::FAILED)

    expect do
      described_class.new(payment, current_state: Payments::Wise::FUNDS_REFUNDED).process
    end.not_to change { PaymentBalanceTransaction.count }

    expect(invoice.reload.status).to eq(Invoice::FAILED)
  end

  it "defaults occurred_at to Time.current" do
    freeze_time do
      described_class.new(payment, current_state: Payments::Wise::OUTGOING_PAYMENT_SENT).process
      expect(invoice.reload.paid_at).to eq(Time.current)
    end
  end

  it "fetches current_state from Wise API when not provided" do
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:get_transfer).and_return({ "status" => Payments::Wise::OUTGOING_PAYMENT_SENT, "targetValue" => 50.0 })
    )

    described_class.new(payment).process

    expect(payment.reload.status).to eq(Payment::SUCCEEDED)
    expect(invoice.reload.status).to eq(Invoice::PAID)
  end

  it "skips processing when the transfer status has not changed" do
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:get_transfer).and_return({ "status" => Payments::Wise::PROCESSING })
    )

    described_class.new(payment).process

    expect(payment.reload.status).to eq(Payment::INITIAL)
    expect(invoice.reload.status).to eq(Invoice::PROCESSING)
  end
end
