# frozen_string_literal: true

class ReconcileProcessingInvoicesJob
  include Sidekiq::Job
  sidekiq_options retry: 5

  def perform
    Invoice.processing.find_each do |invoice|
      invoice.payments.where.not(wise_transfer_id: nil).each do |payment|
        InvoicePaymentTransferUpdate.new(payment).process
      end
    rescue => e
      Rails.logger.error("Failed to reconcile invoice #{invoice.id}: #{e.message}")
    end
  end
end
