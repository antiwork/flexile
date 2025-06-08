# frozen_string_literal: true

# TODO (techdebt): remove this model. It is legacy and we've migrated to using the `Document` model

class TaxDocument < ApplicationRecord
  include Deletable, Serializable

  belongs_to :user_compliance_info
  belongs_to :company

  has_one_attached :attachment

  enum :status, {
    initialized: "initialized",
    submitted: "submitted",
    deleted: "deleted",
  }, prefix: true

  # Possible tax form names
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

  validates :attachment, presence: true
  validates :tax_year, numericality: { only_integer: true, less_than_or_equal_to: Date.today.year }
  validates :name, inclusion: { in: ALL_SUPPORTED_TAX_FORM_NAMES }
  validates :status, inclusion: { in: statuses.values }
  validate :tax_document_must_be_unique

  scope :irs_tax_forms, -> { where(name: SUPPORTED_IRS_TAX_FORM_NAMES) }

  def mark_deleted!
    self.status = self.class.statuses[:deleted]
    super
  end

  def fetch_serializer(namespace: nil)
    namespace ||= self.class.name.pluralize
    serializer = "Form#{name.delete("-").capitalize}Serializer"
    "#{namespace}::#{serializer}".constantize.new(user_compliance_info, tax_year)
  end

  private
    def tax_document_must_be_unique
      return if status_deleted?
      return if self.class.not_status_deleted.where.not(id:).where(name:, tax_year:, user_compliance_info:).none?

      errors.add(:base, "A tax form with the same name and tax year already exists for this user")
    end
end
