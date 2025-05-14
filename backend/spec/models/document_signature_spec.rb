# frozen_string_literal: true

RSpec.describe DocumentSignature do
  describe "associations" do
    it { is_expected.to belong_to(:document) }
    it { is_expected.to belong_to(:user) }
  end

  describe "validations" do
    it { is_expected.to validate_presence_of(:title) }
  end

  describe "callbacks" do
    it "syncs the contractor with Quickbooks" do
      company = create(:company)
      company_worker = create(:company_worker, company:, without_contract: true)
      user = company_worker.user
      create(:document, company:, signatories: [user], signed: false)

      user.document_signatures.first.update!(signed_at: Time.current)
      expect(QuickbooksDataSyncJob).to have_enqueued_sidekiq_job(company.id, CompanyWorker.name, company_worker.id)
    end
  end
end
