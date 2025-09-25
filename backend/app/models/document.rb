# frozen_string_literal: true

class Document < ApplicationRecord
  include Deletable

  belongs_to :company
  belongs_to :user_compliance_info, optional: true
  belongs_to :equity_grant, optional: true

  has_many :signatures, class_name: "DocumentSignature"
  has_many :signatories, through: :signatures, source: :user

  has_many_attached :attachments

  SUPPORTED_TAX_INFORMATION_TYPES = %i[form_w_9 form_w_8ben form_w_8ben_e].freeze
  TAX_FORM_TYPES = %i[form_1099_nec form_1099_div form_1042_s form_w_9 form_w_8ben form_w_8ben_e].freeze

  validates_associated :signatures
  validates :document_type, presence: true
  validates :year, presence: true, numericality: { only_integer: true, less_than_or_equal_to: Date.current.year }
  validates :user_compliance_info_id, presence: true, if: :tax_document?
  validates :equity_grant_id, presence: true, if: -> { equity_plan_contract? }
  validate :tax_document_must_be_unique, if: :tax_document?

  enum :document_type, {
    consulting_contract: 0,
    equity_plan_contract: 1,
    share_certificate: 2,
    form_1099_nec: 3,
    exercise_notice: 4,
    release_agreement: 5,
    form_1099_div: 6,
    form_1042_s: 7,
    form_w_9: 8,
    form_w_8ben: 9,
    form_w_8ben_e: 10,
  }

  scope :irs_tax_forms, -> { tax_document.where(document_type: %i[form_1099_nec form_1099_div form_1042_s]) }
  scope :tax_document, -> { where(document_type: TAX_FORM_TYPES) }
  scope :unsigned, -> { joins(:signatures).where(signatures: { signed_at: nil }) }

  def fetch_serializer(namespace: nil)
    raise "Document type not supported" unless tax_document?

    namespace ||= "TaxDocuments"
    serializer = "Form#{document_type.capitalize}Serializer"
    "#{namespace}::#{serializer}".constantize.new(user_compliance_info, year, company)
  end

  def live_attachment
    attachments.order(id: :desc).take
  end

  def tax_document?
    document_type.in?(TAX_FORM_TYPES)
  end

  def name
    case document_type
    when :consulting_contract
      "Consulting Contract"
    when :equity_plan_contract
      "Equity Plan Contract"
    when :share_certificate
      "Share Certificate"
    when :form_1099_nec
      "1099-NEC"
    when :exercise_notice
      "Exercise Notice"
    when :release_agreement
      "Release Agreement"
    when :form_1099_div
      "1099-DIV"
    when :form_1042_s
      "1042-S"
    when :form_w_9
      "W-9"
    when :form_w_8ben
      "1099-DIV"
    when :form_w_8ben_e
      "W-8BEN-E"
    end
  end

  private
    def tax_document_must_be_unique
      return if deleted?
      return if self.class.alive.tax_document.where.not(id:).where(document_type:, year:, user_compliance_info:, company:).none?

      errors.add(:base, "A tax form with the same type, company, and year already exists for this user")
    end
end
