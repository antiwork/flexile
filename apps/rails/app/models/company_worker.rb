# frozen_string_literal: true

class CompanyWorker < ApplicationRecord
  self.table_name = "company_contractors"

  include QuickbooksIntegratable, Serializable, Searchable, ExternalId

  belongs_to :company
  belongs_to :user
  belongs_to :company_role

  has_many :contracts, foreign_key: :company_contractor_id
  has_many :equity_allocations, foreign_key: :company_contractor_id
  has_many :invoices, foreign_key: :company_contractor_id
  has_many :company_worker_updates, foreign_key: :company_contractor_id
  has_many :integration_records, as: :integratable
  has_many :expense_cards, foreign_key: :company_contractor_id
  has_many :expense_card_charges, through: :expense_cards
  has_one :active_expense_card, -> { where(active: true) }, class_name: "ExpenseCard", foreign_key: :company_contractor_id
  has_many :company_worker_absences, foreign_key: :company_contractor_id

  DEFAULT_HOURS_PER_WEEK = 20
  WORKING_WEEKS_PER_YEAR = 44
  MAX_EQUITY_PERCENTAGE = 100
  MIN_COMPENSATION_AMOUNT_FOR_1099_NEC = 600_00

  enum :pay_rate_type, {
    hourly: 0,
    project_based: 1,
    salary: 2,
  }, validate: true

  validates :user_id, uniqueness: { scope: :company_id }
  validates :started_at, presence: true
  validates :hours_per_week, presence: true,
                             numericality: { only_integer: true, greater_than: 0 },
                             if: :hourly?
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validate :only_hourly_contractor_can_be_on_trial

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
  scope :with_signed_contract, -> {
    joins("JOIN document_signatures ON document_signatures.user_id = company_contractors.user_id AND " \
            "document_signatures.signed_at IS NOT NULL").
      joins("JOIN documents ON documents.id = document_signatures.document_id AND " \
            "documents.deleted_at IS NULL AND " \
            "documents.company_id = company_contractors.company_id AND " \
            "documents.document_type = #{Document.document_types[:consulting_contract]}").
      distinct
  }
  scope :with_required_tax_info_for, -> (tax_year:) do
    invoices_subquery = Invoice.select("company_contractor_id")
                               .for_tax_year(tax_year)
                               .group("company_contractor_id")
                               .having("SUM(cash_amount_in_cents) >= ?", MIN_COMPENSATION_AMOUNT_FOR_1099_NEC)

    joins(:company).merge(Company.active.irs_tax_forms)
      .joins(user: :compliance_info).merge(User.where(country_code: "US"))
      .where(id: invoices_subquery)
      .where.not(pay_rate_type: :salary)
  end
  scope :with_updates_for_period, -> (period) do
    joins(:company_worker_updates)
      .where(CompanyWorkerUpdate.arel_table.name => {
        period_starts_on: period.starts_on,
        period_ends_on: period.ends_on,
        published_at: ..Time.current,
      })
      .distinct
  end
  scope :with_absences_for_period, -> (period) do
    joins(:company_worker_absences)
      .merge(CompanyWorkerAbsence.for_period(starts_on: period.starts_on, ends_on: period.ends_on))
      .distinct
  end
  scope :not_on_trial, -> { where(on_trial: false) }
  scope :on_trial, -> { where(on_trial: true) }

  after_commit :notify_rate_updated, on: :update, if: -> { saved_change_to_pay_rate_in_subunits? && hourly? }

  def equity_allocation_for(year)
    equity_allocations.find_by(year:)
  end

  def equity_percentage(year)
    equity_allocations.find_by(year:)&.equity_percentage
  end

  def can_create_expense_card?
    active? && !on_trial? && company_role&.expense_card_enabled?
  end

  def active? = ended_at.nil?

  def avg_yearly_usd
    (pay_rate_in_subunits / 100) * hours_per_week * WORKING_WEEKS_PER_YEAR
  end

  def alumni?
    ended_at?
  end

  def end_contract!
    return if alumni?

    update!(ended_at: Time.current)
    CompanyWorkerMailer.contract_ended(company_worker_id: id).deliver_later
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
    def only_hourly_contractor_can_be_on_trial
      if on_trial? && !hourly?
        errors.add(:base, "Can only set trials with hourly contracts")
      end
    end

    def notify_rate_updated
      sync_with_quickbooks
    end

    def sync_with_quickbooks
      QuickbooksDataSyncJob.perform_async(company_id, self.class.name, id)
    end
end
