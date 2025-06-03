# frozen_string_literal: true

RSpec.describe PayInvestorDividends, :vcr do
  let(:company) { create(:company) }
  let(:user) { create(:user, :without_compliance_info) }
  let!(:user_compliance_info) { create(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED, tax_information_confirmed_at: 1.day.ago) }
  let(:company_investor) { create(:company_investor, user:, company:) }
  let(:dividend1) { create(:dividend, company:, company_investor:, user_compliance_info:) }
  let(:dividend2) { create(:dividend, company:, company_investor:, user_compliance_info:) }
  let(:dividends) { Dividend.where(id: [dividend1.id, dividend2.id]) }

  before do
    allow(Wise::AccountBalance).to receive(:has_sufficient_flexile_balance?).and_return(true)
  end

  it "fails initialization if the dividends are absent" do
    expect do
      described_class.new(company_investor, Dividend.none)
    end.to raise_error(ActiveRecord::RecordNotFound)
  end

  it "fails initialization if the dividends do not belong to the same company investor" do
    dividend1.update!(company_investor: create(:company_investor))

    expect do
      described_class.new(company_investor, dividends)
    end.to raise_error("Dividends must belong to the same company investor")
  end

  it "returns early if any dividend is not in the 'Issued' or 'Retained' state" do
    dividend1.update!(status: Dividend::PAID)

    expect do
      described_class.new(company_investor, dividends).process
    end.to change(DividendPayment, :count).by(0)
  end

  context "if the company investor has not completed onboarding" do
    let(:company_investor) { create(:company_investor, user: create(:user, legal_name: nil), company:) }
    let(:user_compliance_info) { nil }

    it "returns early" do
      expect do
        described_class.new(company_investor, dividends).process
      end.to change(DividendPayment, :count).by(0)
    end
  end

  it "returns early if the company investor has not confirmed their tax information" do
    user.compliance_info.update!(tax_information_confirmed_at: nil)

    expect do
      described_class.new(company_investor, dividends).process
    end.to change(DividendPayment, :count).by(0)
  end

  it "returns early if the company investor is a US resident with an invalid tax ID" do
    user.update!(country_code: "US")
    user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID)

    expect do
      described_class.new(company_investor, dividends).process
    end.to change(DividendPayment, :count).by(0)
  end

  it "returns early if the company investor is a US resident with a missing tax ID status" do
    user.update!(country_code: "US")
    user.compliance_info.update!(tax_id_status: nil)

    expect do
      described_class.new(company_investor, dividends).process
    end.to change(DividendPayment, :count).by(0)
  end



  it "raises an exception if Flexile does not have sufficient balance to pay for the dividend" do
    allow(Wise::AccountBalance).to receive(:has_sufficient_flexile_balance?).and_return(false)

    expect do
      described_class.new(company_investor, dividends).process
    end.to raise_error("Flexile balance insufficient to pay for dividends to investor #{company_investor.id}")
  end

  it "raises an exception if the country of the investor is missing" do
    user.update!(country_code: nil)

    expect do
      described_class.new(company_investor, dividends).process
    end.to raise_error("Unknown country for user #{user.id}")
  end

  context "when basic pre-checks are successful" do
    it "sets a retained_reason and returns if the country is blocked" do
      company_investor.user.update!(country_code: "BY")

      expect do
        described_class.new(company_investor, dividends).process
      end.to change(DividendPayment, :count).by(0)

      [dividend1, dividend2].each do |dividend|
        expect(dividend.reload.retained_reason).to eq("ofac_sanctioned_country")
        expect(dividend.status).to eq(Dividend::RETAINED)
        expect(dividend.user_compliance_info).to eq(user_compliance_info)
      end
    end

    it "sets a retained_reason and returns if the dividend net amount is lesser than the users' payment threshold" do
      dividend1.update!(total_amount_in_cents: 50_00, net_amount_in_cents: 37_50,
                        withheld_tax_cents: 12_50, withholding_percentage: 25)
      dividend2.update!(total_amount_in_cents: 50_00, net_amount_in_cents: 37_50,
                        withheld_tax_cents: 12_50, withholding_percentage: 25)
      # Total net = $75

      user.update!(country_code: "IN", minimum_dividend_payment_in_cents: 76_00)

      expect do
        described_class.new(company_investor, dividends).process
      end.to change(DividendPayment, :count).by(0)

      [dividend1, dividend2].each do |dividend|
        expect(dividend.reload.retained_reason).to eq("below_minimum_payment_threshold")
        expect(dividend.status).to eq(Dividend::RETAINED)
        expect(dividend.user_compliance_info).to eq(user_compliance_info)
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
      # Mark the existing bank account ineligible for dividends so we test that the right one is used
      user.bank_accounts.sole.update!(used_for_dividends: false, recipient_id: "N/A")
      create(:wise_recipient, user:, currency: "USD", recipient_id:, used_for_dividends: true)
    end

    describe "error scenarios" do
      it "marks the dividend payment as failed if creating a quote fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_quote) do
          { "error" => "some error" }
        end

        expect do
          described_class.new(company_investor, dividends).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating quote failed for dividend payment #{DividendPayment.last.id}" }
          .and change { DividendPayment.count }.by(1)

        payment = DividendPayment.last
        expect(payment.dividend_ids).to match_array([dividend1.id, dividend2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).not_to be_present
        expect(payment.total_transaction_cents).not_to be_present
        expect(payment.transfer_fee_in_cents).not_to be_present
        expect(payment.transfer_id).not_to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(DividendPayment::FAILED)
      end

      it "marks the dividend payment as failed if creating a transfer fails" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do
          { "error" => "some error" }
        end

        expect do
          described_class.new(company_investor, dividends).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Creating transfer failed for dividend payment #{DividendPayment.last.id}" }
          .and change { DividendPayment.count }.by(1)

        payment = DividendPayment.last
        expect(payment.dividend_ids).to match_array([dividend1.id, dividend2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.total_transaction_cents).to be_present
        expect(payment.transfer_fee_in_cents).to be_present
        expect(payment.transfer_id).not_to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(DividendPayment::FAILED)
      end

      it "marks the dividend payment as failed if funding fails" do
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
          described_class.new(company_investor, dividends).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for dividend payment #{DividendPayment.last.id}" }
          .and change { DividendPayment.count }.by(1)

        payment = DividendPayment.last
        expect(payment.dividend_ids).to match_array([dividend1.id, dividend2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.total_transaction_cents).to be_present
        expect(payment.transfer_fee_in_cents).to be_present
        expect(payment.transfer_id).to be_present
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.status).to eq(DividendPayment::FAILED)
      end

      it "marks the bank account as deleted and notifies the user if the bank account is inactive" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:get_recipient_account) do
          { "active" => false }
        end

        rate = Wise::PayoutApi.new.get_exchange_rate(target_currency: company_investor.user.bank_account_for_dividends.currency).first["rate"]
        net_amount_in_cents = dividends.sum(:net_amount_in_cents)

        expect do
          described_class.new(company_investor, dividends).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Bank account is no longer active for dividend payment #{DividendPayment.last.id}" }
          .and change { user.bank_accounts.alive.count }.by(-1)
          .and change { DividendPayment.count }.by(1)
          .and have_enqueued_mail(CompanyInvestorMailer, :dividend_payment_failed_reenter_bank_details).with { |kwargs|
                 expect(kwargs[:dividend_payment_id]).to eq(DividendPayment.last.id)
                 expect(kwargs[:amount]).to eq((net_amount_in_cents / 100.0) * rate)
                 expect(kwargs[:currency]).to eq(user.bank_account_for_dividends.currency)
                 expect(kwargs[:net_amount_in_usd_cents]).to eq(net_amount_in_cents)
               }

        dividend_payment = DividendPayment.last
        expect(dividend_payment.processor_uuid).to be_present
        expect(dividend_payment.status).to eq(DividendPayment::FAILED)
      end
    end

    describe "success scenarios" do
      before do
        dividends.each do |dividend|
          dividend.update!(total_amount_in_cents: 123_78,
                           net_amount_in_cents: 104_78,
                           withheld_tax_cents: 19_00,
                           withholding_percentage: 15)
          dividend.mark_retained!("below_minimum_payment_threshold")
        end
        user.update!(country_code: "GB")
      end

      it "includes the wise_transfer_reference when creating a transfer" do
        allow_any_instance_of(Wise::PayoutApi).to receive(:create_transfer) do |_, args|
          expect(args[:reference]).to eq("DIV")
          { "id" => "12345" }
        end

        # An error at the funding stage is expected as we're stubbing the response of the transfer creation
        expect do
          described_class.new(company_investor, dividends).process
        end.to raise_error(described_class::WiseError) { |error| expect(error.message).to eq "Funding transfer failed for dividend payment #{DividendPayment.last.id}" }
          .and change { DividendPayment.count }.by(1)

        payment = DividendPayment.last
        expect(payment.transfer_id).to eq("12345")
      end

      it "creates a dividend payment and clears the retained reason" do
        expect do
          described_class.new(company_investor, dividends).process
        end.to change { DividendPayment.count }.by(1)

        payment = DividendPayment.last
        expect(payment.dividend_ids).to match_array([dividend1.id, dividend2.id])
        expect(payment.processor_uuid).to be_present
        expect(payment.wise_quote_id).to be_present
        expect(payment.transfer_fee_in_cents > 0).to eq(true)
        expect(payment.total_transaction_cents).to eq(payment.transfer_fee_in_cents + 104_78 + 104_78) # Fee + net
        expect(payment.transfer_id).to be_present
        expect(payment.transfer_currency).to eq("USD")
        expect(payment.recipient_last4).to eq("1234")
        expect(payment.wise_recipient).to eq(user.bank_account_for_dividends)
        expect(payment.wise_credential).to eq(WiseCredential.flexile_credential)
        expect(payment.processor_name).to eq(DividendPayment::PROCESSOR_WISE)
        dividends.each do |dividend|
          expect(dividend.reload.status).to eq(Dividend::PROCESSING)
          expect(dividend.retained_reason).to eq(nil)
          expect(dividend.user_compliance_info).to eq(user_compliance_info)
        end
      end
    end
  end
end
