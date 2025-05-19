# frozen_string_literal: true

class ConsolidatedInvoice < ApplicationRecord
  has_paper_trail

  include Invoice::Status, QuickbooksIntegratable, Serializable

  belongs_to :company
  has_many :consolidated_invoices_invoices
  has_many :invoices, through: :consolidated_invoices_invoices
  has_many :consolidated_payments
  has_many :integration_records, as: :integratable
  has_one_attached :receipt
  has_one :successful_payment, -> { successful.order(succeeded_at: :desc) }, class_name: "ConsolidatedPayment"
  has_one :quickbooks_journal_entry, -> do
    alive.quickbooks_journal_entry.joins(:integration).where(integration: { type: "QuickbooksIntegration" })
  end, as: :integratable, class_name: "IntegrationRecord"

  SENT = "sent"
  REFUNDED = "refunded"
  ALL_STATES = [SENT, PROCESSING, PAID, REFUNDED, FAILED]
  BILL_FROM = {
    name: "Gumroad, Inc. dba Flexile.com",
    address: {
      street_address: "548 Market Street",
      city: "San Francisco",
      zip_code: "94104-5401",
      state: "CA",
      country: "United States",
      country_code: "US",
    },
  }

  validates :flexile_fee_cents, presence: true,
                                numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :transfer_fee_cents, presence: true,
                                 numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :invoice_amount_cents, presence: true,
                                   numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_cents, presence: true,
                          numericality: { only_integer: true, greater_than: 99 }
  validates :period_start_date, presence: true
  validates :period_end_date, presence: true
  validates :invoice_number, :invoice_date, presence: true
  validates :status, inclusion: { in: ALL_STATES }, presence: true

  scope :for_last_month, -> { where("invoice_date < ? AND invoice_date >= ?", Date.today.beginning_of_month, Date.today.prev_month.beginning_of_month) }
  scope :with_total_contractors, -> {
    select("consolidated_invoices.*, count(distinct invoices.user_id) total_contractors_from_query")
      .joins(:invoices)
      .group(:id)
  }
  scope :paid, -> { where(status: PAID) }
  scope :paid_or_pending_payment, -> { where(status: [SENT, PROCESSING, PAID]) }

  after_commit :sync_with_quickbooks, on: :create

  def flexile_fee_usd
    flexile_fee_cents / 100.0
  end

  def trigger_payments
    invoices.each { |invoice| EnqueueInvoicePayment.new(invoice:).perform }
  end

  def total_amount_in_usd
    total_cents / 100.0
  end

  def total_fees_in_usd
    (flexile_fee_cents + transfer_fee_cents) / 100.0
  end

  # If the `.with_total_contractors` scope is used (avoids N+1 queries) then `total_contractors_from_query`
  # attribute will be set. However, we also want to support a consistent interface when we have instances
  # that were fetched without this scope. In this case, we need to perform a query to lookup the value.
  def total_contractors
    respond_to?(:total_contractors_from_query) ? total_contractors_from_query : invoices.unique_contractors_count
  end

  def quickbooks_total_fees_amount_in_usd
    (flexile_fee_cents + transfer_fee_cents) / 100.0
  end

  def quickbooks_entity
    "Bill"
  end

  def quickbooks_journal_entry_payload
    client = IntegrationApi::Quickbooks.new(company_id:)
    integration = client.integration
    {
      Line: [
        {
          JournalEntryLineDetail: {
            PostingType: "Debit",
            AccountRef: {
              value: integration.flexile_clearance_bank_account_id,
            },
          },
          DetailType: "JournalEntryLineDetail",
          Amount: total_amount_in_usd,
          Description: "BILL #{invoice_date.iso8601} Payables Funding",
        },
        {
          JournalEntryLineDetail: {
            PostingType: "Credit",
            AccountRef: {
              value: integration.default_bank_account_id,
            },
            Entity: {
              EntityRef: {
                value: integration.flexile_vendor_id,
              },
              Type: "Vendor",
            },
          },
          DetailType: "JournalEntryLineDetail",
          Amount: total_amount_in_usd,
          Description: "BILL #{invoice_date.iso8601} Payables Funding",
        },
      ],
    }.to_json
  end

  def mark_as_paid!(timestamp:, **)
    update!(status: PAID, paid_at: timestamp)
  end

  def contractor_payments_expected_by
    expected_by = created_at + company.contractor_payment_processing_time_in_days.days
    expected_by = expected_by.next_weekday if expected_by.on_weekend?
    expected_by
  end

  private
    def sync_with_quickbooks
      QuickbooksDataSyncJob.perform_async(company_id, self.class.name, id)
    end
end
