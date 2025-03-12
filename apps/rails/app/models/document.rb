# frozen_string_literal: true

class Document < ApplicationRecord
  include Deletable

  belongs_to :company
  belongs_to :user
  belongs_to :user_compliance_info, optional: true
  belongs_to :company_administrator, optional: true
  belongs_to :company_worker, optional: true, foreign_key: :company_contractor_id
  belongs_to :equity_grant, optional: true

  has_many_attached :attachments

  validates :name, presence: true
  validates :document_type, presence: true
  validates :year, presence: true, numericality: { only_integer: true, less_than_or_equal_to: Date.current.year }
  validates :user_compliance_info_id, presence: true, if: :tax_document?
  validates :company_administrator_id, presence: true, if: -> { consulting_contract? || equity_plan_contract? || exercise_notice? }
  validates :company_worker, presence: true, if: -> { consulting_contract? || equity_plan_contract? || exercise_notice? }
  validates :equity_grant_id, presence: true, if: -> { equity_plan_contract? || board_approval? }
  validates :name, inclusion: { in: TaxDocument::ALL_SUPPORTED_TAX_FORM_NAMES }, if: :tax_document?
  validate :tax_document_must_be_unique, if: :tax_document?
  validate :signatures_and_completed_at_are_present, if: -> { consulting_contract? || equity_plan_contract? }

  after_update_commit :sync_contractor_with_quickbooks, if: :saved_change_to_completed_at?

  enum :document_type, {
    consulting_contract: 0,
    equity_plan_contract: 1,
    share_certificate: 2,
    tax_document: 3,
    exercise_notice: 4,
    board_approval: 5,
  }

  scope :irs_tax_forms, -> { tax_document.where(name: TaxDocument::SUPPORTED_IRS_TAX_FORM_NAMES) }

  def fetch_serializer(namespace: nil)
    raise "Document type not supported" unless tax_document?

    namespace ||= "TaxDocuments"
    serializer = "Form#{name.delete("-").capitalize}Serializer"
    "#{namespace}::#{serializer}".constantize.new(user_compliance_info, year, company)
  end

  def live_attachment
    attachments.order(id: :desc).take
  end

  private
    def sync_contractor_with_quickbooks
      return unless consulting_contract?

      QuickbooksDataSyncJob.perform_async(company_worker.company_id, company_worker.class.name, company_contractor_id)
    end

    def tax_document_must_be_unique
      return if deleted?
      return if self.class.alive.tax_document.where.not(id:).where(name:, year:, user_compliance_info:, company:).none?

      errors.add(:base, "A tax form with the same name, company, and year already exists for this user")
    end

    def signatures_and_completed_at_are_present
      return unless consulting_contract? || equity_plan_contract?

      fully_signed = contractor_signature.present? && administrator_signature.present?
      if completed_at.blank?
        errors.add(:completed_at, "must be present") if fully_signed
      end
    end
end
