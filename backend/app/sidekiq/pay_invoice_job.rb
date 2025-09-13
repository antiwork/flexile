# frozen_string_literal: true

class PayInvoiceJob
  include Sidekiq::Job
  sidekiq_options retry: 3, retry_in: ->(count) { 2**count }

  def perform(invoice_id)
    log_retry_context(invoice_id) if retry_attempt?
    PayInvoice.new(invoice_id).process
  rescue => e
    log_retry_failure(invoice_id, e) if retry_attempt?
    raise e
  end

  private
    def retry_attempt?
      @retry_count ||= bid&.dig("retry_count")
      @retry_count.present? && @retry_count > 0
    end

    def log_retry_context(invoice_id)
      invoice = Invoice.find(invoice_id)
      user = invoice.user
      bank_account = user.bank_account
      retry_count = @retry_count || bid&.dig("retry_count") || 0

      Rails.logger.info "PayInvoice AUDIT - Retry Attempt: " \
                        "timestamp=#{Time.current.iso8601}, " \
                        "invoice_id=#{invoice_id}, " \
                        "retry_count=#{retry_count}, " \
                        "company_id=#{invoice.company_id}, " \
                        "user_id=#{user.id}, " \
                        "user_email=#{user.email}, " \
                        "user_tax_id=#{user.tax_id}, " \
                        "cash_amount_cents=#{invoice.cash_amount_in_cents}, " \
                        "cash_amount_usd=#{invoice.cash_amount_in_usd}, " \
                        "equity_amount=#{invoice.equity_amount_in_options}, " \
                        "bank_currency=#{bank_account&.currency}, " \
                        "bank_last_four=#{bank_account&.last_four_digits}, " \
                        "bank_recipient_id=#{bank_account&.recipient_id}, " \
                        "invoice_status=#{invoice.status}, " \
                        "company_name=#{invoice.company.name}"
    rescue => e
      Rails.logger.error "PayInvoice audit logging failed: #{e.message}"
    end

    def log_retry_failure(invoice_id, error)
      invoice = Invoice.find(invoice_id)
      user = invoice.user
      retry_count = @retry_count || bid&.dig("retry_count") || 0

      Rails.logger.error "PayInvoice AUDIT - Retry Failure: " \
                         "timestamp=#{Time.current.iso8601}, " \
                         "invoice_id=#{invoice_id}, " \
                         "retry_count=#{retry_count}, " \
                         "user_email=#{user.email}, " \
                         "user_tax_id=#{user.tax_id}, " \
                         "cash_amount_cents=#{invoice.cash_amount_in_cents}, " \
                         "error_class=#{error.class.name}, " \
                         "error_message=#{error.message}, " \
                         "company_name=#{invoice.company.name}, " \
                         "invoice_created_at=#{invoice.created_at.iso8601}"
    rescue => e
      Rails.logger.error "PayInvoice retry failure logging failed: #{e.message}"
    end
end
