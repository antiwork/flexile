# frozen_string_literal: true

class Payment < ApplicationRecord
  has_paper_trail

  include QuickbooksIntegratable, Payments::Status, Payments::Wise, Serializable

  belongs_to :invoice
  belongs_to :wise_credential
  has_many :balance_transactions, class_name: "PaymentBalanceTransaction"
  has_many :integration_records, as: :integratable

  delegate :company, to: :invoice

  after_save :update_invoice_pg_search_document
  after_update_commit :sync_with_quickbooks

  validates :net_amount_in_cents, numericality: { greater_than_or_equal_to: 1, only_integer: true }, presence: true
  validates :transfer_fee_in_cents, numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true

  WISE_TRANSFER_REFERENCE = "PMT"

  def quickbooks_entity
    "BillPayment"
  end

  private
    def update_invoice_pg_search_document
      invoice.update_pg_search_document
    end

    def sync_with_quickbooks
      if previous_changes.key?(:status) && previous_changes[:status].last == SUCCEEDED
        QuickbooksDataSyncJob.perform_async(invoice.company_id, self.class.name, id)
      end
    end
end
