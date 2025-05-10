# frozen_string_literal: true

RSpec.describe CompanyWorker do
  describe "associations" do
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:contracts) }
    it { is_expected.to have_many(:equity_allocations) }
    it { is_expected.to have_many(:integration_records) }
    it { is_expected.to have_many(:invoices) }
    it { is_expected.to have_one(:quickbooks_integration_record) }
  end

  describe "validations" do
    before { create(:company_worker) }

    it { is_expected.to validate_uniqueness_of(:user_id).scoped_to(:company_id) }
    it { is_expected.to validate_presence_of(:started_at) }
    it { is_expected.to validate_presence_of(:pay_rate_in_subunits) }
    it { is_expected.to validate_numericality_of(:pay_rate_in_subunits).is_greater_than(0).only_integer }
    it { is_expected.to validate_inclusion_of(:pay_rate_type).in_array(described_class.pay_rate_types.values) }

    context "when pay_rate_type is 'hourly'" do
      subject(:company_worker) { create(:company_worker, pay_rate_type: :hourly) }

      it { is_expected.to validate_presence_of(:hours_per_week) }
      it { is_expected.to validate_numericality_of(:hours_per_week).is_greater_than(0).only_integer }
    end

    context "when pay_rate_type is 'project_based'" do
      subject(:company_worker) { build(:company_worker, pay_rate_type: :project_based, hours_per_week: nil) }

      it "does not validate presence of hours_per_week" do
        expect(company_worker.valid?).to eq(true)
      end
    end
  end

  describe "scopes" do
    before do
      company = create(:company)
      @onboarding_contractor = create(:company_worker, company:, started_at: 2.days.after)
      @active_contractor = create(:company_worker, company:, started_at: 2.days.ago)
      @alumni_contractor_1 = create(:company_worker, company:, started_at: 1.month.ago, ended_at: 2.days.ago)
    end

    describe ".active" do
      it "returns only active contractors" do
        expect(described_class.active).to match_array([@onboarding_contractor, @active_contractor])
      end
    end

    describe ".active_as_of" do
      it "returns active contractors or inactive contractors who were active as of the given date" do
        expect(described_class.active_as_of(Time.current)).to match_array([@onboarding_contractor, @active_contractor])
        expect(described_class.active_as_of(@alumni_contractor_1.ended_at - 1.minute)).to match_array([@onboarding_contractor, @active_contractor, @alumni_contractor_1])
      end
    end

    describe ".inactive" do
      it "returns only inactive contractors" do
        expect(described_class.inactive).to match_array([@alumni_contractor_1])
      end
    end

    describe ".started_on_or_before" do
      it "returns the expected result" do
        expect(described_class.started_on_or_before(Time.current)).to match_array([@active_contractor, @alumni_contractor_1])
      end
    end

    describe ".starting_after" do
      it "returns the expected result" do
        expect(described_class.starting_after(Time.current)).to match_array([@onboarding_contractor])
      end
    end

    describe ".not_submitted_invoices" do
      it "returns the list of company_workers who haven't submitted an invoice for the last billing period" do
        create(:invoice, company_worker: @alumni_contractor_1)

        expect(described_class.not_submitted_invoices).to match_array([@active_contractor, @onboarding_contractor])
      end
    end

    describe ".with_signed_contract" do
      it "returns the list of company_workers who have signed contracts" do
        create(:company_worker, company: @active_contractor.company, without_contract: true)
        create(:company_worker, company: @active_contractor.company, with_unsigned_contract: true)

        company_worker_with_new_document = create(:company_worker, without_contract: true)
        create(:document, company: company_worker_with_new_document.company, signed: true, signatories: [company_worker_with_new_document.user])

        # Company worker without fully signed document
        company_worker_without_fully_signed_document = create(:company_worker, without_contract: true)
        document = create(:document, company: company_worker_without_fully_signed_document.company, signed: false, signatories: [company_worker_without_fully_signed_document.user, create(:company_administrator, company: company_worker_without_fully_signed_document.company).user])
        document.signatures.find_by(user: company_worker_without_fully_signed_document.user).update!(signed_at: Time.current)

        result = described_class.with_signed_contract
        expected_collection = [
          @active_contractor, @onboarding_contractor, @alumni_contractor_1, company_worker_with_new_document
        ]
        expect(result).to match_array(expected_collection)
      end
    end

    describe ".with_required_tax_info_for" do
      let(:company) { create(:company, irs_tax_forms:) }
      let(:tax_year) { Date.current.year }
      let(:company_worker_1) do
        user = create(:user, :without_compliance_info, country_code: "US", citizenship_country_code: "IN")
        create(:user_compliance_info, :confirmed, user:)
        create(:company_worker, company:, user:)
      end
      let(:company_worker_2) do
        user = create(:user, :without_compliance_info, email: "unconfirmed@example.com", country_code: "US")
        create(:user_compliance_info, user:, tax_information_confirmed_at: nil)
        create(:company_worker, company:, user:)
      end

      before do
        create(:invoice, :paid, company_worker: company_worker_1, company:, total_amount_in_usd_cents: 1000_00)
        create(:invoice, :paid, company_worker: company_worker_2, company:, total_amount_in_usd_cents: 300_00)
        create(:invoice, :paid, company_worker: company_worker_2, company:, total_amount_in_usd_cents: 300_00)

        # Contractor who is a US citizen, but not a resident
        user = create(:user, :without_compliance_info, country_code: "AE", citizenship_country_code: "US")
        create(:user_compliance_info, :confirmed, user:)
        company_worker_3 = create(:company_worker, company:, user:)
        create(:invoice, :paid, company_worker: company_worker_3, company:, total_amount_in_usd_cents: 1000_00)

        # Contractor without a paid invoice
        company_worker_4 = create(:company_worker, company:, user: create(:user))
        create(:invoice, company_worker: company_worker_4, company:, total_amount_in_usd_cents: 1000_00)

        # Contractor with a paid invoice but not above threshold
        company_worker_5 = create(:company_worker, company:, user: create(:user))
        create(:invoice, :paid, company_worker: company_worker_5, company:, total_amount_in_usd_cents: 599_99)

        # Contractor with a paid invoice above threshold but not in the given tax year
        company_worker_6 = create(:company_worker, company:, user: create(:user))
        create(:invoice, :paid, company_worker: company_worker_6, company:,
                                total_amount_in_usd_cents: 1000_00,
                                invoice_date: Date.current.prev_year,
                                paid_at: Date.current.prev_year)

        # Contractor with a paid invoice above threshold but not a US citizen or resident
        user = create(:user, country_code: "AR", citizenship_country_code: "AR")
        company_worker_7 = create(:company_worker, company:, user:)
        create(:invoice, :paid, company_worker: company_worker_7, company:, total_amount_in_usd_cents: 1000_00)

        # Salary worker that should be excluded
        user = create(:user, :without_compliance_info, country_code: "US")
        create(:user_compliance_info, :confirmed, user:)
        company_worker_8 = create(:company_worker, :salary, company:, user:)
        create(:invoice, :paid, company_worker: company_worker_8, company:, total_amount_in_usd_cents: 1000_00)
      end

      context "when 'irs_tax_forms' bit flag is not set for the company" do
        let(:irs_tax_forms) { false }

        it "returns an empty array" do
          expect(described_class.with_required_tax_info_for(tax_year:)).to eq([])
        end
      end

      context "when 'irs_tax_forms' bit flag is set for the company" do
        let(:irs_tax_forms) { true }

        it "returns the list of company_workers who are eligible for 1099-NEC" do
          expect(described_class.with_required_tax_info_for(tax_year:)).to match_array(
            [company_worker_1, company_worker_2]
          )
        end
      end
    end
  end

  describe "callbacks" do
    describe "#notify_rate_updated" do
      context "when company worker has an hourly-based role" do
        let!(:company_worker) { create(:company_worker, started_at: 1.day.ago) }
        let(:old_pay_rate_in_subunits) { company_worker.pay_rate_in_subunits }

        context "when rate is unchanged" do
          let(:new_pay_rate_in_subunits) { old_pay_rate_in_subunits }

          it "does not schedule a QuickBooks data sync job" do
            expect do
              company_worker.update!(pay_rate_in_subunits: new_pay_rate_in_subunits)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end

        context "when rate changes" do
          let(:new_pay_rate_in_subunits) { old_pay_rate_in_subunits + 1 }

          it "schedules a QuickBooks data sync job" do
            expect do
              company_worker.update!(pay_rate_in_subunits: new_pay_rate_in_subunits)
            end.to change { QuickbooksDataSyncJob.jobs.size }.by(1)

            expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker.company_id, "CompanyWorker", company_worker.id)
          end
        end
      end

      context "when company worker has a project-based role" do
        let!(:company_worker) { create(:company_worker, :project_based, started_at: 1.day.ago) }
        let(:old_pay_rate_in_subunits) { company_worker.pay_rate_in_subunits }

        context "when rate is unchanged" do
          let(:new_pay_rate_in_subunits) { old_pay_rate_in_subunits }

          it "does not schedule a QuickBooks data sync job" do
            expect do
              company_worker.update!(pay_rate_in_subunits: new_pay_rate_in_subunits)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end

        context "when rate changes" do
          let(:new_pay_rate_in_subunits) { old_pay_rate_in_subunits + 1 }

          it "does not schedule a QuickBooks data sync job" do
            expect do
              company_worker.update!(pay_rate_in_subunits: new_pay_rate_in_subunits)
            end.to_not change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end
    end
  end

  describe "delegations" do
    it { is_expected.to delegate_method(:integration_external_id).to(:quickbooks_integration_record) }
    it { is_expected.to delegate_method(:sync_token).to(:quickbooks_integration_record) }
  end

  describe "#active?" do
    it "return `true` when the contract hasn't ended" do
      expect(build(:company_worker, ended_at: Date.current).active?).to eq(false)
      expect(build(:company_worker).active?).to eq(true)
    end
  end

  describe "#avg_yearly_usd" do
    it "calculates and returns the average pay in USD for a year" do
      company_worker = build(:company_worker, hours_per_week: 40, pay_rate_in_subunits: 30_00)

      yearly_rate_in_usd = company_worker.avg_yearly_usd
      expect(yearly_rate_in_usd).to eq(52_800)
    end
  end

  describe "#alumni?" do
    subject(:alumni?) { company_worker.alumni? }

    context "when contractor is onboarding" do
      let(:company_worker) { create :company_worker, started_at: 2.day.after }

      it { is_expected.to eq(false) }
    end

    context "when contract is active" do
      let(:company_worker) { create(:company_worker, started_at: 1.day.ago) }

      it { is_expected.to eq(false) }
    end

    context "when contract has just ended" do
      let(:company_worker) { create(:company_worker, started_at: 1.month.ago, ended_at: 1.day.ago) }

      it { is_expected.to eq(true) }
    end

    context "when contract ended and is past the grace period" do
      let(:company_worker) { create(:company_worker, started_at: 1.month.ago, ended_at: 11.days.ago) }

      it { is_expected.to eq(true) }
    end
  end

  describe "#end_contract!" do
    context "when contractor is inactive", :freeze_time do
      let!(:company_worker) { create(:company_worker, started_at: 1.month.ago, ended_at: 1.day.ago) }

      it "does not send another email notification and leaves ended_at timestamp untouched" do
        expect do
          expect do
            company_worker.end_contract!
          end.to_not change { company_worker.reload.ended_at }.from(1.day.ago)
        end
      end
    end

    context "when contractor is active" do
      let!(:company_worker) { create(:company_worker, started_at: 1.day.ago) }

      it "ends the contract", :freeze_time do
        expect do
          company_worker.end_contract!
        end.to change { company_worker.reload.ended_at }.from(nil).to(Time.current)
      end
    end
  end

  describe "#quickbooks_entity" do
    it "returns the QuickBooks entity name" do
      expect(build(:company_worker).quickbooks_entity).to eq("Vendor")
    end
  end

  describe "#create_or_update_integration_record!", :freeze_time do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:) }

    context "when no integration record exists for the contractor" do
      it "creates a new integration record for the contractor" do
        expect do
          contractor.create_or_update_quickbooks_integration_record!(integration:, parsed_body: { "Id" => "1", "SyncToken" => "0" })
        end.to change { IntegrationRecord.count }.by(1)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        integration_record = contractor.reload.quickbooks_integration_record
        expect(integration_record.integration_external_id).to eq("1")
        expect(integration_record.sync_token).to eq("0")
      end
    end

    context "when an integration record exists for the contractor" do
      let!(:integration_record) { create(:integration_record, integratable: contractor, integration:, integration_external_id: "1") }

      it "updates the integration record with the new sync_token" do
        expect do
          contractor.create_or_update_quickbooks_integration_record!(integration:, parsed_body: { "Id" => "1", "SyncToken" => "1" })
        end.to change { IntegrationRecord.count }.by(0)
        .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

        expect(integration_record.reload.integration_external_id).to eq("1")
        expect(integration_record.sync_token).to eq("1")
      end

      context "when the integration record has the old class name CompanyContractor" do
        before do
          integration_record.update!(integratable_type: "CompanyContractor")
        end

        it "updates the integration record with the new sync_token" do
          expect do
            contractor.create_or_update_quickbooks_integration_record!(integration:, parsed_body: { "Id" => "1", "SyncToken" => "1" })
          end.to change { IntegrationRecord.count }.by(0)
          .and change { integration.reload.last_sync_at }.from(nil).to(Time.current)

          expect(integration_record.reload.integration_external_id).to eq("1")
          expect(integration_record.sync_token).to eq("1")
        end
      end
    end
  end

  describe "#serialize" do
    let(:contractor) { create(:company_worker) }

    it "returns the serialized object" do
      expect(contractor.serialize(namespace: "Quickbooks")).to eq(
        {
          Active: true,
          BillAddr: {
            City: contractor.user.city,
            Line1: contractor.user.street_address,
            PostalCode: contractor.user.zip_code,
            Country: contractor.user.display_country,
            CountrySubDivisionCode: contractor.user.state,
          },
          BillRate: 60.0,
          GivenName: contractor.user.legal_name,
          DisplayName: contractor.user.billing_entity_name,
          PrimaryEmailAddr: {
            Address: contractor.user.display_email,
          },
          Vendor1099: false,
          TaxIdentifier: "000000000",
        }.to_json
      )
    end
  end

  describe "#fetch_existing_quickbooks_entity", :vcr do
    let(:company) { create(:company) }
    let!(:integration) { create(:quickbooks_integration, company:) }
    let(:contractor) { create(:company_worker, company:, user:) }

    context "when no integration record exists for the contractor" do
      context "when contractor email does not exist in QuickBooks" do
        let(:user) { create(:user) }

        it "returns nil" do
          expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_vendor_by_email_and_name).with(email: user.email, name: user.billing_entity_name).and_call_original
          expect(contractor.fetch_existing_quickbooks_entity).to be_nil
        end
      end

      context "when contractor email exists in QuickBooks" do
        context "when contractor is an individual" do
          let(:user) { create(:user, email: "caro@example.com", legal_name: "Caro Example") }

          it "returns the QuickBooks entity" do
            expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_vendor_by_email_and_name).with(email: "caro@example.com", name: "Caro Example").and_call_original
            expect(contractor.fetch_existing_quickbooks_entity).to eq(
              {
                "Active" => true,
                "Balance" => 4620.0,
                "BillAddr" => { "Country" => "Argentina", "Id" => "160" },
                "BillRate" => 50,
                "CurrencyRef" => { "name" => "United States Dollar", "value" => "USD" },
                "DisplayName" => "Caro Example",
                "Id" => "85",
                "MetaData" => { "CreateTime" => "2022-12-30T11:17:44-08:00", "LastUpdatedTime" => "2024-01-25T06:57:17-08:00" },
                "PrimaryEmailAddr" => { "Address" => "caro@example.com" },
                "PrintOnCheckName" => "Caro Example",
                "SyncToken" => "17",
                "V4IDPseudonym" => "00209847d5d4485cdd4b0cade8f38ad07c308d",
                "Vendor1099" => false,
                "domain" => "QBO",
                "sparse" => false,
              }
            )
          end
        end

        context "when contractor is a business" do
          let(:user) { create(:user, without_compliance_info: true, email: "caro@example.com", legal_name: "Caro Example") }

          before { create(:user_compliance_info, user:, business_name: "Acme Example LLC", business_entity: true) }

          it "returns nil" do
            expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_vendor_by_email_and_name).with(email: "caro@example.com", name: "Acme Example LLC").and_call_original
            expect(contractor.fetch_existing_quickbooks_entity).to be_nil
          end
        end
      end
    end

    context "when an integration record exists for the contractor" do
      let!(:integration_record) { create(:integration_record, integratable: contractor, integration:, integration_external_id: "85") }

      context "when contractor email does not exist in QuickBooks" do
        let(:user) { create(:user) }

        it "returns nil and marks the integration record as deleted" do
          expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_vendor_by_email_and_name).with(email: user.email, name: user.billing_entity_name)
          expect(contractor.fetch_existing_quickbooks_entity).to be_nil
          expect(integration_record.reload.deleted_at).to_not be_nil
        end
      end

      context "when contractor email exists in QuickBooks" do
        let(:user) { create(:user, email: "caro@example.com", legal_name: "Caro Fabioni") }

        it "returns nil and marks the integration record as deleted" do
          expect_any_instance_of(IntegrationApi::Quickbooks).to receive(:fetch_vendor_by_email_and_name).with(email: "caro@example.com", name: "Caro Fabioni")
          expect(contractor.fetch_existing_quickbooks_entity).to be_nil
          expect(integration_record.reload.deleted_at).to_not be_nil
        end
      end
    end
  end

  describe "#unique_unvested_equity_grant_for_year" do
    let(:user) { create(:user) }
    let(:company) { create(:company) }
    let(:company_worker) { create(:company_worker, company:, user:) }
    let(:company_investor) { create(:company_investor, company:, user:) }
    let(:year) { Date.current.year }

    subject(:unique_unvested_equity_grant_for_year) { company_worker.unique_unvested_equity_grant_for_year(year) }

    context "when the user has no investor record" do
      it { is_expected.to be_nil }
    end

    context "when the user has an investor record" do
      context "when the investor has no option grants" do
        it { is_expected.to be_nil }
      end

      context "when the investor has an equity grant" do
        let!(:grant) do
          create(:active_grant, company_investor:, year:)
        end

        context "when the investor has an unvested equity grant for the given year" do
          it { is_expected.to eq(grant) }
        end

        context "when the investor has multiple unvested equity grant for the given year" do
          before do
            create(:active_grant, company_investor:, year:)
          end

          it { is_expected.to be_nil }
        end

        context "when the investor has no unvested option grants for the given year" do
          before { grant.update!(unvested_shares: 0, vested_shares: 800) }

          it { is_expected.to be_nil }
        end
      end
    end
  end

  describe "#send_equity_percent_selection_email" do
    let(:contractor) { create(:company_worker) }
    let(:year) { 2024 }

    context "when the email has already been sent" do
      it "does not send the email" do
        create(:equity_allocation, company_worker: contractor, year:, sent_equity_percent_selection_email: true)

        expect do
          contractor.send_equity_percent_selection_email(year)
        end.not_to have_enqueued_mail(CompanyWorkerMailer, :equity_percent_selection)
      end
    end

    context "when the email has not been sent" do
      it "sends the email and sets the relevant flag" do
        expect do
          contractor.send_equity_percent_selection_email(year)
        end.to have_enqueued_mail(CompanyWorkerMailer, :equity_percent_selection).with(contractor.id)
           .and change { contractor.equity_allocation_for(year)&.sent_equity_percent_selection_email? }.from(nil).to(true)
      end
    end
  end

  describe "#equity_percentage" do
    let(:contractor) { create(:company_worker, equity_percentage: 10) }
    let(:year) { Date.current.year }

    context "when the equity allocation exists" do
      it "returns the equity percentage" do
        expect(contractor.equity_percentage(year)).to eq(10)
      end
    end

    context "when the equity allocation does not exist" do
      it "returns nil" do
        expect(contractor.equity_percentage(year + 1)).to be_nil
      end
    end
  end

  describe "#equity_allocation_for" do
    let(:contractor) { create(:company_worker) }
    let(:year) { Date.current.year }
    let!(:equity_allocation) { create(:equity_allocation, company_worker: contractor, year:) }

    context "when the equity allocation exists" do
      it "returns the equity allocation" do
        expect(contractor.equity_allocation_for(year)).to eq(equity_allocation)
      end
    end

    context "when the equity allocation does not exist" do
      it "returns nil" do
        expect(contractor.equity_allocation_for(year + 1)).to be_nil
      end
    end
  end
end
