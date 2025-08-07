# frozen_string_literal: true

class User < ApplicationRecord
  has_paper_trail

  devise :invitable, :database_authenticatable

  include ExternalId, Flipper::Identifier, DeviseInternal, OtpAuthentication

  NON_TAX_COMPLIANCE_ATTRIBUTES = %i[legal_name birth_date country_code citizenship_country_code street_address city state zip_code]
  USER_PROVIDED_TAX_ATTRIBUTES = %i[tax_id business_entity business_name business_type tax_classification]
  TAX_ATTRIBUTES = USER_PROVIDED_TAX_ATTRIBUTES + %i[tax_id_status tax_information_confirmed_at]
  COMPLIANCE_ATTRIBUTES = NON_TAX_COMPLIANCE_ATTRIBUTES + USER_PROVIDED_TAX_ATTRIBUTES
  CONSULTING_CONTRACT_ATTRIBUTES = %i[email legal_name business_entity business_name street_address city state zip_code country_code citizenship_country_code] # should include all attributes that are referenced in the consulting contract
  MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS = 1_000_00
  MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS = 0
  MIN_EMAIL_LENGTH = 5 # Must match constant MIN_EMAIL_LENGTH in TS
  MAX_PREFERRED_NAME_LENGTH = 50 # Must match constant MAX_PREFERRED_NAME_LENGTH in TS

  attr_accessor :signature

  has_many :company_administrators
  has_many :companies, -> { order("company_administrators.created_at") }, through: :company_administrators

  has_many :company_lawyers
  has_many :represented_companies, -> { order("company_lawyers.created_at") }, through: :company_lawyers, source: :company

  has_many :company_workers
  has_many :clients, -> { order(CompanyWorker.arel_table[:created_at]) }, through: :company_workers, source: :company
  has_many :document_signatures
  has_many :documents, through: :document_signatures do
    def unsigned_contracts
      where(documents: { document_signatures: { signed_at: nil } }, document_type: :consulting_contract)
    end
  end

  has_many :company_investors
  has_many :portfolio_companies, -> { order("company_investors.created_at") }, through: :company_investors, source: :company

  has_many :dividends, through: :company_investors
  has_many :tos_agreements
  has_many :invoices
  has_many :invoice_approvals, foreign_key: :approver_id
  has_many :bank_accounts, class_name: "WiseRecipient"
  has_one :bank_account, -> { alive.where(used_for_invoices: true) }, class_name: "WiseRecipient"
  has_one :bank_account_for_dividends, -> { alive.where(used_for_dividends: true) }, class_name: "WiseRecipient"

  has_many :user_compliance_infos, autosave: true
  has_one :compliance_info, -> { alive.order(tax_information_confirmed_at: :desc) }, class_name: "UserComplianceInfo"

  has_one_attached :avatar

  belongs_to :signup_invite_link, class_name: "CompanyInviteLink", optional: true

  validates :email, presence: true, length: { minimum: MIN_EMAIL_LENGTH }
  validates :legal_name,
            format: { with: /\S+\s+\S+/, message: "requires at least two parts", allow_nil: true }
  validates :minimum_dividend_payment_in_cents, presence: true
  validate :minimum_dividend_payment_in_cents_is_within_range
  validates :preferred_name, length: { maximum: MAX_PREFERRED_NAME_LENGTH }, allow_nil: true

  after_update_commit :sync_with_quickbooks, if: :worker?
  after_update_commit :update_dividend_status,
                      if: -> { current_sign_in_at_previously_changed? && current_sign_in_at_previously_was.nil? }

  delegate(*TAX_ATTRIBUTES, to: :compliance_info, allow_nil: true)

  def name
    preferred_name.presence || legal_name.presence
  end

  def display_name
    name.presence || display_email
  end

  def display_email
    email.presence || unconfirmed_email
  end

  def display_country
    ISO3166::Country[country_code]&.common_name || "Not Specified"
  end

  def display_citizenship_country
    ISO3166::Country[citizenship_country_code]&.common_name || "Not Specified"
  end

  def business_entity?
    !!compliance_info&.business_entity?
  end

  def tax_id_name
    business_entity? ? "EIN" : "SSN or ITIN"
  end

  def billing_entity_name
    business_entity? ? business_name : legal_name
  end

  def requires_w9? = [citizenship_country_code, country_code].include?("US")

  def sanctioned_country_resident? = SANCTIONED_COUNTRY_CODES.include?(country_code)

  def restricted_payout_country_resident? = !SUPPORTED_COUNTRY_CODES.include?(country_code)

  def compliance_attributes
    (COMPLIANCE_ATTRIBUTES + [:tax_information_confirmed_at, :signature]).index_with { |attr| send(attr) }
  end

  def has_verified_tax_id?
    tax_id.present? && (!requires_w9? || tax_id_status == UserComplianceInfo::TAX_ID_STATUS_VERIFIED)
  end

  def company_administrator_for(company)
    company_administrators.find_by(company:)
  end

  def company_administrator_for?(company)
    company_administrator_for(company).present?
  end

  def company_lawyer_for(company)
    company_lawyers.find_by(company:)
  end

  def company_lawyer_for?(company)
    company_lawyer_for(company).present?
  end

  def company_worker_for(company)
    company_workers.find_by(company:)
  end

  def company_worker_for?(company)
    company_worker_for(company).present?
  end

  def company_investor_for(company)
    company_investors.find_by(company:)
  end

  def company_investor_for?(company)
    company_investor_for(company).present?
  end

  def company_worker_invitation_for?(company)
    signup_invite_link.present? && signup_invite_link.company == company
  end

  def build_compliance_info(attributes)
    user_compliance_infos.build(compliance_attributes.merge(attributes))
  end

  def all_companies
    (companies + clients + portfolio_companies + represented_companies).uniq
  end

  def worker?
    company_workers.exists?
  end

  def investor?
    company_investors.exists?
  end

  def administrator?
    company_administrators.exists?
  end

  def lawyer?
    company_lawyers.exists?
  end



  def password_required?
    false
  end

  def has_personal_details?
    legal_name.present? && citizenship_country_code.present?
  end

  def should_regenerate_consulting_contract?(changeset)
    CONSULTING_CONTRACT_ATTRIBUTES.any? do |attr|
      changeset[attr].present? && send(attr) != changeset[attr]
    end
  end

  private
    def sync_with_quickbooks
      return unless has_personal_details?

      columns_synced_with_quickbooks = %w[email unconfirmed_email preferred_name legal_name
                                          city street_address zip_code country_code state]

      if previous_changes.keys.intersect?(columns_synced_with_quickbooks)
        array_of_args = company_workers.active.with_signed_contract.map do |company_worker|
          [company_worker.company_id, company_worker.class.name, company_worker.id]
        end
        QuickbooksDataSyncJob.perform_bulk(array_of_args)
      end
    end

    def update_dividend_status
      dividends.pending_signup.each do |dividend|
        dividend.update!(status: Dividend::ISSUED)
      end
    end

    def minimum_dividend_payment_in_cents_is_within_range
      return if minimum_dividend_payment_in_cents.blank?

      if minimum_dividend_payment_in_cents < MIN_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS ||
         minimum_dividend_payment_in_cents > MAX_MINIMUM_DIVIDEND_PAYMENT_IN_CENTS
        errors.add(:base, "Minimum dividend payment amount must be between $0 and $1,000")
      end
    end
end
