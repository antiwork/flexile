# frozen_string_literal: true

RSpec.describe User do
  let(:user) { create(:user) }

  describe "associations" do
    it { is_expected.to have_many(:company_administrators) }
    it { is_expected.to have_many(:companies).through(:company_administrators) }

    it { is_expected.to have_many(:company_lawyers) }
    it { is_expected.to have_many(:represented_companies).through(:company_lawyers) }

    it { is_expected.to have_many(:company_workers) }
    it { is_expected.to have_many(:clients).through(:company_workers).source(:company) }

    it { is_expected.to have_many(:company_investors) }
    it { is_expected.to have_many(:portfolio_companies).through(:company_investors).source(:company) }

    it { is_expected.to have_many(:contracts) }
    it { is_expected.to have_many(:documents) }
    it { is_expected.to have_many(:dividends).through(:company_investors) }
    it { is_expected.to have_many(:time_entries) }
    it { is_expected.to have_many(:tos_agreements) }
    it { is_expected.to have_many(:invoices) }
    it { is_expected.to have_many(:invoice_approvals) }
    it { is_expected.to have_many(:bank_accounts).class_name("WiseRecipient") }
    it { is_expected.to have_one(:bank_account).class_name("WiseRecipient") }
    it { is_expected.to have_one(:bank_account_for_dividends).class_name("WiseRecipient") }

    it { is_expected.to have_many(:user_compliance_infos).autosave(true) }

    describe "#compliance_info" do
      it "returns the most recent, live compliance info record" do
        oldest = create(:user_compliance_info, user:, tax_information_confirmed_at: 1.month.ago)
        newest = create(:user_compliance_info, user:, tax_information_confirmed_at: 1.day.ago)
        create(:user_compliance_info, user:, tax_information_confirmed_at: 1.week.ago)
        [oldest, newest].each(&:reload).each(&:mark_undeleted!) # roll back record deletion callback
        create(:user_compliance_info, user:, tax_information_confirmed_at: 1.hour.ago, deleted_at: Time.current)

        expect(user.reload.compliance_info).to eq newest
      end
    end
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:email) }
    it { is_expected.to validate_length_of(:email).is_at_least(5) }
    it { is_expected.to validate_presence_of(:minimum_dividend_payment_in_cents) }
    it { is_expected.to validate_length_of(:preferred_name).is_at_most(50).allow_nil }

    describe "legal_name format" do
      it do
        is_expected.to(allow_values(
          "John Smith", "Jean-Claude Van Damme", "Aitana Sánchez-Gijón", "Jay Z", "S R D", nil
        ).for(:legal_name))
      end
      it { is_expected.to_not allow_values("Jay", "John", "").for(:legal_name) }
    end

    describe "minimum_dividend_payment_in_cents_is_within_range" do
      it "is valid when the value is within the allowed range" do
        user = build(:user, minimum_dividend_payment_in_cents: 5000)
        expect(user).to be_valid
      end

      it "is invalid when the value is greater than the range" do
        user = build(:user, minimum_dividend_payment_in_cents: User::MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS + 1)
        expect(user).to be_invalid
        expect(user.errors.full_messages).to eq(["Minimum dividend payment amount must be between $0 and $1,000"])
      end

      it "is invalid when the value is less than the range" do
        user = build(:user, minimum_dividend_payment_in_cents: User::MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS - 1)
        expect(user).to be_invalid
        expect(user.errors.full_messages).to eq(["Minimum dividend payment amount must be between $0 and $1,000"])
      end
    end
  end

  describe "callbacks" do
    describe "#update_associated_pg_search_documents" do
      it "updates invoice's search index" do
        invoice = create(:invoice)
        invoice.user.update!(legal_name: "Sam UpdatedName")

        expect(invoice.pg_search_document.reload.content).to include("UpdatedName")
      end

      it "updates company_worker's search index" do
        company_worker = create(:company_worker, user:)
        user.reload.update!(legal_name: "Sam UpdatedName")

        expect(company_worker.pg_search_document.reload.content).to include("UpdatedName")
      end
    end

    describe "#sync_with_quickbooks" do
      context "when user is a contractor" do
        let!(:company_worker_1) { create(:company_worker, user:) }
        let!(:company_worker_2) { create(:company_worker, user:) }
        let!(:inactive_company_worker) { create(:company_worker, :inactive, user:) }
        let!(:contractor_without_a_contract) { create(:company_worker, user:, without_contract: true) }
        let!(:contractor_without_a_signed_contract) { create(:company_worker, user:, with_unsigned_contract: true) }

        it "schedules a QuickBooks data sync job when email changes" do
          expect do
            user.update!(email: "flexy-bob@flexile.com")
          end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
        end

        it "schedules one QuickBooks data sync job when multiple attributes changed" do
          expect do
            user.update!(preferred_name: "Sahil", legal_name: "Sahil Lavingia", street_address: "123 Elm St")
          end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
          expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
        end

        context "when user did not complete onboarding" do
          before { allow_any_instance_of(OnboardingState::Worker).to receive(:complete?).and_return(false) }

          it "does not schedule a QuickBooks data sync job when attributes change" do
            expect do
              user.update!(email: "flexy-bob@flexile.com", preferred_name: "Sahil", legal_name: "Sahil Lavingia",
                           country_code: "US", city: "New York City", zip_code: "10001", state: "NY")
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end

      context "when user is a company administrator" do
        let!(:company_administrator) { create(:company_administrator, user:) }

        it "does not schedule a QuickBooks data sync job when email changes" do
          expect do
            user.update!(email: "flexy-bob@flexile.com")
          end.to_not change { QuickbooksDataSyncJob.jobs.size }
        end

        it "does not schedule a QuickBooks data sync job when multiple attributes changed" do
          expect do
            user.update!(preferred_name: "Sahil", legal_name: "Sahil Lavingia", street_address: "123 Elm St")
          end.to_not change { QuickbooksDataSyncJob.jobs.size }
        end
      end
    end

    describe "#update_dividend_status" do
      let(:user) do
        user = build(:user, password: nil)
        user.save(validate: false)
        user
      end

      let!(:dividends) do
        investor1, investor2 = create_pair(:company_investor, user:)
        dividend1, dividend2 = create_pair(:dividend, :pending, company_investor: investor1)
        dividend3, dividend4 = create_pair(:dividend, :pending, company_investor: investor2)
        [dividend1, dividend2, dividend3, dividend4]
      end

      let!(:paid_dividends) do
        company_investor = create(:company_investor, user:)
        create_pair(:dividend, :paid, company_investor:)
      end

      it "updates the status of 'Pending signup' dividends when a user signs in for the first time" do
        expect do
          user.update!(country_code: "CA")
        end.to_not change { dividends.map { _1.reload.status } }

        expect do
          user.update!(current_sign_in_at: Time.current)
        end.to change { dividends.map { _1.reload.status }.uniq.sole }
                 .from(Dividend::PENDING_SIGNUP).to(Dividend::ISSUED)
        expect(paid_dividends.map { _1.reload.status }.uniq).to eq([Dividend::PAID])

        dividends.each { _1.update!(status: Dividend::PENDING_SIGNUP) }
        expect do
          user.update!(password: "MostSecurePasswordEver AGAIN")
        end.to_not change { dividends.map { _1.reload.status } }
      end
    end
  end

  describe "#display_name" do
    context "when legal_name and preferred_name are present" do
      it "returns the preferred name of user" do
        expect(user.display_name).to eq(user.preferred_name)
      end
    end

    context "when legal_name is present and preferred_name is absent" do
      before do
        user.assign_attributes(preferred_name: nil)
      end

      it "returns the legal name of user" do
        expect(user.display_name).to eq(user.legal_name)
      end
    end

    context "when legal_name and preferred_name are absent" do
      before do
        user.assign_attributes(legal_name: nil, preferred_name: nil)
      end

      it "returns the email of user" do
        expect(user.display_name).to eq(user.email)
      end
    end
  end

  describe "#display_email" do
    it "returns the email of user" do
      expect(user.display_email).to eq(user.email)
    end
  end

  describe "#display_country" do
    it "returns the residence country of the user" do
      user = build(:user, country_code: "CA")
      expect(user.display_country).to eq("Canada")
    end

    it "returns 'Not Specified' when country code is blank" do
      user = build(:user, country_code: nil)
      expect(user.display_country).to eq("Not Specified")
    end
  end

  describe "#display_citizenship_country" do
    it "returns the citizenship country of the user" do
      user = build(:user, citizenship_country_code: "CA")
      expect(user.display_citizenship_country).to eq("Canada")
    end

    it "returns 'Not Specified' when citizenship country code is blank" do
      user = build(:user, citizenship_country_code: nil)
      expect(user.display_citizenship_country).to eq("Not Specified")
    end
  end

  describe "#business_entity?" do
    context "when the user has a compliance info record" do
      it "returns true if the compliance info is for a business" do
        user = create(:user_compliance_info, business_entity: true).user
        expect(user.business_entity?).to eq true
      end

      it "returns false if the compliance info is not for a business" do
        user = create(:user_compliance_info, business_entity: false).user
        expect(user.business_entity?).to eq false
      end
    end

    context "when the user does not have a compliance info record" do
      it "returns false" do
        user = create(:user, :without_compliance_info)
        expect(user.business_entity?).to eq false
      end
    end
  end

  describe "#billing_entity_name" do
    context "when user is a private individual" do
      it "returns the legal name" do
        expect(user.billing_entity_name).to eq(user.legal_name)
      end
    end
    context "when user is a business entity" do
      it "returns the business name" do
        user.compliance_info.update!(business_entity: true, business_name: "Business Inc.")

        expect(user.billing_entity_name).to eq("Business Inc.")
      end
    end
  end

  describe "#worker?" do
    it "returns true when a company worker exists" do
      expect(user.worker?).to eq(false)

      create(:company_worker, user:)
      expect(user.worker?).to eq(true)
    end
  end

  describe "#administrator?" do
    it "returns true if the user has an administrator record" do
      expect(user.administrator?).to eq false

      create(:company_administrator, user:)
      expect(user.administrator?).to eq true
    end
  end

  describe "#lawyer?" do
    it "returns true if the user has an lawyer record" do
      expect(user.lawyer?).to eq false

      create(:company_lawyer, user:)
      expect(user.lawyer?).to eq true
    end
  end

  describe "#investor?" do
    it "returns true if the user has an investor record" do
      expect(user.investor?).to eq false

      create(:company_investor, user:)
      expect(user.investor?).to eq true
    end
  end

  describe "#requires_w9?" do
    it "returns true if the user is a citizen of or resides in the United States" do
      expect(user.requires_w9?).to eq true

      user.country_code = "CA"
      expect(user.requires_w9?).to eq true

      user.citizenship_country_code = "JP"
      expect(user.requires_w9?).to eq false

      user.country_code = "US"
      expect(user.requires_w9?).to eq true
    end
  end

  describe "#sanctioned_country_resident?" do
    it "returns true if the user is from a sanctioned country" do
      expect(user.sanctioned_country_resident?).to eq false

      user.country_code = "IR"
      expect(user.sanctioned_country_resident?).to eq true

      user.country_code = "RU"
      expect(user.sanctioned_country_resident?).to eq true

      user.country_code = "CU"
      expect(user.sanctioned_country_resident?).to eq true

      user.country_code = "SY"
      expect(user.sanctioned_country_resident?).to eq true

      user.country_code = "BY"
      expect(user.sanctioned_country_resident?).to eq true

      user.country_code = "CA"
      expect(user.sanctioned_country_resident?).to eq false
    end
  end

  describe "#restricted_payout_country_resident?" do
    it "returns true if the user is from a restricted payout country" do
      %w[SA NG PK].each do |country|
        user.country_code = country
        expect(user.restricted_payout_country_resident?).to eq true
      end

      user.country_code = "BR"
      expect(user.restricted_payout_country_resident?).to eq false
    end
  end

  describe "#compliance_attributes" do
    it "includes fields required for tax compliance" do
      expect(user.compliance_attributes).to eq({
        legal_name: user.legal_name,
        birth_date: user.birth_date,
        tax_id: user.tax_id,
        country_code: user.country_code,
        citizenship_country_code: user.citizenship_country_code,
        street_address: user.street_address,
        city: user.city,
        state: user.state,
        zip_code: user.zip_code,
        business_name: user.business_name,
        tax_information_confirmed_at: user.tax_information_confirmed_at,
        business_type: user.business_type,
        tax_classification: user.tax_classification,
        business_entity: user.business_entity?,
        signature: user.signature,
      })
    end
  end

  describe "#build_compliance_info" do
    let(:user) do
      create(:user, :without_compliance_info, birth_date: Date.parse("January 15, 1980"), legal_name: "Joe Flexile",
                                              street_address: "123 Main St", city: "Hadley", state: "MA", zip_code: "01035",
                                              citizenship_country_code: "AU").tap do |user|
        create(:user_compliance_info, user:, tax_id: "111-22-3333", business_entity: true, business_name: "Joe's Jams and Jellies")
      end
    end

    it "builds a new user compliance info with the params provided and the user's current info" do
      compliance_info = user.build_compliance_info(tax_id: "555-66-7777", birth_date: Date.parse("February 5, 1979"),
                                                   business_entity: false, business_name: nil)

      expect(compliance_info).not_to be_persisted
      expect(compliance_info).to be_valid
      expect(compliance_info.business_entity).to eq false
      expect(compliance_info.business_name).to eq nil
      expect(compliance_info.birth_date).to eq Date.parse("February 5, 1979")
      expect(compliance_info.street_address).to eq "123 Main St"
      expect(compliance_info.city).to eq "Hadley"
      expect(compliance_info.zip_code).to eq "01035"
      expect(compliance_info.country_code).to eq "US"
      expect(compliance_info.citizenship_country_code).to eq "AU"
      expect(compliance_info.tax_id).to eq "555667777"
    end
  end

  describe "#has_verified_tax_id?" do
    context "for users in the US" do
      it "returns true if the tax ID has been verified" do
        user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED)
        expect(user.reload.has_verified_tax_id?).to eq true
      end

      it "returns false if the tax ID has not yet been verified" do
        expect(user.has_verified_tax_id?).to eq false
      end

      it "returns false if the tax ID is invalid" do
        user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID)
        expect(user.reload.has_verified_tax_id?).to eq false
      end

      it "returns false if the user has no tax ID" do
        user.compliance_info.tax_id = nil
        user.compliance_info.save(validate: false) # bypass validation
        expect(user.reload.has_verified_tax_id?).to eq false
      end
    end

    context "for users outside of the US" do
      before do
        user.update!(citizenship_country_code: "AU", country_code: "AU")
      end

      it "returns true if the user has a tax ID" do
        expect(user.has_verified_tax_id?).to eq true
        user.compliance_info.update!(tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID)
        expect(user.reload.has_verified_tax_id?).to eq true
      end

      it "returns false if the user does not have a tax id" do
        user.compliance_info.tax_id = nil
        user.compliance_info.save(validate: false) # bypass validation
        expect(user.reload.has_verified_tax_id?).to eq false
      end
    end
  end

  describe "#company_administrator_for?" do
    let(:user) { create(:user) }

    context "when company administrator is absent" do
      it "returns false" do
        expect(user.company_administrator_for?(create(:company))).to eq(false)
      end
    end

    context "when company administrator is present" do
      let(:company_administrator) { create(:company_administrator, user:) }

      it "returns true" do
        expect(user.company_administrator_for?(company_administrator.company)).to eq(true)
      end
    end
  end

  describe "#company_administrator_for" do
    let(:user) { create(:user) }

    context "when company administrator is absent" do
      it "returns nil" do
        expect(user.company_administrator_for(create(:company))).to eq(nil)
      end
    end

    context "when company administrator is present" do
      let(:company_administrator) { create(:company_administrator, user:) }

      it "returns the company administrator" do
        expect(user.company_administrator_for(company_administrator.company)).to eq(company_administrator)
      end
    end
  end

  describe "#company_administrator_for?" do
    let(:company_administrator) { create(:company_administrator) }
    let(:user) { company_administrator.user }

    it "calls #company_administrator_for and checks if the result is present" do
      allow(user).to receive(:company_administrator_for).with(company_administrator.company).and_return(double)
      expect(user.company_administrator_for(company_administrator.company)).to receive(:present?)
      user.company_administrator_for?(company_administrator.company)
    end
  end

  describe "#company_lawyer_for?" do
    let(:user) { create(:user) }

    context "when company lawyer is absent" do
      it "returns false" do
        expect(user.company_lawyer_for?(create(:company))).to eq(false)
      end
    end

    context "when company lawyer is present" do
      let(:company_lawyer) { create(:company_lawyer, user:) }

      it "returns true" do
        expect(user.company_lawyer_for?(company_lawyer.company)).to eq(true)
      end
    end
  end

  describe "#company_lawyer_for" do
    let(:user) { create(:user) }

    context "when company lawyer is absent" do
      it "returns nil" do
        expect(user.company_lawyer_for(create(:company))).to eq(nil)
      end
    end

    context "when company lawyer is present" do
      let(:company_lawyer) { create(:company_lawyer, user:) }

      it "returns the company lawyer" do
        expect(user.company_lawyer_for(company_lawyer.company)).to eq(company_lawyer)
      end
    end
  end

  describe "#company_worker_for" do
    let(:user) { create(:user) }

    context "when company worker is absent" do
      it "returns nil" do
        expect(user.company_worker_for(create(:company))).to eq(nil)
      end
    end

    context "when only company worker is present" do
      let(:company_worker) { create(:company_worker, user:) }

      it "returns the company worker" do
        expect(user.company_worker_for(company_worker.company)).to eq(company_worker)
      end
    end
  end

  describe "#company_worker_for?" do
    let(:user) { create(:user) }

    context "when company worker is absent" do
      it "returns false" do
        expect(user.company_worker_for?(create(:company))).to eq(false)
      end
    end

    context "when company worker is present" do
      let(:company_worker) { create(:company_worker, user:) }

      it "returns true" do
        expect(user.company_worker_for?(company_worker.company)).to eq(true)
      end
    end
  end

  describe "#company_investor_for" do
    let(:user) { create(:user) }

    context "when company investor is absent" do
      it "returns nil" do
        expect(user.company_investor_for(create(:company))).to eq(nil)
      end
    end

    context "when company investor is present" do
      let(:company_investor) { create(:company_investor, user:) }

      it "returns the company investor" do
        expect(user.company_investor_for(company_investor.company)).to eq(company_investor)
      end
    end
  end

  describe "#company_investor_for?" do
    let(:user) { create(:user) }

    context "when company investor is absent" do
      it "returns false" do
        expect(user.company_investor_for?(create(:company))).to eq(false)
      end
    end

    context "when company investor is present" do
      let(:company_investor) { create(:company_investor, user:) }

      it "returns true" do
        expect(user.company_investor_for?(company_investor.company)).to eq(true)
      end
    end
  end

  describe "#should_regenerate_consulting_contract?" do
    let(:user) { create(:user) }

    it "returns true when any of the attributes used in the consulting contract are changed" do
      {
        email: "new@example.com",
        legal_name: "New Legal Name",
        business_entity: true,
        business_name: "New Business Name",
        street_address: "123 New St",
        city: "New City",
        state: "NS",
        zip_code: "12345",
        country_code: "CA",
        citizenship_country_code: "GB",
      }.each do |attr, value|
        expect(user.should_regenerate_consulting_contract?({ attr => value })).to eq true
      end
    end

    it "returns false when no consulting contract attributes change" do
      changeset = { preferred_name: "New Name", legal_name: user.legal_name, country_code: user.country_code }
      expect(user.should_regenerate_consulting_contract?(changeset)).to eq false
    end
  end
end
