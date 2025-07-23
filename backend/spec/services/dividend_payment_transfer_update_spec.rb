# frozen_string_literal: true

RSpec.describe DividendPaymentTransferUpdate do
  let(:user) { create(:user) }
  let(:company_investor) { create(:company_investor, user:) }
  let(:dividend1) { create(:dividend, company_investor:) }
  let(:dividend2) { create(:dividend, company_investor:) }
  let(:dividend_payment) do
    create(:dividend_payment, dividends: [dividend1, dividend2], transfer_id: SecureRandom.hex)
  end
  let(:current_time) { Time.current.change(usec: 0) }
  let(:transfer_estimate) { current_time + 2.days }

  before do
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:get_transfer).and_return({ "targetValue" => 1000, "sourceValue" => 1000.05 })
    )
    allow_any_instance_of(Wise::PayoutApi).to(
      receive(:delivery_estimate).and_return({ "estimatedDeliveryDate" => transfer_estimate.iso8601 })
    )
  end

  it "marks associated dividends as paid for a successful transfer" do
    payload = {
      "data" => {
        "resource" => { "id" => dividend_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::OUTGOING_PAYMENT_SENT,
        "occurred_at" => current_time.iso8601,
      },
    }

    expect do
      described_class.new(dividend_payment, payload).process
    end.to have_enqueued_mail(CompanyInvestorMailer, :dividend_payment).with(dividend_payment.id)

    dividend_payment.reload
    dividend1.reload
    dividend2.reload
    expect(dividend_payment.status).to eq(Payment::SUCCEEDED)
    expect(dividend_payment.transfer_status).to eq(Payments::Wise::OUTGOING_PAYMENT_SENT)
    expect(dividend_payment.transfer_amount).to eq(1000)
    expect(dividend_payment.wise_transfer_estimate).to eq(transfer_estimate)
    expect(dividend1.status).to eq(Dividend::PAID)
    expect(dividend1.paid_at).to eq(current_time)
    expect(dividend2.status).to eq(Dividend::PAID)
    expect(dividend2.paid_at).to eq(current_time)
  end

  it "marks the dividend payment as failed for a failed transfer" do
    failed_transfer_payload = {
      "data" => {
        "resource" => { "id" => dividend_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::CANCELLED,
        "occurred_at" => current_time.iso8601,
      },
    }
    described_class.new(dividend_payment, failed_transfer_payload).process

    dividend_payment.reload
    dividend1.reload
    dividend2.reload
    expect(dividend_payment.transfer_status).to eq(Payments::Wise::CANCELLED)
    expect(dividend_payment.status).to eq(Payment::FAILED)
    expect(dividend1.paid_at).to be_nil
    expect(dividend2.paid_at).to be_nil
  end

  it "marks the dividend payment as processing for a transfer in an intermediary state" do
    payload = {
      "data" => {
        "resource" => { "id" => dividend_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
        "current_state" => Payments::Wise::BOUNCED_BACK,
        "occurred_at" => current_time.iso8601,
      },
    }

    described_class.new(dividend_payment, payload).process

    expect(dividend_payment.reload.transfer_status).to eq(Payments::Wise::BOUNCED_BACK)
    expect(dividend1.reload.status).to eq(Dividend::PROCESSING)
    expect(dividend2.reload.status).to eq(Dividend::PROCESSING)
  end

  context "when the transfer state is 'funds_refunded'" do
    let!(:bank_account) { user.bank_account_for_dividends }
    let(:refunded_payload) do
      {
        "data" => {
          "resource" => { "id" => dividend_payment.transfer_id, "profile_id" => WISE_PROFILE_ID },
          "current_state" => Payments::Wise::FUNDS_REFUNDED,
          "occurred_at" => current_time.iso8601,
        },
      }
    end

    before do
      [dividend1, dividend2].each { _1.update!(status: "Processing", paid_at: Time.current) }
    end

    it "marks the user's bank account as deleted" do
      expect do
        described_class.new(dividend_payment, refunded_payload).process
      end.to change { bank_account.reload.deleted_at }.from(nil)
    end

    it "reverts the dividend status to 'Issued' and clears paid_at" do
      described_class.new(dividend_payment, refunded_payload).process
      expect(dividend1.reload.status).to eq("Issued")
      expect(dividend1.reload.paid_at).to be_nil
      expect(dividend2.reload.status).to eq("Issued")
      expect(dividend2.reload.paid_at).to be_nil
    end

    it "sends a failure notification email" do
      expect do
        described_class.new(dividend_payment, refunded_payload).process
      end.to have_enqueued_mail(CompanyInvestorMailer, :dividend_payment_failed).with(user, dividend_payment)
    end

    it "marks the dividend payment as failed" do
      described_class.new(dividend_payment, refunded_payload).process
      expect(dividend_payment.reload.status).to eq(Payment::FAILED)
    end
  end
end
