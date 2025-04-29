# frozen_string_literal: true

RSpec.describe Company do
  include WiseHelpers

  describe "associations" do
    it { is_expected.to have_many(:company_administrators) }
    it { is_expected.to have_one(:primary_admin).class_name("CompanyAdministrator") }
    it { is_expected.to have_many(:administrators).through(:company_administrators).source(:user) }
    it { is_expected.to have_many(:company_lawyers) }
    it { is_expected.to have_many(:lawyers).through(:company_lawyers).source(:user) }
    it { is_expected.to have_many(:cap_table_uploads) }
    it { is_expected.to have_many(:contracts) }
    it { is_expected.to have_many(:company_workers) }
    it { is_expected.to have_many(:company_investor_entities) }
    it { is_expected.to have_many(:investors).through(:company_investors).source(:user) }
    it { is_expected.to have_many(:company_roles).conditions(deleted_at: nil) }
    it { is_expected.to have_many(:convertible_investments) }
    it { is_expected.to have_many(:consolidated_invoices) }
    it { is_expected.to have_many(:contractors).through(:company_workers).source(:user) }
    it { is_expected.to have_many(:company_monthly_financial_reports) }
    it { is_expected.to have_many(:company_investors) }
    it { is_expected.to have_many(:company_updates) }
    it { is_expected.to have_many(:documents) }
    it { is_expected.to have_many(:dividends) }
    it { is_expected.to have_many(:dividend_computations) }
    it { is_expected.to have_many(:dividend_rounds) }
    it { is_expected.to have_many(:equity_buybacks) }
    it { is_expected.to have_many(:equity_buyback_rounds) }
    it { is_expected.to have_many(:equity_grants).through(:company_investors) }
    it { is_expected.to have_many(:equity_grant_exercises) }
    it { is_expected.to have_many(:time_entries) }
    it { is_expected.to have_many(:invoices) }
    it { is_expected.to have_many(:expense_categories) }
    it { is_expected.to have_many(:consolidated_payment_balance_transactions) }
    it { is_expected.to have_many(:balance_transactions) }
    it { is_expected.to have_one(:balance) }
    it { is_expected.to have_one(:equity_exercise_bank_account) }
    it { is_expected.to have_many(:share_classes) }
    it { is_expected.to have_many(:share_holdings).through(:company_investors) }
    it { is_expected.to have_many(:option_pools) }
    it { is_expected.to have_many(:tax_documents) }
    it { is_expected.to have_many(:expense_card_charges) }
    it { is_expected.to have_many(:tender_offers) }
    it { is_expected.to have_many(:company_worker_updates).through(:company_workers) }
    it { is_expected.to have_one(:quickbooks_integration).conditions(deleted_at: nil) }
    it { is_expected.to have_one(:github_integration).conditions(deleted_at: nil) }
    it { is_expected.to have_many(:company_worker_absences).through(:company_workers) }
    it { is_expected.to have_one_attached(:logo) }
    it { is_expected.to have_one_attached(:full_logo) }
    it { is_expected.to have_many(:company_stripe_accounts) }

    describe "#bank_account" do
      it "returns the most recent, live company Stripe account record" do
        company = create(:company)
        oldest = create(:company_stripe_account, company:, created_at: 1.month.ago)
        newest = create(:company_stripe_account, company:, created_at: 1.day.ago)
        create(:company_stripe_account, company:, created_at: 1.hour.ago, deleted_at: Time.current)
        oldest.reload.mark_undeleted! # roll back record deletion callback
        newest.reload

        expect(company.reload.bank_account).to eq newest
      end
    end
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_presence_of(:country_code) }
    it { is_expected.to validate_presence_of(:required_invoice_approval_count) }
    it { is_expected.to validate_numericality_of(:required_invoice_approval_count).is_greater_than(0).only_integer }
    it { is_expected.to validate_presence_of(:valuation_in_dollars) }
    it { is_expected.to validate_numericality_of(:valuation_in_dollars).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to validate_numericality_of(:fully_diluted_shares).is_greater_than_or_equal_to(0).only_integer }
    it { is_expected.to(validate_numericality_of(:share_price_in_usd).is_greater_than_or_equal_to(0).allow_nil) }
    it { is_expected.to(validate_numericality_of(:fmv_per_share_in_usd).is_greater_than_or_equal_to(0).allow_nil) }
    it { is_expected.to validate_inclusion_of(:registration_state).in_array(described_class::US_STATE_CODES).allow_nil }

    it "validates brand_color with hex_color" do
      company = build(:company)
      expect(company).to be_valid
      company.brand_color = "heheheh"
      expect(company).to_not be_valid
      # This is tested in more detail in HexColorValidator's specs
    end

    describe "on update" do
      let(:company) { create(:company) }

      it "validates presence of address properties if they have changed" do
        company.assign_attributes(name: nil, street_address: nil, city: nil, state: nil, zip_code: nil)

        expect(company).not_to be_valid
        expect(company.errors.full_messages).to match_array [
          "Name can't be blank",
          "Street address can't be blank",
          "State is not included in the list",
          "City can't be blank",
          "State can't be blank",
          "Zip code can't be blank",
          "Zip code is invalid",
        ]
      end

      it "validates length of phone number if it has changed" do
        company.assign_attributes(phone_number: "555")
        expect(company).not_to be_valid
        expect(company.errors.full_messages).to match_array ["Phone number is the wrong length (should be 10 characters)"]
        company.assign_attributes(phone_number: "5555555555")
        expect(company).to be_valid
      end

      it "allows only correctly formatted zip codes" do
        ["12345", "12345-6789", "12345 6789", "123456789"].each do |zip_code|
          company.update(zip_code:)
          expect(company).to be_valid
        end

        ["1234", "1234-56789", "1234506789", "12345678", "zero12345"].each do |zip_code|
          company.update(zip_code:)
          expect(company).not_to be_valid
          expect(company.errors.full_messages).to eq(["Zip code is invalid"])
        end
      end

      it "does not validate presence of address properties if they have not changed" do
        company = create(:company, :pre_onboarding)
        expect(company).to be_valid
      end

      it "allows only US states" do
        company.update(state: "DU")
        expect(company).not_to be_valid
        expect(company.errors.full_messages).to eq(["State is not included in the list"])

        company.update(state: described_class::US_STATE_CODES.sample)
        expect(company).to be_valid
      end
    end
  end

  describe "normalizations" do
    context "with valid formats" do
      let(:company) { build(:company, phone_number: "555-123-4567", tax_id: "12-3456789") }

      it "removes non-digit characters from tax_id" do
        expect(company.tax_id).to eq("123456789")
      end

      it "removes non-digit characters from phone_number" do
        expect(company.phone_number).to eq("5551234567")
      end
    end

    context "when attributes are missing" do
      let(:company) { build(:company, phone_number: nil, tax_id: nil) }

      it "handles missing phone_number" do
        expect(company.phone_number).to be_nil
      end

      it "handles missing tax_id" do
        expect(company.tax_id).to be_nil
      end
    end

    context "when inputting invalid values" do
      let(:company) { build(:company, phone_number: "not a number", tax_id: "invalid") }

      it "removes non-digit characters from an invalid phone_number" do
        expect(company.phone_number).to eq("")
      end

      it "removes non-digit characters from an invalid tax_id" do
        expect(company.tax_id).to eq("")
      end
    end

    context "with different formats" do
      let(:company) { build(:company, phone_number: "(555) 123-4567", tax_id: " 12 3456789 ") }

      it "normalizes phone_number with parentheses and spaces" do
        expect(company.phone_number).to eq("5551234567")
      end

      it "normalizes tax_id with spaces" do
        expect(company.tax_id).to eq("123456789")
      end
    end
  end

  describe "scopes" do
    describe ".active" do
      it "returns the list of active companies" do
        active = create_list(:company, 2)
        create(:company, deactivated_at: 1.minute.ago)

        expect(Company.active).to match_array active
      end
    end

    describe ".contractors.active" do
      let(:contractor) { create(:company_worker) }
      let(:company) do
        company = contractor.company
        create(:company_worker, ended_at: Time.current, company:)
        company
      end

      it "returns the list of active contractors" do
        expect(company.contractors.active).to eq [contractor.user]
      end
    end
  end

  it { is_expected.to accept_nested_attributes_for(:expense_categories) }

  describe "lifecycle hooks" do
    it "creates a balance record on creation" do
      expect do
        create(:company)
      end.to change { Balance.count }.by(1)
    end

    describe "#update_convertible_implied_shares" do
      let(:company) { create(:company) }
      let(:investment1) do create(:convertible_investment, company_valuation_in_dollars: 10_000_000,
                                                           amount_in_cents: 567_873_34, company:) end
      let(:investment2) do create(:convertible_investment, company_valuation_in_dollars: 20_000_000,
                                                           amount_in_cents: 234_345_12, company:) end

      it "updates the implied shares for the convertible securities" do
        conversion_price = (10_000_000.to_d / 9_765_432).round(4)
        expected_implied_shares1 = (567_873.34.to_d / conversion_price).floor

        conversion_price = (20_000_000.to_d / 9_765_432).round(4)
        expected_implied_shares2 = (234_345.12.to_d / conversion_price).floor

        expect do
          company.update(fully_diluted_shares: 9_765_432)
        end.to change { investment1.reload.implied_shares }.to(expected_implied_shares1)
         .and change { investment2.reload.implied_shares }.to(expected_implied_shares2)
      end
    end

    it "enqueues `UpdateUpcomingDividendValuesJob` when `upcoming_dividend_cents` is updated" do
      company = create(:company)
      company.update!(description: ":D")
      expect(UpdateUpcomingDividendValuesJob.jobs.size).to eq(0)

      company.update!(upcoming_dividend_cents: 1_000_000)
      expect(UpdateUpcomingDividendValuesJob).to have_enqueued_sidekiq_job(company.id)
    end
  end

  describe "#active?" do
    it "returns true if deactivated_at is not set, false otherwise" do
      company = build(:company)
      expect(company.active?).to eq true

      company.deactivated_at = 1.hour.from_now
      expect(company.active?).to eq false

      company.deactivated_at = 1.hour.ago
      expect(company.active?).to eq false
    end
  end

  describe "#deactivate!" do
    it "sets deactivated_at timestamp", :freeze_time do
      company = create(:company)
      expect do
        company.deactivate!
      end.to change { company.reload.deactivated_at }.from(nil).to(Time.current)
    end
  end

  describe "#logo_url" do
    it "returns the default company logo when no logo is attached" do
      user = create(:company)
      expect(user.logo).not_to be_attached
      expect(user.logo_url).to eq(ActionController::Base.helpers.asset_path("default-company-logo.svg"))
    end

    it "returns logo url when attached" do
      user = create(:company, :with_logo)
      expect(user.logo).to be_attached
      expect(user.logo_url).to match(/\/rails\/active_storage.+company-logo\.png/)
    end
  end

  describe "#account_balance" do
    it "returns the company's balance in USD" do
      company = create(:company)
      company.balance.update!(amount_cents: 5000_01)
      expect(company.account_balance).to eq 5000.01
    end
  end

  describe "#bank_account_added?" do
    it "returns true if the bank account is present and initial setup is complete, false otherwise" do
      company = create(:company, :without_bank_account)
      expect(company.bank_account_added?).to eq(false)

      create(:company_stripe_account, company:)
      company.reload

      allow_any_instance_of(CompanyStripeAccount).to receive(:initial_setup_completed?).and_return(true)
      expect(company.bank_account_added?).to eq(true)

      allow_any_instance_of(CompanyStripeAccount).to receive(:initial_setup_completed?).and_return(false)
      expect(company.bank_account_added?).to eq(false)
    end
  end

  describe "#bank_account_ready?" do
    it "returns true if the bank account is present and ready, false otherwise" do
      company = create(:company, :without_bank_account)
      expect(company.bank_account_ready?).to eq(false)

      create(:company_stripe_account, company:)
      company.reload

      allow_any_instance_of(CompanyStripeAccount).to receive(:ready?).and_return(true)
      expect(company.bank_account_ready?).to eq(true)

      allow_any_instance_of(CompanyStripeAccount).to receive(:ready?).and_return(false)
      expect(company.bank_account_ready?).to eq(false)
    end
  end

  describe "#completed_onboarding?" do
    let(:company) { create(:company_administrator).company }

    it "returns true if onboarding requirements are met" do
      allow_any_instance_of(OnboardingState::Company).to receive(:complete?).and_return(true)
      expect(company.completed_onboarding?).to eq true
    end

    it "returns false if onboarding requirements are not met" do
      allow_any_instance_of(OnboardingState::Company).to receive(:complete?).and_return(false)
      expect(company.completed_onboarding?).to eq false
    end
  end

  describe "#contractor_payment_processing_time_in_days" do
    let(:company) { create(:company, is_trusted:) }

    context "for a trusted company" do
      let(:is_trusted) { true }

      it "returns 2" do
        expect(company.contractor_payment_processing_time_in_days).to eq 2
      end
    end

    context "for an untrusted company" do
      let(:is_trusted) { false }

      it "returns 10" do
        expect(company.contractor_payment_processing_time_in_days).to eq 10
      end
    end
  end

  describe "#quickbooks_enabled?" do
    let(:company) { create(:company) }

    it "returns true if Quickbooks is enabled" do
      Flipper.enable(:quickbooks, company)
      expect(company.quickbooks_enabled?).to eq true
    end

    it "returns false if Quickbooks is not enabled" do
      expect(company.quickbooks_enabled?).to eq false
    end
  end

  describe "#equity_compensation_enabled?" do
    let(:company) { build(:company) }

    it "returns true if equity compensation is enabled" do
      company.update!(equity_compensation_enabled: true)
      expect(company.equity_compensation_enabled?).to eq true
    end

    it "returns false if equity compensation is not enabled" do
      company.update!(equity_compensation_enabled: false)
      expect(company.equity_compensation_enabled?).to eq false
    end
  end

  describe "#account_balance_low?" do
    let(:company) { create(:company) }

    before do
      allow(company).to receive(:pending_invoice_cash_amount_in_cents).and_return(10_000_00)
    end

    it "returns true if the account balance is less than the pending invoice amount plus buffer" do
      company.balance.update!(amount_cents: 9_999_99 + (Balance::REQUIRED_BALANCE_BUFFER_IN_USD * 100))
      expect(company.account_balance_low?).to eq true
    end

    it "returns false if the account balance is at least the pending invoice amount plus buffer" do
      company.balance.update!(amount_cents: 10_000_00 + (Balance::REQUIRED_BALANCE_BUFFER_IN_USD * 100))
      expect(company.account_balance_low?).to eq false
    end
  end

  describe "#has_sufficient_balance?" do
    let(:company) { create(:company) }

    before do
      api_response = [
        {
          "currency" => "USD",
          "amount" => {
            "value" => 102.78 + Balance::REQUIRED_BALANCE_BUFFER_IN_USD,
            "currency" => "USD",
          },
        },
      ]
      allow_any_instance_of(Wise::PayoutApi).to receive(:get_balances).and_return(api_response)
      company.balance.update!(amount_cents: 103_00 + Balance::REQUIRED_BALANCE_BUFFER_IN_USD * 100)
      create(:wise_credential)
    end

    it "returns true if both the company balance and payout account balance are greater than or equal to the amount provided plus buffer" do
      expect(company.has_sufficient_balance?(102.78)).to eq true
    end

    it "returns false if the payout account balance is less than the amount provided plus buffer" do
      expect(company.has_sufficient_balance?(103.00)).to eq false
    end

    it "returns true if the company balance and Flexile balance are sufficient" do
      company.balance.update!(amount_cents: 102_76)
      expect(company.has_sufficient_balance?(102.75)).to eq true
    end

    it "returns false if the company balance is insufficient" do
      company.balance.update!(amount_cents: 102_74)
      expect(company.has_sufficient_balance?(102.75)).to eq false
    end

    it "returns false if Flexile's balance is insufficient" do
      expect(company.has_sufficient_balance?(102.79)).to eq false
    end

    context "for a trusted company" do
      it "returns true even if the company balance is insufficient" do
        company.update!(is_trusted: true)
        company.balance.update!(amount_cents: 0)

        expect(company.has_sufficient_balance?(102.78)).to eq true
      end
    end
  end

  describe "#pending_invoice_cash_amount_in_cents" do
    it "sums the total cash invoiced for pending invoices" do
      company = create(:company)
      # pending invoices
      [{ cash_amount_in_cents: 4_000_00, equity_amount_in_cents: 400_00, total_amount_in_usd_cents: 4_400_00 },
       { cash_amount_in_cents: 3_000_00, equity_amount_in_cents: 300_00, total_amount_in_usd_cents: 3_300_00 },
       { cash_amount_in_cents: 2_000_00, equity_amount_in_cents: 200_00, total_amount_in_usd_cents: 2_200_00 },
       { cash_amount_in_cents: 1_000_00, equity_amount_in_cents: 100_00, total_amount_in_usd_cents: 1_100_00 }
      ].each do |invoice_attrs|
        create(:invoice, company:, **invoice_attrs)
      end
      # non-pending invoicess
      create(:invoice, company:, total_amount_in_usd_cents: 99_000_00, status: Invoice::PAID)
      create(:invoice, company:, total_amount_in_usd_cents: 88_000_00, status: Invoice::REJECTED)
      # other company invoice
      create(:invoice, total_amount_in_usd_cents: 123_000_00)

      expect(company.pending_invoice_cash_amount_in_cents).to eq 10_000_00
    end
  end

  describe "#fetch_stripe_setup_intent" do
    let(:setup_intent_id) { "seti_#{SecureRandom.hex}" }
    let(:stripe_customer_id) { "cus_#{SecureRandom.hex}" }
    let(:setup_intent) { Stripe::SetupIntent.new(setup_intent_id) }

    before do
      allow(Stripe::Customer).to receive(:create).and_return(Stripe::Customer.new(stripe_customer_id))
      allow(Stripe::SetupIntent).to receive(:create).with({
        customer: stripe_customer_id,
        payment_method_types: ["us_bank_account"],
        payment_method_options: {
          us_bank_account: {
            financial_connections: {
              permissions: ["payment_method"],
            },
          },
        },
        expand: ["payment_method"],
      }).and_return(setup_intent)
      allow(Stripe::SetupIntent).to receive(:retrieve).with({
        id: setup_intent_id,
        expand: ["payment_method"],
      }).and_return(setup_intent)
    end

    it "creates a new customer setup intent if one does not exist" do
      company = create(:company, without_bank_account: true, stripe_customer_id: nil)

      expect do
        result = company.fetch_stripe_setup_intent

        expect(result).to eq setup_intent
        company.reload
        expect(company.stripe_customer_id).to eq stripe_customer_id
        expect(company.bank_account.setup_intent_id).to eq setup_intent_id
        expect(Stripe::Customer).to have_received(:create).once
        expect(Stripe::SetupIntent).to have_received(:create).once
      end.to change { company.company_stripe_accounts.count }.from(0).to(1)
    end

    it "returns the setup intent if one already exists" do
      company = create(:company, without_bank_account: true, stripe_customer_id:,
                                 bank_account: build(:company_stripe_account, setup_intent_id:))

      expect do
        result = company.fetch_stripe_setup_intent
        expect(result).to eq setup_intent

        expect(Stripe::Customer).not_to have_received(:create)
        expect(Stripe::SetupIntent).not_to have_received(:create)
        expect(Stripe::SetupIntent).to have_received(:retrieve).once
      end.not_to change { company.company_stripe_accounts.count }
    end
  end

  describe "#stripe_setup_intent_id" do
    it "returns the bank account setup intent ID, if present" do
      company = create(:company, :without_bank_account)
      expect(company.stripe_setup_intent_id).to eq nil

      create(:company_stripe_account, company:, setup_intent_id: "seti_12345")
      expect(company.reload.stripe_setup_intent_id).to eq "seti_12345"
    end
  end

  describe "#find_company_worker!" do
    let(:company_worker) { create(:company_worker) }
    let(:company) { company_worker.company }
    let(:user) { company_worker.user }

    it "finds the company worker" do
      expect(company.find_company_worker!(user:)).to eq company_worker
    end

    it "raises ActiveRecord::RecordNotFound when company worker is not found" do
      another_user = create(:user)
      expect do
        company.find_company_worker!(user: another_user)
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "#find_company_administrator!" do
    let(:company_administrator) { create(:company_administrator) }
    let(:company) { company_administrator.company }
    let(:user) { company_administrator.user }

    it "finds the company administrator" do
      expect(company.find_company_administrator!(user:)).to eq company_administrator
    end

    it "raises ActiveRecord::RecordNotFound when company administrator is not found" do
      another_user = create(:user)
      expect do
        company.find_company_administrator!(user: another_user)
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "#find_company_lawyer!" do
    let(:company_lawyer) { create(:company_lawyer) }
    let(:company) { company_lawyer.company }
    let(:user) { company_lawyer.user }

    it "finds the company lawyer" do
      expect(company.find_company_lawyer!(user:)).to eq company_lawyer
    end

    it "raises ActiveRecord::RecordNotFound when company lawyer is not found" do
      another_user = create(:user)
      expect do
        company.find_company_lawyer!(user: another_user)
      end.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "#domain_name" do
    let(:company) { build(:company, email: "test@example.org") }

    it "returns the domain name" do
      expect(company.domain_name).to eq "example.org"
    end
  end

  describe "#display_name" do
    let(:company) { build(:company) }
    it "returns the public_name if set explicitly and otherwise the company's legal name" do
      expect(company.display_name).to eq company.name

      company.public_name = "Company!"
      expect(company.display_name).to eq "Company!"

      company.public_name = ""
      expect(company.display_name).to eq company.name
    end
  end

  describe "#display_country" do
    it "returns the country of incorporation for the company" do
      company = build(:company, country_code: "CA")
      expect(company.display_country).to eq("Canada")

      company.country_code = "JP"
      expect(company.display_country).to eq("Japan")

      company.country_code = "RO"
      expect(company.display_country).to eq("Romania")
    end
  end
end
