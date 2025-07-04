# frozen_string_literal: true

RSpec.describe ChargeConsolidatedInvoice do
  let(:company) { create(:company, :completed_onboarding) }
  let(:consolidated_invoice) { create(:consolidated_invoice, company:) }

  it "raises an error if the company doesn't have a bank account ready" do
    allow_any_instance_of(Company).to receive(:bank_account_ready?).and_return(false)
    expect do
      described_class.new(consolidated_invoice.id).process
    end.to raise_error(/Company does not have a bank account set up/)
       .and change(ConsolidatedPayment, :count).by(0)
  end

  it "raises an error and marks the consolidated invoice failed if creating a Stripe payment intent does not succeed", :vcr do
    consolidated_invoice = create(:consolidated_invoice, company:, total_cents: 3_000_000_00) # too large amount
    expect do
      described_class.new(consolidated_invoice.id).process
    end.to raise_error(Stripe::InvalidRequestError)
       .and change(ConsolidatedPayment, :count).by(0)
       .and change { consolidated_invoice.reload.status }.from(ConsolidatedInvoice::SENT).to(Invoice::FAILED)
  end

  it "charges the customer and makes a record of it in the DB", :vcr do
    stripe_setup_intent = company.bank_account.stripe_setup_intent

    expect_any_instance_of(ConsolidatedInvoice).not_to receive(:trigger_payments)
    expect(Stripe::PaymentIntent).to receive(:create).with({
      payment_method_types: ["us_bank_account"],
      payment_method: stripe_setup_intent.payment_method,
      customer: stripe_setup_intent.customer,
      confirm: true,
      amount: consolidated_invoice.total_cents,
      expand: ["latest_charge"],
      currency: "USD",
      capture_method: "automatic",
    }).and_call_original

    expect do
      described_class.new(consolidated_invoice.id).process
    end.to change(ConsolidatedPayment, :count).by(1)
       .and change(BalanceTransaction, :count).by(1)

    consolidated_payment = ConsolidatedPayment.last
    expect(consolidated_payment.consolidated_invoice).to eq(consolidated_invoice)
    expect(consolidated_payment.stripe_payment_intent_id).to be_present
    expect(consolidated_payment.stripe_transaction_id).to be_present

    balance_transaction = consolidated_payment.balance_transactions.last
    expect(balance_transaction.company).to eq(company)
    expect(balance_transaction.amount_cents).to eq(consolidated_invoice.total_cents)
  end

  context "for a trusted company" do
    it "pays out invoices immediately", :vcr do
      company.update!(is_trusted: true)
      expect_any_instance_of(ConsolidatedInvoice).to receive(:trigger_payments).and_call_original
      described_class.new(consolidated_invoice.id).process
    end
  end
end
