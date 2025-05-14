# frozen_string_literal: true

class DocumentSignature < ApplicationRecord
  belongs_to :document
  belongs_to :user

  validates :title, presence: true

  after_update_commit :sync_contractor_with_quickbooks, if: :saved_change_to_signed_at?

  private
    def sync_contractor_with_quickbooks
      return unless document.consulting_contract?

      company_worker = user.company_worker_for(document.company)
      QuickbooksDataSyncJob.perform_async(company_worker.company_id, company_worker.class.name, company_worker.id) if company_worker.present?
    end
end
