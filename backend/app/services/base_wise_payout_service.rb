# frozen_string_literal: true

class BaseWisePayoutService
  class WiseError < StandardError; end

  delegate :company, :user, to: :company_investor, private: true

  def initialize(company_investor, items)
    @company_investor = company_investor
    @items = items

    raise ActiveRecord::RecordNotFound unless items.present?
    if items.pluck(:company_investor_id).uniq != [company_investor.id]
      raise "#{item_type_name.pluralize} must belong to the same company investor"
    end
  end

  def process
    return if items.any? { !_1.status.in?(valid_statuses) } ||
              !company_investor.completed_onboarding? ||
              user.tax_information_confirmed_at.nil? ||
              (requires_bank_account? && user.bank_account_for_dividends.nil?)
    return unless user.has_verified_tax_id?

    run_pre_payout_validations

    raise "Flexile balance insufficient to pay for #{item_type_name.pluralize.downcase} to investor #{company_investor.id}" unless Wise::AccountBalance.has_sufficient_flexile_balance?(net_amount_in_usd)
    raise "Unknown country for user #{user.id}" if user.country_code.blank?

    if user.sanctioned_country_resident?
      items.each { _1.mark_retained!("ofac_sanctioned_country") }
      return
    end

    return unless additional_validations

    items.update!(status: issued_status, retained_reason: nil)

    payment = payment_model.create!(payment_attributes)
    target_currency = bank_account.currency
    if target_currency == "USD"
      amount = net_amount_in_usd
    else
      exchange_rate = payout_service.get_exchange_rate(target_currency:).first["rate"]
      Bugsnag.leave_breadcrumb("#{self.class.name} - fetched exchange rate",
                               { response: exchange_rate }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
      amount = net_amount_in_usd * exchange_rate
    end

    account = payout_service.get_recipient_account(recipient_id: bank_account.recipient_id)
    unless account["active"]
      bank_account.mark_deleted!
      failure_mailer_method.call(
        payment_id_param => payment.id,
        amount:,
        currency: target_currency,
        net_amount_in_usd_cents: net_amount_in_cents
      ).deliver_later
      raise WiseError, "Bank account is no longer active for #{item_type_name.downcase} payment #{payment.id}"
    end
    quote = payout_service.create_quote(target_currency:, amount:, recipient_id: bank_account.recipient_id)
    Bugsnag.leave_breadcrumb("#{self.class.name} - received quote",
                             { response: quote }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    quote_id = quote["id"]
    raise WiseError, "Creating quote failed for #{item_type_name.downcase} payment #{payment.id}" unless quote_id.present?

    payment_option = quote["paymentOptions"].find { _1["payIn"] == "BALANCE" }
    wise_fee = payment_option.dig("fee", "total")
    source_amount = payment_option.dig("sourceAmount")
    payment.update!(wise_quote_id: quote_id, transfer_currency: quote["targetCurrency"],
                    total_transaction_cents: (source_amount.to_d * 100).to_i,
                    **fee_update_attributes(wise_fee))
    transfer = payout_service.create_transfer(quote_id:, recipient_id: bank_account.recipient_id,
                                              unique_transaction_id: payment.processor_uuid,
                                              reference: payment.wise_transfer_reference)
    Bugsnag.leave_breadcrumb("#{self.class.name} - created transfer",
                             { response: transfer }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    transfer_id = transfer["id"]
    raise WiseError, "Creating transfer failed for #{item_type_name.downcase} payment #{payment.id}" unless transfer_id.present?

    items.update!(status: processing_status)
    payment.update!(transfer_id:, conversion_rate: transfer["rate"],
                    recipient_last4: bank_account.last_four_digits)
    response = payout_service.fund_transfer(transfer_id:)

    Bugsnag.leave_breadcrumb("#{self.class.name} - funded transfer",
                             { response: }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    unless response["status"] == "COMPLETED"
      raise WiseError, "Funding transfer failed for #{item_type_name.downcase} payment #{payment.id}"
    end
  rescue WiseError => e
    payment.update!(status: Payment::FAILED) if defined?(payment) && payment
    raise e
  end

  private
    attr_reader :company_investor, :items

    # Abstract methods to be implemented by subclasses
    def payment_model
      raise NotImplementedError
    end

    def item_type_name
      raise NotImplementedError
    end

    def valid_statuses
      raise NotImplementedError
    end

    def issued_status
      raise NotImplementedError
    end

    def processing_status
      raise NotImplementedError
    end

    def net_amount_in_cents
      raise NotImplementedError
    end

    def requires_bank_account?
      true
    end

    def payment_attributes
      raise NotImplementedError
    end

    def failure_mailer_method
      raise NotImplementedError
    end

    def payment_id_param
      raise NotImplementedError
    end

    def fee_update_attributes(wise_fee)
      raise NotImplementedError
    end

    # Optional methods with default implementations
    def run_pre_payout_validations
      # Override in subclasses if needed
    end

    def additional_validations
      # Override in subclasses if needed, return false to stop processing
      true
    end

    # Shared private methods
    def bank_account
      @_bank_account ||= user.bank_account_for_dividends
    end

    def net_amount_in_usd
      @_net_amount_in_usd ||= net_amount_in_cents / 100.0
    end

    def payout_service
      @_payout_service ||= Wise::PayoutApi.new
    end
end
