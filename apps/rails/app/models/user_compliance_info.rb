# frozen_string_literal: true

class UserComplianceInfo < ApplicationRecord
  include Deletable

  TAX_ID_STATUS_VERIFIED = "verified"
  TAX_ID_STATUS_INVALID = "invalid"

  normalizes :tax_id, with: -> { _1.delete("^0-9A-Z") }

  belongs_to :user

  has_many :tax_documents
  has_many :documents
  has_many :dividends

  validates :tax_id, :street_address, :city, :state,
            :zip_code, :country_code, :citizenship_country_code,
            :legal_name, presence: true, if: -> { alive? && tax_information_confirmed_at? }
  validates :business_name, presence: true, if: -> { alive? && tax_information_confirmed_at? && business_entity? }
  validates :tax_id_status, inclusion: { in: [TAX_ID_STATUS_VERIFIED, TAX_ID_STATUS_INVALID, nil] }, if: :alive?
  validates :tax_classification, presence: true, if: -> { alive? && tax_information_confirmed_at? && llc? }

  encrypts :tax_id

  after_create_commit :delete_outdated_compliance_infos!, unless: :deleted?
  after_commit :generate_tax_information_document, if: -> { alive? && tax_information_confirmed_at? }
  after_commit :generate_irs_tax_forms, if: -> { alive? && tax_information_confirmed_at? }
  after_commit :sync_with_quickbooks, if: -> { alive? && worker? }
  before_save :update_tax_id_status

  delegate :worker?, to: :user

  enum :business_type, {
    llc: 0,
    c_corporation: 1,
    s_corporation: 2,
    partnership: 3,
  }

  enum :tax_classification, {
    c_corporation: 0,
    s_corporation: 1,
    partnership: 2,
  }, prefix: true

  def requires_w9? = [citizenship_country_code, country_code].include?("US")

  def tax_information_document_name
    case
    when requires_w9?
      TaxDocument::FORM_W_9
    when business_entity?
      TaxDocument::FORM_W_8BEN_E
    else
      TaxDocument::FORM_W_8BEN
    end
  end

  def investor_tax_document_name
    requires_w9? ? TaxDocument::FORM_1099_DIV : TaxDocument::FORM_1042_S
  end

  def mark_deleted!
    docs = documents.tax_document.unsigned
    docs = docs.where.not(name: [TaxDocument::FORM_1099_DIV, TaxDocument::FORM_1042_S]) if dividends.paid.any?
    docs.each(&:mark_deleted!)
    super
  end

  private
    def delete_outdated_compliance_infos!
      user.user_compliance_infos.alive.where.not(id:).each(&:mark_deleted!)
    end

    def generate_tax_information_document
      GenerateTaxInformationDocumentJob.perform_async(id)
    end

    def generate_irs_tax_forms
      GenerateIrsTaxFormsJob.perform_async(id)
    end

    def sync_with_quickbooks
      return unless OnboardingState::Worker.new(user:, company: user.company_workers.first!.company).complete?

      columns_synced_with_quickbooks = %w[tax_id business_name]

      should_sync = if previous_changes.include?(:id)
        prior_compliance_info.nil? || prior_compliance_info.attributes.values_at(*columns_synced_with_quickbooks) != attributes.values_at(*columns_synced_with_quickbooks)
      else
        previous_changes.keys.intersect?(columns_synced_with_quickbooks)
      end

      return unless should_sync

      array_of_args = user.company_workers.active.with_signed_contract.map do |company_worker|
        [company_worker.company_id, company_worker.class.name, company_worker.id]
      end
      QuickbooksDataSyncJob.perform_bulk(array_of_args)
    end

    def update_tax_id_status
      return if tax_id_status_changed?

      tax_status_related_attributes = %w[legal_name business_name business_entity tax_id]

      if persisted?
        self.tax_id_status = nil if tax_status_related_attributes.any? { send("#{_1}_changed?") }
      elsif prior_compliance_info.present? && prior_compliance_info.attributes.values_at(*tax_status_related_attributes) == attributes.values_at(*tax_status_related_attributes)
        self.tax_id_status = prior_compliance_info.tax_id_status
      end
    end

    def prior_compliance_info
      return @_prior_compliance_info if defined?(@_prior_compliance_info)
      @_prior_compliance_info = user.user_compliance_infos.where.not(id:).order(id: :desc).take
    end
end
