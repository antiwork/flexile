# frozen_string_literal: true

class Document < ApplicationRecord
  include Deletable

  belongs_to :company
  belongs_to :user_compliance_info, optional: true
  belongs_to :equity_grant, optional: true

  has_many :signatures, class_name: "DocumentSignature"
  has_many :signatories, through: :signatures, source: :user

  has_many_attached :attachments

  FORM_1099_DIV = "1099-DIV" # Dividends and Distributions
  FORM_1099_NEC = "1099-NEC" # Nonemployee Compensation
  FORM_W_9 = "W-9"
  FORM_1042_S = "1042-S"
  FORM_W_8BEN = "W-8BEN"
  FORM_W_8BEN_E = "W-8BEN-E"
  SUPPORTED_TAX_INFORMATION_NAMES = [
    FORM_W_9,
    FORM_W_8BEN,
    FORM_W_8BEN_E,
  ].freeze
  SUPPORTED_IRS_TAX_FORM_NAMES = [
    FORM_1099_NEC,
    FORM_1099_DIV,
    FORM_1042_S,
  ].freeze
  ALL_SUPPORTED_TAX_FORM_NAMES = SUPPORTED_TAX_INFORMATION_NAMES + SUPPORTED_IRS_TAX_FORM_NAMES

  validates_associated :signatures
  validates :name, presence: true
  validates :document_type, presence: true
  validates :year, presence: true, numericality: { only_integer: true, less_than_or_equal_to: Date.current.year }
  validates :user_compliance_info_id, presence: true, if: :tax_document?
  validates :equity_grant_id, presence: true, if: -> { equity_plan_contract? }
  validates :name, inclusion: { in: ALL_SUPPORTED_TAX_FORM_NAMES }, if: :tax_document?
  validate :tax_document_must_be_unique, if: :tax_document?

  enum :document_type, {
    consulting_contract: 0,
    equity_plan_contract: 1,
    share_certificate: 2,
    tax_document: 3,
    exercise_notice: 4,
    release_agreement: 5,
  }

  scope :irs_tax_forms, -> { tax_document.where(name: SUPPORTED_IRS_TAX_FORM_NAMES) }
  scope :unsigned, -> { joins(:signatures).where(signatures: { signed_at: nil }) }

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
    def tax_document_must_be_unique
      return if deleted?
      return if self.class.alive.tax_document.where.not(id:).where(name:, year:, user_compliance_info:, company:).none?

      errors.add(:base, "A tax form with the same name, company, and year already exists for this user")
    end
end
