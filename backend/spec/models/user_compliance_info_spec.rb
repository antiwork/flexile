# frozen_string_literal: true

RSpec.describe UserComplianceInfo do
  describe "associations" do
    it { is_expected.to belong_to(:user) }
    it { is_expected.to have_many(:tax_documents) }
    it { is_expected.to have_many(:documents) }
    it { is_expected.to have_many(:dividends) }
  end

  describe "normalizations" do
    context "with valid formats" do
      let(:user_compliance_info) { build(:user_compliance_info, tax_id: "12-3456789") }

      it "removes non-digit characters from tax_id" do
        expect(user_compliance_info.tax_id).to eq("123456789")
      end
    end

    context "when attributes are missing" do
      let(:user_compliance_info) { build(:user_compliance_info, tax_id: nil) }

      it "handles missing tax_id" do
        expect(user_compliance_info.tax_id).to be_nil
      end
    end

    context "when inputting invalid values" do
      let(:user_compliance_info) { build(:user_compliance_info, tax_id: "invalid") }

      it "removes non-digit characters from an invalid tax_id" do
        expect(user_compliance_info.tax_id).to eq("")
      end
    end

    context "with different formats" do
      let(:user_compliance_info) { build(:user_compliance_info, tax_id: " C12 3456789 KF ") }

      it "normalizes tax_id leaving uppercase alphanumeric characters" do
        expect(user_compliance_info.tax_id).to eq("C123456789KF")
      end
    end
  end

  describe "validations" do
    context "when tax_information_confirmed_at is present and not deleted" do
      before { allow(subject).to receive(:tax_information_confirmed_at).and_return(Time.current) }

      it { is_expected.to validate_presence_of(:tax_id) }
      it { is_expected.to validate_presence_of(:street_address) }
      it { is_expected.to validate_presence_of(:city) }
      it { is_expected.to validate_presence_of(:state) }
      it { is_expected.to validate_presence_of(:zip_code) }
      it { is_expected.to validate_presence_of(:country_code) }
      it { is_expected.to validate_presence_of(:citizenship_country_code) }
      it { is_expected.to validate_presence_of(:legal_name) }
    end

    context "when tax_information_confirmed_at is not present" do
      before { allow(subject).to receive(:tax_information_confirmed_at).and_return(nil) }

      it { is_expected.not_to validate_presence_of(:tax_id) }
      it { is_expected.not_to validate_presence_of(:street_address) }
      it { is_expected.not_to validate_presence_of(:city) }
      it { is_expected.not_to validate_presence_of(:state) }
      it { is_expected.not_to validate_presence_of(:zip_code) }
      it { is_expected.not_to validate_presence_of(:country_code) }
      it { is_expected.not_to validate_presence_of(:citizenship_country_code) }
      it { is_expected.not_to validate_presence_of(:legal_name) }
    end

    context "when record is deleted" do
      before do
        allow(subject).to receive(:tax_information_confirmed_at).and_return(Time.current)
        allow(subject).to receive(:alive?).and_return(false)
      end

      it { is_expected.not_to validate_presence_of(:tax_id) }
      it { is_expected.not_to validate_presence_of(:street_address) }
      it { is_expected.not_to validate_presence_of(:city) }
      it { is_expected.not_to validate_presence_of(:state) }
      it { is_expected.not_to validate_presence_of(:zip_code) }
      it { is_expected.not_to validate_presence_of(:country_code) }
      it { is_expected.not_to validate_presence_of(:citizenship_country_code) }
      it { is_expected.not_to validate_presence_of(:legal_name) }
    end

    describe "#business_name" do
      subject(:info) { build(:user_compliance_info, business_entity:, business_name: nil, tax_information_confirmed_at:) }

      context "when tax information has been confirmed" do
        let(:tax_information_confirmed_at) { Time.current }

        context "and business_entity is true" do
          let(:business_entity) { true }
          it { is_expected.to validate_presence_of(:business_name) }
        end

        context "and business_entity is false" do
          let(:business_entity) { false }
          it { is_expected.not_to validate_presence_of(:business_name) }
        end
      end

      context "when tax information has not been confirmed" do
        let(:tax_information_confirmed_at) { nil }
        let(:business_entity) { true }
        it { is_expected.not_to validate_presence_of(:business_name) }
      end

      context "when record is deleted" do
        let(:tax_information_confirmed_at) { Time.current }
        let(:business_entity) { true }
        before { allow(info).to receive(:alive?).and_return(false) }
        it { is_expected.not_to validate_presence_of(:business_name) }
      end
    end

    describe "#tax_classification" do
      subject(:info) { build(:user_compliance_info, :confirmed, business_entity: true, business_type: :llc) }
      it { is_expected.to validate_presence_of(:tax_classification) }

      context "when business_entity is false" do
        subject(:info) { build(:user_compliance_info, :confirmed, business_entity: false) }
        it { is_expected.not_to validate_presence_of(:tax_classification) }
      end

      context "when business_type is not llc" do
        subject(:info) { build(:user_compliance_info, :confirmed, business_entity: true, business_type: :c_corporation) }
        it { is_expected.not_to validate_presence_of(:tax_classification) }
      end

      context "when record is deleted" do
        subject(:info) { build(:user_compliance_info, :confirmed, business_entity: true, business_type: :llc, deleted_at: Time.current) }
        it { is_expected.not_to validate_presence_of(:tax_classification) }
      end
    end
  end

  describe "callbacks" do
    describe "#delete_outdated_compliance_infos!" do
      it "deletes all older compliance infos for that user", :freeze_time do
        user = create(:user)
        compliance_info = create(:user_compliance_info, user:)
        deleted_compliance_info = create(:user_compliance_info, user:, deleted_at: 1.week.ago)
        other_user_compliance_info = create(:user_compliance_info)

        expect do
          create(:user_compliance_info, user:)
        end.to change { compliance_info.reload.deleted_at }.from(nil).to(Time.current)
           .and not_change { deleted_compliance_info.reload.deleted_at }
           .and not_change { other_user_compliance_info.reload.deleted_at }
      end
    end

    shared_examples_for "generating tax documents" do |klass|
      context "for a new record" do
        it "enqueues a job to generate the tax information document if tax information is confirmed" do
          user_compliance_info = build(:user_compliance_info, :confirmed)
          expect do
            user_compliance_info.save!
          end.to change { klass.jobs.size }.by(1)

          expect(klass).to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end

        it "does not enqueue a job to generate the tax information document if tax information is not confirmed" do
          user_compliance_info = build(:user_compliance_info, tax_information_confirmed_at: nil)
          expect do
            user_compliance_info.save!
          end.not_to change { klass.jobs.size }

          expect(klass).not_to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end

        it "does not enqueue a job to generate the tax information document if the record is deleted" do
          user_compliance_info = build(:user_compliance_info, :confirmed, deleted_at: Time.current)
          expect do
            user_compliance_info.save!
          end.not_to change { klass.jobs.size }

          expect(klass).not_to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end
      end

      context "for an updated record" do
        it "enqueues a job to generate the tax information document if tax information is confirmed" do
          user_compliance_info = create(:user_compliance_info, tax_information_confirmed_at: nil)
          expect do
            user_compliance_info.update!(street_address: "123 Main St", tax_information_confirmed_at: Time.current)
          end.to change { klass.jobs.size }.by(1)

          expect(klass).to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end

        it "does not enqueue a job to generate the tax information document if tax information is not confirmed" do
          user_compliance_info = create(:user_compliance_info, tax_information_confirmed_at: nil)
          expect do
            user_compliance_info.update!(street_address: "123 Main St")
          end.not_to change { klass.jobs.size }

          expect(klass).not_to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end

        it "does not enqueue a job to generate the tax information document if the record is deleted" do
          user_compliance_info = create(:user_compliance_info, tax_information_confirmed_at: nil)
          expect do
            user_compliance_info.update!(street_address: "123 Main St", tax_information_confirmed_at: Time.current, deleted_at: Time.current)
          end.not_to change { klass.jobs.size }

          expect(klass).not_to have_enqueued_sidekiq_job(user_compliance_info.reload.id)
        end
      end
    end

    describe "#generate_tax_information_document" do
      it_behaves_like "generating tax documents", GenerateTaxInformationDocumentJob
    end

    describe "#generate_irs_tax_forms" do
      it_behaves_like "generating tax documents", GenerateIrsTaxFormsJob
    end

    describe "#requires_w9?" do
      context "when the user is a US resident" do
        subject(:info) { build(:user_compliance_info, :confirmed, country_code: "US", citizenship_country_code: "US") }

        it "returns true" do
          expect(info.requires_w9?).to eq true
        end
      end

      context "when the user is a US citizen" do
        subject(:info) { build(:user_compliance_info, :confirmed, country_code: "FR", citizenship_country_code: "US") }

        it "returns true" do
          expect(info.requires_w9?).to eq true
        end
      end

      context "when the user is not a US resident" do
        subject(:info) { build(:user_compliance_info, :confirmed, country_code: "FR", citizenship_country_code: "FR") }

        it "returns false" do
          expect(info.requires_w9?).to eq false
        end
      end
    end

    describe "#sync_with_quickbooks" do
      let(:user) { create(:user, :without_compliance_info) }
      let(:tax_id) { "111-22-3333" }
      let(:business_name) { "Acme, Inc." }
      let!(:inactive_company_worker) { create(:company_worker, :inactive, user:) }
      let!(:contractor_without_a_contract) { create(:company_worker, user:, without_contract: true) }
      let!(:contractor_without_a_signed_contract) { create(:company_worker, user:, with_unsigned_contract: true) }

      context "for an active contractor" do
        let!(:company_worker_1) { create(:company_worker, user:) }
        let!(:company_worker_2) { create(:company_worker, user:) }

        context "for a new record" do
          context "when no other compliance infos exist" do
            it "schedules a QuickBooks data sync job" do
              expect do
                create(:user_compliance_info, user:)
              end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

              expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
              expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
            end
          end

          context "when other compliance infos exist" do
            before { create(:user_compliance_info, user:, tax_id:, business_name:) }

            context "but tax_id and business_name are the same as the prior compliance info" do
              it "does not schedule a QuickBooks data sync job" do
                expect do
                  create(:user_compliance_info, user:, tax_id:, business_name:)
                end.not_to change { QuickbooksDataSyncJob.jobs.size }
              end
            end

            context "and tax_id differs from the the prior compliance info" do
              it "schedules a QuickBooks data sync job" do
                expect do
                  create(:user_compliance_info, user:, tax_id: "44-55-6666", business_name:)
                end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

                expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
                expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
              end
            end

            context "and business_name differs from the the prior compliance info" do
              it "schedules a QuickBooks data sync job" do
                expect do
                  create(:user_compliance_info, user:, tax_id:, business_name: "Acme Consulting, Inc.")
                end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

                expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
                expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
              end
            end
          end
        end

        context "for an updated record" do
          let!(:user_compliance_info) { create(:user_compliance_info, user:, tax_id:, business_name:) }

          it "does not schedule a QuickBooks data sync job if neither tax_id nor business_name have changed" do
            expect do
              user_compliance_info.update!(legal_name: "Elmer Fudd")
            end.not_to change { QuickbooksDataSyncJob.jobs.size }
          end

          it "schedules a QuickBooks data sync job if tax_id has changed" do
            expect do
              user_compliance_info.update!(tax_id: "44-55-6666")
            end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

            expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
            expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
          end

          it "schedules a QuickBooks data sync job if business_name has changed" do
            expect do
              user_compliance_info.update!(business_name: "Acme Consulting, Inc.")
            end.to change { QuickbooksDataSyncJob.jobs.size }.by(2)

            expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_1.company_id, "CompanyWorker", company_worker_1.id)
            expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker_2.company_id, "CompanyWorker", company_worker_2.id)
          end

          it "does not schedule a QuickBooks data sync job if tax_id or business_name has changed but the record is deleted" do
            expect do
              user_compliance_info.update!(tax_id: "44-55-6666", business_name: "Acme Consulting, Inc.", deleted_at: Time.current)
            end.not_to change { QuickbooksDataSyncJob.jobs.size }
          end
        end
      end

      context "for a user who is not an active contractor" do
        it "does not schedule a QuickBooks data sync job" do
          expect do
            create(:user_compliance_info, user:)
          end.not_to change { QuickbooksDataSyncJob.jobs.size }
        end
      end
    end

    describe "#update_tax_id_status" do
      let(:user) { create(:user, :without_compliance_info) }

      it "does nothing if tax_id_status was explicitly set" do
        user_compliance_info = build(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED)
        expect do
          user_compliance_info.save!
        end.not_to change { user_compliance_info.tax_id_status }

        user_compliance_info.tax_id_status = UserComplianceInfo::TAX_ID_STATUS_INVALID
        expect do
          user_compliance_info.save!
        end.not_to change { user_compliance_info.reload.tax_id_status }
      end

      context "for a new record" do
        context "when no other compliance infos exist" do
          it "leaves tax_id_status as nil" do
            user_compliance_info = build(:user_compliance_info, user:)
            user_compliance_info.save!
            expect(user_compliance_info.tax_id_status).to eq nil
          end
        end

        context "when other compliance infos exist" do
          let!(:deleted_compliance_info) { create(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_VERIFIED) }
          let!(:prior_compliance_info) { create(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID) }

          it "leaves tax_id_status as nil if the tax-related attributes differ from the prior record" do
            user_compliance_info = build(:user_compliance_info, user:, legal_name: "Jane Q. Flexile")
            user_compliance_info.save!
            expect(user_compliance_info.tax_id_status).to eq nil
          end

          it "sets tax_id_status to the prior record's status if the tax-related attributes are the same" do
            user_compliance_info = build(:user_compliance_info, user:, **prior_compliance_info.attributes.slice(%w[legal_name business_name business_entity tax_id]))
            user_compliance_info.save!
            expect(user_compliance_info.tax_id_status).to eq UserComplianceInfo::TAX_ID_STATUS_INVALID
          end
        end
      end

      context "for an updated record" do
        let!(:user_compliance_info) { create(:user_compliance_info, user:, tax_id_status: UserComplianceInfo::TAX_ID_STATUS_INVALID) }

        it "does nothing if tax-related attributes are unchanged" do
          expect do
            user_compliance_info.update!(street_address: "123 Smith St")
          end.not_to change { user_compliance_info.reload.tax_id_status }
        end

        it "sets tax_id_status to nil if tax-related attributes have changed" do
          expect do
            user_compliance_info.update!(legal_name: "Elmer Fudd")
          end.to change { user_compliance_info.reload.tax_id_status }.from(UserComplianceInfo::TAX_ID_STATUS_INVALID).to(nil)
        end
      end
    end
  end

  describe "#tax_information_document_name" do
    let(:user_compliance_info) { build(:user_compliance_info, user:, business_entity:) }

    context "when user is a US resident" do
      let(:user) { create(:user, country_code: "US", citizenship_country_code: "RO") }

      context "and is an individual" do
        let(:business_entity) { false }

        it "returns the W-9 form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_9)
        end
      end

      context "and is a business entity" do
        let(:business_entity) { true }

        it "returns the W-9 form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_9)
        end
      end
    end

    context "when user is a US citizen" do
      let(:user) { create(:user, country_code: "RO", citizenship_country_code: "US") }

      context "and is an individual" do
        let(:business_entity) { false }

        it "returns the W-9 form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_9)
        end
      end

      context "and is a business entity" do
        let(:business_entity) { true }

        it "returns the W-9 form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_9)
        end
      end
    end

    context "when user is not a US citizen or resident" do
      let(:user) { create(:user, country_code: "RO", citizenship_country_code: "RO") }

      context "and is an individual" do
        let(:business_entity) { false }

        it "returns the W-8BEN form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_8BEN)
        end
      end

      context "and is a business entity" do
        let(:business_entity) { true }

        it "returns the W-8BEN-E form name" do
          expect(user_compliance_info.tax_information_document_name).to eq(TaxDocument::FORM_W_8BEN_E)
        end
      end
    end
  end

  describe "#investor_tax_document_name" do
    let(:user_compliance_info) { build(:user_compliance_info, user:) }

    context "when user is a US resident" do
      let(:user) { create(:user, country_code: "US", citizenship_country_code: "RO") }

      it "returns the 1099-DIV form name" do
        expect(user_compliance_info.investor_tax_document_name).to eq(TaxDocument::FORM_1099_DIV)
      end
    end

    context "when user is a US citizen" do
      let(:user) { create(:user, country_code: "RO", citizenship_country_code: "US") }

      it "returns the 1099-DIV form name" do
        expect(user_compliance_info.investor_tax_document_name).to eq(TaxDocument::FORM_1099_DIV)
      end
    end

    context "when user is not a US citizen or resident" do
      let(:user) do
        create(:user, country_code: "RO", citizenship_country_code: "RO")
      end

      it "returns the 1042-S form name" do
        expect(user_compliance_info.investor_tax_document_name).to eq(TaxDocument::FORM_1042_S)
      end
    end
  end

  describe "#mark_deleted!" do
    let(:user_compliance_info) { create(:user_compliance_info) }
    let(:user) { user_compliance_info.user }

    shared_examples_for "common assertions" do
      it "marks the user compliance info and corresponding records as deleted" do
        user_compliance_info.mark_deleted!
        expect(user_compliance_info.reload).to be_deleted
        expect(form_1099_nec.reload).to be_deleted
        expect(tax_document.reload).to_not be_deleted
        expect(submitted_1099_nec).to_not be_deleted
      end

      context "when there are already deleted records for the same tax year" do
        let!(:deleted_1099_nec) do
          create(:tax_document, :deleted, :form_1099nec, user_compliance_info:, tax_year: 2023)
        end

        it "marks the user compliance info and corresponding records as deleted" do
          user_compliance_info.mark_deleted!
          expect(user_compliance_info.reload).to be_deleted
          expect(form_1099_nec.reload).to be_deleted
          expect(tax_document.reload).to_not be_deleted
          expect(submitted_1099_nec).to_not be_deleted
          expect(deleted_1099_nec).to be_deleted
        end
      end

      context "when there are paid dividends attached to the user compliance info" do
        let!(:form_1099_div) { create(:tax_doc, :form_1099div, user_compliance_info:) }

        before { create(:dividend, :paid, user_compliance_info:) }

        it "marks the user compliance info as deleted and only deletes unsigned non-dividend tax documents" do
          user_compliance_info.mark_deleted!
          expect(user_compliance_info.reload).to be_deleted
          expect(form_1099_nec.reload).to be_deleted
          expect(tax_document.reload).to_not be_deleted
          expect(submitted_1099_nec).to_not be_deleted
          expect(form_1099_div.reload).to_not be_deleted
        end

        context "with 1042-S forms" do
          let!(:form_1042_s) { create(:tax_doc, :form_1042s, user_compliance_info:) }

          it "preserves dividend-related tax documents" do
            user_compliance_info.mark_deleted!
            expect(form_1042_s.reload).to_not be_deleted
          end
        end
      end
    end

    let!(:tax_document) { create(:tax_doc, :form_w9, user_compliance_info:) }
    let!(:form_1099_nec) { create(:tax_doc, :form_1099nec, year: 2023, user_compliance_info:, signed: false) }
    let!(:submitted_1099_nec) { create(:tax_doc, :form_1099nec, year: 2022, user_compliance_info:, signed: true) }

    include_examples "common assertions"
  end
end
