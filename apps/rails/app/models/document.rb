# frozen_string_literal: true

class Document < ApplicationRecord
  include Deletable

  belongs_to :company
  belongs_to :user_compliance_info, optional: true
  belongs_to :equity_grant, optional: true

  has_many :signatures, class_name: "DocumentSignature"
  has_many :signatories, through: :signatures, source: :user

  has_many_attached :attachments

  validates_associated :signatures
  validates :name, presence: true
  validates :document_type, presence: true
  validates :year, presence: true, numericality: { only_integer: true, less_than_or_equal_to: Date.current.year }
  validates :user_compliance_info_id, presence: true, if: :tax_document?
  validates :equity_grant_id, presence: true, if: -> { equity_plan_contract? }
  validates :name, inclusion: { in: TaxDocument::ALL_SUPPORTED_TAX_FORM_NAMES }, if: :tax_document?
  validate :tax_document_must_be_unique, if: :tax_document?

  enum :document_type, {
    consulting_contract: 0,
    equity_plan_contract: 1,
    share_certificate: 2,
    tax_document: 3,
    exercise_notice: 4,
    board_consent: 5,
  }

  scope :irs_tax_forms, -> { tax_document.where(name: TaxDocument::SUPPORTED_IRS_TAX_FORM_NAMES) }
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
