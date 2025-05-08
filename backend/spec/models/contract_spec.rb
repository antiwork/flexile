# frozen_string_literal: true

RSpec.describe Contract do
  describe "associations" do
    it { is_expected.to belong_to(:company_administrator) }
    it { is_expected.to belong_to(:company) }
    it { is_expected.to belong_to(:user) }
    it { is_expected.to belong_to(:equity_grant).optional }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:administrator_signature) }
    it { is_expected.to validate_presence_of(:signed_at).on(:update) }
    it { is_expected.to validate_presence_of(:contractor_signature).on(:update) }
    it { is_expected.to validate_presence_of(:name) }

    it "validates presence of `company_worker` only for consulting contracts" do
      consulting_contract = build(:contract)
      equity_contract = build(:equity_plan_contract)
      share_certificate = build(:contract, :certificate)

      expect(consulting_contract).to validate_presence_of(:company_worker)
      expect(equity_contract).not_to validate_presence_of(:company_worker)
      expect(share_certificate).not_to validate_presence_of(:company_worker)
    end

    context "when equity_options_plan is true" do
      subject { build(:contract, equity_options_plan: true) }

      it { is_expected.to validate_presence_of(:equity_grant_id) }
      it { is_expected.to validate_presence_of(:attachment) }
    end

    context "when equity_options_plan is false" do
      subject { build(:contract) }

      it { is_expected.not_to validate_presence_of(:equity_grant_id) }
      it { is_expected.not_to validate_presence_of(:attachment) }
    end
  end

  describe "callbacks" do
    describe "#sync_contractor_with_quickbooks" do
      it "does not schedule a QuickBooks data sync job upon creation" do
        expect do
          create(:contract)
        end.to change { QuickbooksDataSyncJob.jobs.size }.by(0)
      end

      it "schedules a QuickBooks data sync job for contractor upon signing the consulting contract" do
        company_worker = create(:company_worker)
        contract = create(:contract, company_worker:)

        expect do
          contract.update!(signed_at: Time.current, contractor_signature: company_worker.user.legal_name)
        end.to change { QuickbooksDataSyncJob.jobs.size }.by(1)

        expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company_worker.company_id, "CompanyWorker", company_worker.id)
      end

      it "doesn't schedule a QuickBooks data sync job for contractor upon signing a different kind of document" do
        company_worker = create(:company_worker)
        equity_contract = create(:equity_plan_contract, company_worker:)
        share_certificate = create(:contract, :certificate, company_worker:)

        expect do
          equity_contract.update!(signed_at: Time.current, contractor_signature: company_worker.user.legal_name)
          share_certificate.update!(signed_at: Time.current, contractor_signature: company_worker.user.legal_name)
        end.to change { QuickbooksDataSyncJob.jobs.size }.by(0)
      end
    end
  end
end
