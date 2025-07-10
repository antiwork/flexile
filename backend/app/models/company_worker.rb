# frozen_string_literal: true

class CompanyWorker < ApplicationRecord
  self.table_name = "company_contractors"

  include QuickbooksIntegratable, Serializable, Searchable, ExternalId

  belongs_to :company
  belongs_to :user

  has_many :contracts, foreign_key: :company_contractor_id
  has_many :equity_allocations, foreign_key: :company_contractor_id
  has_many :invoices, foreign_key: :company_contractor_id
  has_many :integration_records, as: :integratable

  MAX_EQUITY_PERCENTAGE = 100
  MIN_COMPENSATION_AMOUNT_FOR_1099_NEC = 600_00

  enum :pay_rate_type, {
    hourly: 0,
    project_based: 1,
  }, validate: true

  validates :user_id, uniqueness: { scope: :company_id }
  validates :role, presence: true
  validates :started_at, presence: true
  validates :pay_rate_in_subunits, numericality: { only_integer: true, greater_than: 0, allow_nil: true }

  scope :active, -> { where(ended_at: nil) }
  scope :active_as_of, ->(date) { active.or(where("ended_at > ?", date)) }
  scope :inactive, -> { where.not(ended_at: nil) }
  scope :started_on_or_before, ->(date) { where("started_at <= ?", date) if date.present? }
  scope :starting_after, ->(date) { where("started_at > ?", date) if date.present? }
  scope :not_submitted_invoices, -> (billing_period: nil) {
    current_date = DateTime.current
    billing_period ||= current_date.last_month.beginning_of_month..current_date

    company_workers, invoices = self.arel_table, Invoice.arel_table
    conditions = invoices[:user_id].eq(company_workers[:user_id])
                                   .and(invoices[:invoice_date].between(billing_period))
    join = company_workers.outer_join(invoices)
                              .on(conditions)
                              .join_sources

    joins(join).where(invoices: { id: nil })
  }
  scope :with_signed_contract, -> do
    documents = Document.arel_table
    document_signatures = DocumentSignature.arel_table
    company_workers = self.arel_table

    unsigned_signatures_exist = DocumentSignature.select(1)
      .where(document_signatures[:document_id].eq(documents[:id]))
      .where(document_signatures[:signed_at].eq(nil))
      .arel.exists

    signed_document_ids = Document.select(:id)
      .where(documents[:document_type].eq(Document.document_types[:consulting_contract]))
      .where(documents[:deleted_at].eq(nil))
      .where(unsigned_signatures_exist.not)

    joins(user: :document_signatures)
      .joins("INNER JOIN documents ON documents.id = document_signatures.document_id")
      .where.not(document_signatures: { signed_at: nil })
      .where(documents: { id: signed_document_ids })
      .where(documents[:company_id].eq(company_workers[:company_id]))
      .distinct
  end
  scope :with_required_tax_info_for, -> (tax_year:) do
    invoices_subquery = Invoice.alive.select("company_contractor_id")
                               .for_tax_year(tax_year)
                               .group("company_contractor_id")
                               .having("SUM(cash_amount_in_cents) >= ?", MIN_COMPENSATION_AMOUNT_FOR_1099_NEC)
    joins(:company).merge(Company.active)
      .joins(user: :compliance_info).merge(User.where(country_code: "US"))
      .where(id: invoices_subquery)
  end

  after_commit :notify_rate_updated, on: :update, if: -> { saved_change_to_pay_rate_in_subunits? }

  def equity_allocation_for(year)
    equity_allocations.find_by(year:)
  end

  def equity_percentage(year)
    equity_allocations.find_by(year:)&.equity_percentage
  end

  def active? = ended_at.nil?

  def alumni?
    ended_at?
  end

  def end_contract!
    return if alumni?

    update!(ended_at: Time.current)
  end

  def contract_signed?
    contract_signed_elsewhere ||
      user.documents.joins(:signatures)
          .where(documents: { document_type: Document.document_types[:consulting_contract], deleted_at: nil, company: company })
          .where.not(document_signatures: { signed_at: nil })
          .exists?
  end

  def quickbooks_entity
    "Vendor"
  end

  def fetch_existing_quickbooks_entity
    vendor = IntegrationApi::Quickbooks.new(company_id:).fetch_vendor_by_email_and_name(email: user.email, name: user.billing_entity_name)
    quickbooks_integration_record&.mark_deleted! if vendor.blank?

    vendor
  end

  def unique_unvested_equity_grant_for_year(year)
    company_investors = user.company_investors.where(company:)
    return unless company_investors.count == 1

    grants = company_investors.
               first.
               equity_grants.
               vesting_trigger_invoice_paid.
               where("EXTRACT(YEAR FROM period_ended_at) = ? AND unvested_shares >= 1", year)
    return unless grants.size == 1

    grants.first
  end

  def send_equity_percent_selection_email(year)
    equity_allocation = equity_allocations.find_or_initialize_by(year:)
    return if equity_allocation.equity_percentage? || equity_allocation.sent_equity_percent_selection_email?

    CompanyWorkerMailer.equity_percent_selection(id).deliver_later
    equity_allocation.update!(sent_equity_percent_selection_email: true)
  end

  private
    def notify_rate_updated
      sync_with_quickbooks
    end

    def sync_with_quickbooks
      QuickbooksDataSyncJob.perform_async(company_id, self.class.name, id)
    end
end
