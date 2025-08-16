# frozen_string_literal: true

RSpec.describe CompanyStripeAccount do
  # Using StripeMockHelpers instead of StripeHelpers for mocking
  # StripeMockHelpers provides deterministic test data without requiring real API calls
  include StripeMockHelpers

  describe "associations" do
    it { is_expected.to belong_to(:company) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:status) }
    it { is_expected.to validate_inclusion_of(:status).in_array(CompanyStripeAccount::STATUSES) }
    it { is_expected.to validate_presence_of(:setup_intent_id) }
  end

  describe "callbacks" do
    describe "#delete_older_records!" do
      it "deletes all older company stripe accounts for that cmopany", :freeze_time do
        company = create(:company)
        stripe_account = create(:company_stripe_account, company:)
        deleted_stripe_account = create(:company_stripe_account, company:, deleted_at: 1.week.ago)
        other_stripe_account = create(:company_stripe_account)

        expect do
          create(:company_stripe_account, company:)
        end.to change { stripe_account.reload.deleted_at }.from(nil).to(Time.current)
           .and not_change { deleted_stripe_account.reload.deleted_at }
           .and not_change { other_stripe_account.reload.deleted_at }
      end
    end
  end

  describe "#initial_setup_completed?" do
    it "returns false if status is present and 'initial', true otherwise" do
      expect(build(:company_stripe_account, status: nil).initial_setup_completed?).to eq(false)
      expect(build(:company_stripe_account, status: CompanyStripeAccount::INITIAL).initial_setup_completed?).to eq(false)

      (CompanyStripeAccount::STATUSES - [CompanyStripeAccount::INITIAL]).each do |status|
        expect(build(:company_stripe_account, status:).initial_setup_completed?).to eq(true)
      end
    end
  end

  describe "#ready?" do
    it "returns true if status is 'ready', false otherwise" do
      expect(build(:company_stripe_account, status: nil).ready?).to eq(false)
      expect(build(:company_stripe_account, status: "initial").ready?).to eq(false)
      expect(build(:company_stripe_account, status: "ready").ready?).to eq(true)
    end
  end

  describe "#stripe_setup_intent" do
    let(:company_stripe_account) { create(:company_stripe_account) }

    it "caches the setup intent" do
      allow(Stripe::SetupIntent).to receive(:retrieve).and_return(Stripe::SetupIntent.new(company_stripe_account.setup_intent_id))

      2.times { company_stripe_account.stripe_setup_intent }

      expect(Stripe::SetupIntent).to have_received(:retrieve).once
    end
  end

  # Removed :vcr tag and updated to use StripeMockHelpers instead of real API calls
  describe "#fetch_stripe_bank_account_last_four" do
    let(:company_stripe_account) { create(:company_stripe_account, setup_intent_id: "seti_mock_succeeded") }

    context "when the company stripe account has a setup intent with a payment method" do
      before do
        # Use our mock helper to create a setup intent with a payment method
        setup_intent = create_mock_setup_intent(status: "succeeded")
        allow(Stripe::SetupIntent).to receive(:retrieve).and_return(setup_intent)
      end

      it "fetches the last four digits of the bank account from Stripe" do
        # The mock data in StripeMockHelpers has "6789" as the last4 for us_bank_account
        expect(company_stripe_account.fetch_stripe_bank_account_last_four).to eq "6789"
      end
    end

    context "when the company stripe account has a setup intent with no payment method attached" do
      it "returns nil when there is no payment method associated with the setup intent" do
        allow(Stripe::SetupIntent).to receive(:retrieve).with({
          id: company_stripe_account.setup_intent_id,
          expand: ["payment_method"],
        }).and_return(Stripe::SetupIntent.construct_from({
          id: company_stripe_account.setup_intent_id,
          payment_method: nil,
        }))

        expect(company_stripe_account.fetch_stripe_bank_account_last_four).to eq nil
      end
    end
  end

  describe "#microdeposit_verification_required?" do
    let(:status) { CompanyStripeAccount::PROCESSING }
    let(:company_stripe_account) { create(:company_stripe_account, status:) }

    before do
      allow(company_stripe_account).to receive(:stripe_setup_intent).and_return(setup_intent)
    end

    context "when bank account setup was successful" do
      let(:status) { CompanyStripeAccount::READY }
      let(:setup_intent) do
        Stripe::SetupIntent.construct_from({
          id: company_stripe_account.setup_intent_id,
          status: "requires_action",
          next_action: {
            type: "verify_with_microdeposits",
            verify_with_microdeposits: { microdeposit_type: "descriptor_code" },
          },
        })
      end

      it "returns false" do
        expect(company_stripe_account.microdeposit_verification_required?).to eq false
        expect(company_stripe_account).not_to have_received(:stripe_setup_intent)
      end
    end

    context "when Stripe setup intent requires microdeposit verification via descriptor code" do
      let(:setup_intent) do
        Stripe::SetupIntent.construct_from({
          id: company_stripe_account.setup_intent_id,
          status: "requires_action",
          next_action: {
            type: "verify_with_microdeposits",
            verify_with_microdeposits: { microdeposit_type: "descriptor_code" },
          },
        })
      end

      it "returns true" do
        expect(company_stripe_account.microdeposit_verification_required?).to eq true
      end
    end

    context "when Stripe setup intent requires microdeposit verification via amounts" do
      let(:setup_intent) do
        Stripe::SetupIntent.construct_from({
          id: company_stripe_account.setup_intent_id,
          status: "requires_action",
          next_action: {
            type: "verify_with_microdeposits",
            verify_with_microdeposits: { microdeposit_type: "amount" },
          },
        })
      end

      it "returns true" do
        expect(company_stripe_account.microdeposit_verification_required?).to eq true
      end
    end

    context "when Stripe setup intent does not require microdeposit verification" do
      let(:setup_intent) do
        Stripe::SetupIntent.construct_from({
          id: company_stripe_account.setup_intent_id,
          status: "requires_payment_method", # typical status
          next_action: nil,
        })
      end

      it "returns false" do
        expect(company_stripe_account.microdeposit_verification_required?).to eq false
      end
    end
  end

  # Removed :vcr tag and updated to use StripeMockHelpers instead of real API calls
  describe "#microdeposit_verification_details" do
    let(:company_stripe_account) { create(:company_stripe_account, :action_required, bank_account_last_four: "1234") }

    context "when microdeposit verification is required" do
      before do
        # Use our mock helper to set up a company with a setup intent requiring microdeposits
        # The setup_company_on_stripe helper now uses our StripeMockHelpers
        setup_company_on_stripe(company_stripe_account.company.reload, verify_with_microdeposits: true)
      end

      it "returns the arrival timestamp, microdeposit type, and bank account number" do
        # The mock data in StripeMockHelpers has a dynamic arrival_date (Time.now + 2.days)
        # and "descriptor_code" as the microdeposit_type
        verification_details = company_stripe_account.reload.microdeposit_verification_details

        expect(verification_details[:microdeposit_type]).to eq("descriptor_code")
        expect(verification_details[:bank_account_number]).to eq("****1234")
        expect(verification_details[:arrival_timestamp]).to be_present

        # The timestamp should be approximately 2 days from now (within 5 seconds)
        expected_timestamp = Time.now.to_i + 2.days.to_i
        expect(verification_details[:arrival_timestamp]).to be_within(5).of(expected_timestamp)
      end
    end

    context "when microdeposit verification is not required" do
      it "returns nil" do
        expect(company_stripe_account.microdeposit_verification_details).to eq nil
      end
    end
  end
end
