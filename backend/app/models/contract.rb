# frozen_string_literal: true

# TODO (techdebt): remove this model. It is legacy and we've migrated to using the `Document` model

class Contract < ApplicationRecord
  belongs_to :company_administrator
  belongs_to :company_worker, optional: true, foreign_key: :company_contractor_id
  belongs_to :company
  belongs_to :user
  belongs_to :equity_grant, optional: true

  has_one_attached :attachment

  CONSULTING_CONTRACT_NAME = "Consulting agreement"

  validates :administrator_signature, presence: true
  validates :signed_at, :contractor_signature, presence: true, on: :update
  validates :name, presence: true
  validates :equity_grant_id, :attachment, presence: true, if: -> { equity_options_plan? }
  validates :company_worker, presence: :true, if: -> { !equity_options_plan? && !certificate? }

  scope :signed, -> { where.not(signed_at: nil) }
  scope :equity_options_plan, -> { where(equity_options_plan: true) }
  scope :not_equity_options_plan, -> { where(equity_options_plan: false) }
  scope :certificate, -> { where(certificate: true) }

  after_update_commit :sync_contractor_with_quickbooks, if: :saved_change_to_signed_at?

  private
    def sync_contractor_with_quickbooks
      return if equity_options_plan? || certificate?

      QuickbooksDataSyncJob.perform_async(company_worker.company_id, company_worker.class.name, company_contractor_id)
    end
end
