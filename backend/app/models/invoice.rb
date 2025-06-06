# frozen_string_literal: true

class Invoice < ApplicationRecord
  has_paper_trail

  include QuickbooksIntegratable, Searchable, Serializable, Status, ExternalId

  belongs_to :company
  belongs_to :company_worker, foreign_key: :company_contractor_id
  belongs_to :user
  belongs_to :created_by, class_name: "User"
  belongs_to :equity_grant, optional: true
  belongs_to :rejected_by, class_name: "User", optional: true

  enum :invoice_type, { services: "services", other: "other" }, prefix: true, validate: true

  # TODO: Separate 'payment states' and 'approval states' in the next iteration
  # Possible `status` values
  RECEIVED = "received"
  APPROVED = "approved"
  REJECTED = "rejected"
  PAYMENT_PENDING = "payment_pending"

  READ_ONLY_STATES = [APPROVED, PAYMENT_PENDING, PROCESSING, PAID, FAILED]
  EDITABLE_STATES = [RECEIVED, REJECTED]
  OPEN_STATES = [RECEIVED, FAILED, REJECTED, APPROVED]
  COMPANY_PENDING_STATES = [RECEIVED, PROCESSING, APPROVED, FAILED]
  PAID_OR_PAYING_STATES = [PAYMENT_PENDING, PROCESSING, PAID]
  ALL_STATES = READ_ONLY_STATES + EDITABLE_STATES

  MAX_MINUTES = 160 * 60 # 160 hours

  BASE_FLEXILE_FEE_CENTS = 50
  MAX_FLEXILE_FEE_CENTS = 15_00
  PERCENT_FLEXILE_FEE = 1.5
  private_constant :BASE_FLEXILE_FEE_CENTS, :MAX_FLEXILE_FEE_CENTS, :PERCENT_FLEXILE_FEE

  has_many :invoice_line_items, autosave: true
  has_many :invoice_expenses, autosave: true
  has_many :payments
  has_many :invoice_approvals
  has_many :consolidated_invoices_invoices
  has_many :consolidated_invoices, through: :consolidated_invoices_invoices
  has_many :integration_records, as: :integratable
  has_one :quickbooks_journal_entry, -> do
    alive.quickbooks_journal_entry.joins(:integration).where(integration: { type: "QuickbooksIntegration" })
  end, as: :integratable, class_name: "IntegrationRecord"
  has_many_attached :attachments

  delegate :hourly?, to: :company_worker, allow_nil: true

  validates :status, inclusion: { in: ALL_STATES }, presence: true
  validates :invoice_date, presence: true
  validates :total_minutes, presence: true, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: MAX_MINUTES }, if: :for_hourly_services?
  validates :total_amount_in_usd_cents, presence: true,
                                        numericality: { only_integer: true, greater_than: 99 }
  validates :invoice_number, presence: true
  validates :bill_from, presence: true
  validates :bill_to, presence: true
  validates :due_on, presence: true
  validates :equity_percentage, presence: true, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: CompanyWorker::MAX_EQUITY_PERCENTAGE,
  }
  validates :min_allowed_equity_percentage, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 100,
  }, allow_nil: true
  validates :max_allowed_equity_percentage, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
    less_than_or_equal_to: 100,
  }, allow_nil: true
  validates :equity_amount_in_cents, presence: true, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
  }
  validates :equity_amount_in_options, presence: true, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
  }
  validates :cash_amount_in_cents, presence: true, numericality: {
    only_integer: true,
    greater_than_or_equal_to: 0,
  }
  validates :flexile_fee_cents, presence: true, numericality: {
    only_integer: true,
    greater_than_or_equal_to: BASE_FLEXILE_FEE_CENTS,
  }, on: :create
  validate :total_must_be_a_sum_of_cash_and_equity
  validate :min_equity_less_than_max_equity

  scope :pending, -> { where(status: COMPANY_PENDING_STATES) }
  scope :processing, -> { where(status: PROCESSING) }
  scope :mid_payment, -> { where(status: [PROCESSING, PAYMENT_PENDING]) }
  scope :approved, lambda {
    where(status: APPROVED).
      joins(:company).
      where("invoice_approvals_count >= companies.required_invoice_approval_count")
  }
  scope :partially_approved, lambda {
    where(status: APPROVED).
      joins(:company).
      where("invoice_approvals_count < companies.required_invoice_approval_count")
  }
  scope :paid, -> { where(status: PAID) }
  scope :received, -> { where(status: RECEIVED) }
  scope :not_pending_acceptance, -> do
    created_by_user = where("created_by_id = user_id")
    already_accepted = where("accepted_at IS NOT NULL")
    created_by_user.or(already_accepted)
  end
  scope :for_next_consolidated_invoice, -> do
    fully_approved_or_failed =
      where(status: [APPROVED, FAILED]).joins(:company).
      where("invoice_approvals_count >= companies.required_invoice_approval_count")
    fully_approved_or_failed.or(paid_or_mid_payment).
      not_pending_acceptance.
      where.missing(:consolidated_invoices_invoices)
  end
  scope :for_tax_year, ->(tax_year) {
    paid.joins(:company).
      where("invoice_approvals_count >= companies.required_invoice_approval_count").
      where("EXTRACT(year from invoices.paid_at) = ?", tax_year)
  }
  scope :paid_or_mid_payment, -> {
    where(status: PAID_OR_PAYING_STATES)
  }
  scope :unique_contractors_count, -> { select(:user_id).distinct.count }

  after_initialize :populate_bill_data
  before_validation :populate_bill_data, on: :create
  after_commit :destroy_approvals, if: -> { rejected? }, on: :update
  after_commit :sync_with_quickbooks, on: :update, if: :payable?

  def attachment = attachments.last

  def total_amount_in_usd = total_amount_in_usd_cents / 100.0

  def cash_amount_in_usd = cash_amount_in_cents / 100.0

  def equity_amount_in_usd = equity_amount_in_cents / 100.0

  def equity_vested? = equity_grant_id?

  def approved? = status == APPROVED

  def rejected? = status == REJECTED

  def fully_approved?
    approved? && invoice_approvals_count >= company.required_invoice_approval_count
  end

  def payable?
    company.active? &&
      status.in?([APPROVED, FAILED, PAYMENT_PENDING]) &&
      (created_by_user? || accepted_at.present?) &&
      invoice_approvals_count >= company.required_invoice_approval_count &&
      tax_requirements_met?
  end

  def immediately_payable?
    payable? && (company.is_trusted? ? company_charged? : company_paid?)
  end

  def company_charged?
    consolidated_invoices.paid_or_pending_payment.exists?
  end

  def company_paid?
    consolidated_invoices.paid.exists?
  end

  def tax_requirements_met?
    user.tax_information_confirmed_at.present?
  end

  def payment_expected_by
    consolidated_invoice&.contractor_payments_expected_by if [PROCESSING, PAYMENT_PENDING].include?(status)
  end

  DEFAULT_INVOICE_NUMBER = "1"
  def recommended_invoice_number
    preceding_invoice = Invoice.where(company_id:, user_id:).order(invoice_date: :desc, created_at: :desc).where(invoice_date: (..invoice_date)).where.not(status: REJECTED).where(invoice_type: "services").where.not(id:).first

    return DEFAULT_INVOICE_NUMBER unless preceding_invoice

    preceding_invoice_digits = preceding_invoice.invoice_number.scan(/\d+/).last # may include leading zeros
    preceding_invoice_id = preceding_invoice_digits.to_i
    return DEFAULT_INVOICE_NUMBER if preceding_invoice_id.zero?

    next_invoice_id = preceding_invoice_id + 1
    next_invoice_digits = "%0#{preceding_invoice_digits.length}d" % next_invoice_id # pad leading zeros

    # Only replace last occurrence of string (in case there are multiple occurrences, e.g. INV-001-001)
    preceding_invoice.invoice_number.reverse.sub(preceding_invoice_digits.reverse, next_invoice_digits.reverse).reverse
  end

  def quickbooks_entity
    "Bill"
  end

  def create_or_update_quickbooks_integration_record!(integration:, parsed_body:, is_journal_entry: false)
    unless is_journal_entry
      (invoice_line_items + invoice_expenses).map.with_index do |line_item, index|
        quickbooks_line_item = parsed_body["Line"].find { _1["LineNum"] == index + 1 }
        line_item.create_or_update_quickbooks_integration_record!(integration:, parsed_body: quickbooks_line_item)
      end
    end

    super
  end

  def mark_as_paid!(timestamp:, payment_id: nil)
    update!(status: PAID, paid_at: timestamp)
    CompanyWorkerMailer.payment_sent(payment_id).deliver_later if payment_id
    VestStockOptionsJob.perform_async(id) if equity_amount_in_options > 0
    company_worker.send_equity_percent_selection_email(invoice_date.year) if company.equity_compensation_enabled? && !company_worker.alumni?
  end

  def calculate_flexile_fee_cents
    fee_cents = BASE_FLEXILE_FEE_CENTS + (total_amount_in_usd_cents * PERCENT_FLEXILE_FEE / 100)
    [fee_cents, MAX_FLEXILE_FEE_CENTS].min.round
  end

  def for_hourly_services?
    invoice_type_services? && hourly?
  end

  def created_by_user?
    created_by_id == user_id
  end

  private
    def populate_bill_data
      self.bill_from ||= user&.billing_entity_name
      self.bill_to ||= company&.name
      self.due_on ||= invoice_date
    end

    def destroy_approvals
      invoice_approvals.destroy_all
    end

    def sync_with_quickbooks
      QuickbooksDataSyncJob.perform_async(company_id, self.class.name, id)
    end

    def total_must_be_a_sum_of_cash_and_equity
      relevant_attributes = %i[cash_amount_in_cents equity_amount_in_cents total_amount_in_usd_cents]
      return unless relevant_attributes.any? { |attr| public_send("#{attr}_changed?") }
      return if relevant_attributes.any? { |attr| public_send(attr).nil? }

      total = cash_amount_in_cents + equity_amount_in_cents
      return if total_amount_in_usd_cents == total

      errors.add(:base, "Total amount in USD cents must equal the sum of cash and equity amounts")
    end

    def consolidated_invoice
      return @_consolidated_invoice if defined?(@_consolidated_invoice)
      @_consolidated_invoice = consolidated_invoices.order(id: :desc).take
    end

    def min_equity_less_than_max_equity
      return if min_allowed_equity_percentage.nil? || max_allowed_equity_percentage.nil?
      return if min_allowed_equity_percentage <= max_allowed_equity_percentage

      errors.add(:min_allowed_equity_percentage, "must be less than or equal to maximum allowed equity percentage")
    end
end
