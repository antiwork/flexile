# frozen_string_literal: true

class PayInvestorEquityBuybacks
  class WiseError < StandardError; end

  delegate :company, :user, to: :company_investor, private: true

  def initialize(company_investor, equity_buybacks)
    @company_investor = company_investor
    @equity_buybacks = equity_buybacks

    raise ActiveRecord::RecordNotFound unless equity_buybacks.present?
    if equity_buybacks.pluck(:company_investor_id).uniq != [company_investor.id]
      raise "Equity buybacks must belong to the same company investor"
    end
  end

  def process
    return if equity_buybacks.any? { !_1.status.in?([EquityBuyback::ISSUED, EquityBuyback::RETAINED]) } ||
              user.tax_information_confirmed_at.nil?
    return unless user.has_verified_tax_id?

    raise "Feature unsupported for company #{company.id}" unless company.equity_enabled?
    raise "Flexile balance insufficient to pay for equity buybacks to investor #{company_investor.id}" unless Wise::AccountBalance.has_sufficient_flexile_balance?(net_amount_in_usd)
    raise "Unknown country for user #{user.id}" if user.country_code.blank?

    if user.sanctioned_country_resident?
      equity_buybacks.each { _1.mark_retained!("ofac_sanctioned_country") }
      return
    end

    equity_buybacks.update!(status: EquityBuyback::ISSUED, retained_reason: nil)

    equity_buyback_payment = EquityBuybackPayment.create!(equity_buybacks:,
                                                          status: Payment::INITIAL,
                                                          processor_uuid: SecureRandom.uuid,
                                                          wise_credential: WiseCredential.flexile_credential,
                                                          wise_recipient: bank_account,
                                                          processor_name: EquityBuybackPayment::PROCESSOR_WISE)
    target_currency = bank_account.currency
    if target_currency == "USD"
      amount = net_amount_in_usd
    else
      exchange_rate = payout_service.get_exchange_rate(target_currency:).first["rate"]
      Bugsnag.leave_breadcrumb("PayInvestorEquityBuybacks - fetched exchange rate",
                               { response: exchange_rate }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
      amount = net_amount_in_usd * exchange_rate
    end

    account = payout_service.get_recipient_account(recipient_id: bank_account.recipient_id)
    unless account["active"]
      bank_account.mark_deleted!
      CompanyInvestorMailer.equity_buyback_payment_failed_reenter_bank_details(
        equity_buyback_payment_id: equity_buyback_payment.id,
        amount:,
        currency: target_currency,
        net_amount_in_usd_cents: net_amount_in_cents
      ).deliver_later
      raise WiseError, "Bank account is no longer active for equity buyback payment #{equity_buyback_payment.id}"
    end
    quote = payout_service.create_quote(target_currency:, amount:, recipient_id: bank_account.recipient_id)
    Bugsnag.leave_breadcrumb("PayInvestorEquityBuybacks - received quote",
                             { response: quote }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    quote_id = quote["id"]
    raise WiseError, "Creating quote failed for equity buyback payment #{equity_buyback_payment.id}" unless quote_id.present?

    payment_option = quote["paymentOptions"].find { _1["payIn"] == "BALANCE" }
    wise_fee = payment_option.dig("fee", "total")
    source_amount = payment_option.dig("sourceAmount")
    equity_buyback_payment.update!(wise_quote_id: quote_id, transfer_currency: quote["targetCurrency"],
                                   total_transaction_cents: (source_amount.to_d * 100).to_i,
                                   transfer_fee_cents: (wise_fee.to_d * 100).to_i)
    transfer = payout_service.create_transfer(quote_id:, recipient_id: bank_account.recipient_id,
                                              unique_transaction_id: equity_buyback_payment.processor_uuid,
                                              reference: equity_buyback_payment.wise_transfer_reference)
    Bugsnag.leave_breadcrumb("PayInvestorEquityBuybacks - created transfer",
                             { response: transfer }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    transfer_id = transfer["id"]
    raise WiseError, "Creating transfer failed for equity buyback payment #{equity_buyback_payment.id}" unless transfer_id.present?

    equity_buybacks.update!(status: EquityBuyback::PROCESSING)
    equity_buyback_payment.update!(transfer_id:, conversion_rate: transfer["rate"],
                                   recipient_last4: bank_account.last_four_digits)
    response = payout_service.fund_transfer(transfer_id:)

    Bugsnag.leave_breadcrumb("PayInvestorEquityBuybacks - funded transfer",
                             { response: }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    unless response["status"] == "COMPLETED"
      raise WiseError, "Funding transfer failed for equity buyback payment #{equity_buyback_payment.id}"
    end
  rescue WiseError => e
    equity_buyback_payment.update!(status: Payment::FAILED)
    raise e
  end

  private
    attr_reader :company_investor, :equity_buybacks

    def bank_account
      @_bank_account ||= user.bank_account_for_dividends
    end

    def net_amount_in_cents
      @_net_amount_in_cents ||= equity_buybacks.sum(:total_amount_cents)
    end

    def net_amount_in_usd
      @_net_amount_in_usd ||= net_amount_in_cents / 100.0
    end

    def payout_service
      @_payout_service ||= Wise::PayoutApi.new
    end
end
