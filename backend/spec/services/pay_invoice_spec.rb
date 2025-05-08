# frozen_string_literal: true

RSpec.describe PayInvoice, :vcr do
  let(:company) { create(:company) }
  let(:user) { create(:company_worker, company:, user: create(:user, without_bank_account: true)).user }
  let(:recipient_params) do
    {
      currency: "GBP",
      type: "sort_code",
      details: {
        legalType: "PRIVATE",
        email: "someone@somewhere.com",
        accountHolderName: "someone somewhere",
        sortCode: 231470,
        accountNumber: 28821822,
        address: {
          country: "GB",
          city: "London",
          firstLine: "112 2nd street",
          postCode: "SW1P 3",
        },
      },
    }
  end
  let(:invoice) do
    create(:invoice_with_equity, :fully_approved, user:, company:, total_amount_in_usd_cents: 120_00,
                                                  equity_split: 50, equity_amount_in_options: 123)
  end
  let!(:paid_consolidated_invoice) do
    create(:consolidated_invoice, :paid, invoices: [invoice])
  end

  def setup_flexile_insufficient_balance
    insufficient_balance_usd = (sufficient_balance - 1) / 100.0
    allow_any_instance_of(Wise::PayoutApi).to receive(:get_balances) do
      [{
        "id" => 97348,
        "currency" => "USD",
        "amount" => { "value" => insufficient_balance_usd, "currency" => "AUD" },
        "reservedAmount" => { "value" => 0.0, "currency" => "AUD" },
        "cashAmount" => { "value" => insufficient_balance_usd, "currency" => "AUD" },
        "totalWorth" => { "value" => insufficient_balance_usd, "currency" => "AUD" },
        "type" => "STANDARD",
        "name" => nil,
        "icon" => nil,
        "investmentState" => "NOT_INVESTED",
        "creationTime" => "2022-02-02T12:57:43.512910Z",
        "modificationTime" => "2022-02-02T12:57:43.542188Z",
        "visible" => true,
      }]
    end
  end

  it "fails initialization if the invoice is not found" do
    expect do
      described_class.new("abc")
    end.to raise_error(ActiveRecord::RecordNotFound)
  end

  context "when payment method setup is incomplete for the company" do
    before { allow_any_instance_of(Company).to receive(:bank_account_ready?).and_return(false) }

    it "raises an error" do
      expect do
        described_class.new(invoice.id).process
      end.to raise_error("Payout method not set up for company #{company.id}")
    end
  end

  context "when payment method is setup", :vcr do
    let(:sufficient_balance) { invoice.cash_amount_in_cents }

    before do
      allow_any_instance_of(Company).to receive(:bank_account_ready?).and_return(true)
      recipient_id = Wise::PayoutApi.new(wise_credential: create(:wise_credential)).create_recipient_account(recipient_params)["id"]
      create(:wise_recipient, user:, currency: "GBP", recipient_id:)
      company.balance.update!(amount_cents: sufficient_balance)
    end

    it "pays for an invoice as expected and records a balance transaction" do
      expect do
        described_class.new(invoice.id).process
      end.to change { invoice.payments.count }.by(1)
         .and change { PaymentBalanceTransaction.count }.by(1)

      payment = Payment.last
      expect(payment.processor_uuid).to be_present
      expect(payment.wise_quote_id).to be_present
      expect(payment.wise_transfer_id).to be_present
      expect(payment.wise_transfer_currency).to be_present
      expect(payment.transfer_fee_in_cents).to be_present
      expect(payment.recipient_last4).to be_present
      expect(payment.conversion_rate).to be_present
      expect(payment.wise_recipient).to eq invoice.user.bank_account
      expect(payment.wise_credential).to eq WiseCredential.flexile_credential
      expect(invoice.reload.status).to eq(Invoice::PROCESSING)
      balance_transaction = payment.balance_transactions.last
      expect(balance_transaction.company).to eq company
      expect(balance_transaction.amount_cents).to eq 60_00
    end

    it "does not attempt to pay for an invoice if there is an insufficient balance in Flexile's account" do
      setup_flexile_insufficient_balance

      expect do
        described_class.new(invoice.id).process
      end.to raise_error(StandardError, "Not enough account balance to pay out for company #{company.id}")
    end

    it "does not attempt to pay for an invoice if the company has an insufficient virtual balance" do
      company.balance.update!(amount_cents: sufficient_balance - 1)
      expect do
        described_class.new(invoice.id).process
      end.to raise_error(StandardError, "Not enough account balance to pay out for company #{company.id}")
    end

    it "does not attempt to pay for an invoice if the invoice is not immediately payable" do
      paid_consolidated_invoice.update!(status: ConsolidatedInvoice::REFUNDED)
      expect do
        described_class.new(invoice.id).process
      end.to raise_error(StandardError, "Invoice not immediately payable for company #{company.id}")
    end

    it "pays an invoice with no cash amount if the invoice has an equity amount", :freeze_time do
      invoice.update!(cash_amount_in_cents: 0, equity_amount_in_cents: 120_00)
      expect_any_instance_of(Invoice).to receive(:mark_as_paid!).with(timestamp: Time.current).and_call_original
      described_class.new(invoice.id).process
    end

    context "for a trusted company" do
      before do
        company.update!(is_trusted: true)
        company.balance.update!(amount_cents: sufficient_balance - 1)
      end

      it "includes the wise_transfer_reference when creating a transfer" do
        expect_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do |_, args|
          expect(args[:reference]).to eq("PMT")
          { "id" => "12345", "sourceValue" => 10 }
        end

        # An error at the funding stage is expected as we're stubbing the response of the transfer creation
        expect do
          described_class.new(invoice.id).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for payment #{Payment.last.id}" }

        payment = Payment.last
        expect(payment.wise_transfer_id).to eq("12345")
      end

      it "pays for an invoice even if the company has an insufficient virtual balance" do
        expect do
          described_class.new(invoice.id).process
        end.to change { invoice.payments.count }.by(1)
           .and change { PaymentBalanceTransaction.count }.by(1)

        payment = Payment.last
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.wise_transfer_id).to be_present
        expect(payment.wise_transfer_currency).to be_present
        expect(payment.transfer_fee_in_cents).to be_present
        expect(payment.recipient_last4).to be_present
        expect(payment.conversion_rate).to be_present
        expect(payment.wise_recipient).to eq invoice.user.bank_account
        expect(payment.wise_credential).to eq WiseCredential.flexile_credential
        expect(invoice.reload.status).to eq(Invoice::PROCESSING)
        balance_transaction = payment.balance_transactions.last
        expect(balance_transaction.company).to eq company
        expect(balance_transaction.amount_cents).to eq 60_00
      end

      it "does not pay for an invoice if there is an insufficient balance in Flexile's account" do
        setup_flexile_insufficient_balance

        expect do
          described_class.new(invoice.id).process
        end.to raise_error(StandardError, "Not enough account balance to pay out for company #{company.id}")
      end
    end

    describe "errors" do
      it "marks the invoice and payment as failed if the bank account is no longer active" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:get_recipient_account) do
          { "active" => false }
        end
        allow(Bugsnag).to receive(:notify)
        rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: invoice.user.bank_account.currency).first["rate"]
        invoice_amount = invoice.cash_amount_in_usd * rate
        expect do
          described_class.new(invoice.id).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Bank account is no longer active for payment #{Payment.last.id}" }
          .and change { invoice.payments.count }.by(1)
          .and have_enqueued_mail(CompanyWorkerMailer, :payment_failed_reenter_bank_details).with { |payment_id, amount, currency|
            expect(payment_id).to eq(Payment.last.id)
            expect(amount).to eq(invoice_amount)
            expect(currency).to eq(invoice.user.bank_account.currency)
          }

        payment = Payment.last
        expect(payment.processor_uuid).to be_present
        expect(payment.status).to eq(Payment::FAILED)
        expect(invoice.reload.status).to eq(Invoice::FAILED)
      end

      it "marks the invoice and payment as failed if creating a quote fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_quote) do
          { "error" => "some error" }
        end
        allow(Bugsnag).to receive(:notify)

        expect do
          described_class.new(invoice.id).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating quote failed for payment #{Payment.last.id}" }
          .and change { invoice.payments.count }.by(1)

        payment = Payment.last
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).not_to be_present
        expect(payment.wise_transfer_id).not_to be_present
        expect(payment.status).to eq(Payment::FAILED)
        expect(invoice.reload.status).to eq(Invoice::FAILED)
      end

      it "marks the invoice and payment as failed if creating a transfer fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do
          { "error" => "some error" }
        end
        allow(Bugsnag).to receive(:notify)

        expect do
          described_class.new(invoice.id).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating transfer failed for payment #{Payment.last.id}" }
          .and change { invoice.payments.count }.by(1)

        payment = Payment.last
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.wise_transfer_id).not_to be_present
        expect(payment.status).to eq(Payment::FAILED)
        expect(invoice.reload.status).to eq(Invoice::FAILED)
      end

      it "marks the invoice and payment as failed if funding fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:fund_transfer) do
          {
            "type" => "BALANCE",
            "status" => "REJECTED",
            "errorCode" => "payment.exists",
            "errorMessage" => nil,
            "balanceTransactionId" => nil,
          }
        end
        allow(Bugsnag).to receive(:notify)

        expect do
          described_class.new(invoice.id).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for payment #{Payment.last.id}" }
          .and change { invoice.payments.count }.by(1)

        payment = Payment.last
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.wise_transfer_id).to be_present
        expect(payment.status).to eq(Payment::FAILED)
        expect(invoice.reload.status).to eq(Invoice::FAILED)
      end
    end
  end
end
