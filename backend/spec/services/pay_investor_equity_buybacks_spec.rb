# frozen_string_literal: true

RSpec.describe PayInvestorEquityBuybacks, :vcr do
  let(:company) do
    create(:company, tender_offers_enabled: true)
  end
  let(:user) { create(:user, :without_compliance_info) }
  let!(:user_compliance_info) { create(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED, tax_information_confirmed_at: 1.day.ago) }
  let(:company_investor) { create(:company_investor, user:, company:) }
  let(:equity_buyback1) { create(:equity_buyback, company:, company_investor:) }
  let(:equity_buyback2) { create(:equity_buyback, company:, company_investor:) }
  let(:equity_buybacks) { EquityBuyback.where(id: [equity_buyback1.id, equity_buyback2.id]) }

  before do
    allow(Wise::AccountBalance).to receive(:has_sufficient_flexile_balance?).and_return(true)
  end

  it "fails initialization if the equity buybacks are absent" do
    expect do
      described_class.new(company_investor, EquityBuyback.none)
    end.to raise_error(ActiveRecord::RecordNotFound)
  end

  it "fails initialization if the equity buybacks do not belong to the same company investor" do
    equity_buyback1.update!(company_investor: create(:company_investor))

    expect do
      described_class.new(company_investor, equity_buybacks)
    end.to raise_error("Equity buybacks must belong to the same company investor")
  end

  it "returns early if any equity buyback is not in the 'Issued' or 'Retained' state" do
    equity_buyback1.update!(status: EquityBuyback::PAID)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to change(EquityBuybackPayment, :count).by(0)
  end

  context "if the company investor has not completed onboarding" do
    let(:company_investor) { create(:company_investor, user: create(:user, :without_compliance_info), company:) }
    let(:user_compliance_info) { nil }

    it "returns early" do
      expect do
        described_class.new(company_investor, equity_buybacks).process
      end.to change(EquityBuybackPayment, :count).by(0)
    end
  end

  it "returns early if the company investor has not confirmed their tax information" do
    user.compliance_info.update!(tax_information_confirmed_at: nil)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to change(EquityBuybackPayment, :count).by(0)
  end

  it "returns early if the company investor is a US resident with an invalid tax ID" do
    user.update!(country_code: "US")
    user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to change(EquityBuybackPayment, :count).by(0)
  end

  it "returns early if the company investor is a US resident with a missing tax ID status" do
    user.update!(country_code: "US")
    user.compliance_info.update!(tax_id_status: nil)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to change(EquityBuybackPayment, :count).by(0)
  end

  it "raises an exception if the company does not have access to the feature" do
    company.update!(tender_offers_enabled: false)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to raise_error("Feature unsupported for company #{company.id}")
  end

  it "raises an exception if Flexile does not have sufficient balance to pay for the equity buyback" do
    allow(Wise::AccountBalance).to receive(:has_sufficient_flexile_balance?).and_return(false)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to raise_error("Flexile balance insufficient to pay for equity buybacks to investor #{company_investor.id}")
  end

  it "raises an exception if the country of the investor is missing" do
    user.update!(country_code: nil)

    expect do
      described_class.new(company_investor, equity_buybacks).process
    end.to raise_error("Unknown country for user #{user.id}")
  end

  context "when basic pre-checks are successful" do
    it "sets a retained_reason and returns if the country is blocked" do
      company_investor.user.update!(country_code: "BY")

      expect do
        described_class.new(company_investor, equity_buybacks).process
      end.to change(EquityBuybackPayment, :count).by(0)

      [equity_buyback1, equity_buyback2].each do |equity_buyback|
        expect(equity_buyback.reload.retained_reason).to eq("ofac_sanctioned_country")
        expect(equity_buyback.status).to eq(EquityBuyback::RETAINED)
      end
    end
  end

  context "when all preliminary checks are successful" do
    let(:recipient_params) do
      {
        currency: "USD",
        type: "aba",
        details: {
          legalType: "PRIVATE",
          abartn: "026009593",
          accountHolderName: "Spec Man",
          accountNumber: "12345678",
          accountType: "CHECKING",
          address: {
            country: "US",
            city: "New York",
            firstLine: "767 5th Avenue",
            state: "NY",
            postCode: "10153",
          },
        },
      }
    end

    before do
      create(:wise_credential)
      recipient_id = Wise::PayoutApi.new.create_recipient_account(recipient_params)["id"]
      # Mark the existing bank account ineligible for equity buybacks so we test that the right one is used
      user.bank_accounts.sole.update!(used_for_dividends: false, recipient_id: "N/A")
      create(:wise_recipient, user:, currency: "USD", recipient_id:, used_for_dividends: true)
    end

    describe "error scenarios" do
      it "marks the equity buyback payment as failed if creating a quote fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_quote) do
          { "error" => "some error" }
        end

        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating quote failed for equity buyback payment #{EquityBuybackPayment.last.id}" }
          .and change { EquityBuybackPayment.count }.by(1)

        payment = EquityBuybackPayment.last
        expect(payment.equity_buyback_ids).to match_array([equity_buyback1.id, equity_buyback2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).not_to be_present
        expect(payment.total_transaction_cents).not_to be_present
        expect(payment.transfer_fee_cents).not_to be_present
        expect(payment.transfer_id).not_to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(EquityBuybackPayment::FAILED)
      end

      it "marks the equity buyback payment as failed if creating a transfer fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do
          { "error" => "some error" }
        end

        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating transfer failed for equity buyback payment #{EquityBuybackPayment.last.id}" }
          .and change { EquityBuybackPayment.count }.by(1)

        payment = EquityBuybackPayment.last
        expect(payment.equity_buyback_ids).to match_array([equity_buyback1.id, equity_buyback2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.total_transaction_cents).to be_present
        expect(payment.transfer_fee_cents).to be_present
        expect(payment.transfer_id).not_to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(EquityBuybackPayment::FAILED)
      end

      it "marks the equity buyback payment as failed if funding fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:fund_transfer) do
          {
            "type" => "BALANCE",
            "status" => "REJECTED",
            "errorCode" => "payment.exists",
            "errorMessage" => nil,
            "balanceTransactionId" => nil,
          }
        end

        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for equity buyback payment #{EquityBuybackPayment.last.id}" }
          .and change { EquityBuybackPayment.count }.by(1)

        payment = EquityBuybackPayment.last
        expect(payment.equity_buyback_ids).to match_array([equity_buyback1.id, equity_buyback2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.total_transaction_cents).to be_present
        expect(payment.transfer_fee_cents).to be_present
        expect(payment.transfer_id).to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(EquityBuybackPayment::FAILED)
      end

      it "marks the bank account as deleted and notifies the user if the bank account is inactive" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:get_recipient_account) do
          { "active" => false }
        end

        rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: company_investor.user.bank_account_for_dividends.currency).first["rate"]
        net_amount_in_cents = equity_buybacks.sum(:total_amount_cents)

        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Bank account is no longer active for equity buyback payment #{EquityBuybackPayment.last.id}" }
          .and change { user.bank_accounts.alive.count }.by(-1)
          .and change { EquityBuybackPayment.count }.by(1)
          .and have_enqueued_mail(CompanyInvestorMailer, :equity_buyback_payment_failed_reenter_bank_details).with { |kwargs|
            expect(kwargs[:equity_buyback_payment_id]).to eq(EquityBuybackPayment.last.id)
            expect(kwargs[:amount]).to eq((net_amount_in_cents / 100.0) * rate)
            expect(kwargs[:currency]).to eq(user.bank_account_for_dividends.currency)
            expect(kwargs[:net_amount_in_usd_cents]).to eq(net_amount_in_cents)
          }

        equity_buyback_payment = EquityBuybackPayment.last
        expect(equity_buyback_payment.processor_uuid).to be_present
        expect(equity_buyback_payment.status).to eq(EquityBuybackPayment::FAILED)
      end
    end

    describe "success scenarios" do
      before do
        equity_buybacks.each do |equity_buyback|
          equity_buyback.update!(total_amount_cents: 123_78)
          equity_buyback.mark_retained!("ofac_sanctioned_country")
        end
        user.update!(country_code: "GB")
      end

      it "includes the wise_transfer_reference when creating a transfer" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do |_, args|
          expect(args[:reference]).to eq("EB")
          { "id" => "12345" }
        end

        # An error at the funding stage is expected as we're stubbing the response of the transfer creation
        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for equity buyback payment #{EquityBuybackPayment.last.id}" }
           .and change { EquityBuybackPayment.count }.by(1)

        payment = EquityBuybackPayment.last
        expect(payment.transfer_id).to eq("12345")
      end

      it "creates an equity buyback payment and clears the retained reason" do
        expect do
          described_class.new(company_investor, equity_buybacks).process
        end.to change { EquityBuybackPayment.count }.by(1)

        payment = EquityBuybackPayment.last
        expect(payment.equity_buyback_ids).to match_array([equity_buyback1.id, equity_buyback2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.transfer_fee_cents > 0).to eq(true)
        expect(payment.total_transaction_cents).to eq(payment.transfer_fee_cents + 123_78 + 123_78) # Fee + net
        expect(payment.transfer_id).to be_present
        expect(payment.transfer_currency).to eq("USD")
        expect(payment.recipient_last4).to eq("1234")
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.processor_name).to eq(EquityBuybackPayment::PROCESSOR_WISE)
        equity_buybacks.each do |equity_buyback|
          expect(equity_buyback.reload.status).to eq(EquityBuyback::PROCESSING)
          expect(equity_buyback.retained_reason).to eq(nil)
        end
      end
    end
  end
end
