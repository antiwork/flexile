# frozen_string_literal: true

class PayInvestorDividends
  class WiseError < StandardError; end

  delegate :company, :user, to: :company_investor, private: true

  def initialize(company_investor, dividends)
    @company_investor = company_investor
    @dividends = dividends

    raise ActiveRecord::RecordNotFound unless dividends.present?
    if dividends.pluck(:company_investor_id).uniq != [company_investor.id]
      raise "Dividends must belong to the same company investor"
    end
  end

  def process
    return if dividends.any? { !_1.status.in?([Dividend::ISSUED, Dividend::RETAINED]) } ||
              !company_investor.completed_onboarding? ||
              user.tax_information_confirmed_at.nil? ||
              user.bank_account_for_dividends.nil?
    return unless user.has_verified_tax_id?
    raise "Feature unsupported for company #{company.id}" unless company.equity_enabled?
    raise "Flexile balance insufficient to pay for dividends to investor #{company_investor.id}" unless Wise::AccountBalance.has_sufficient_flexile_balance?(net_amount_in_usd)
    raise "Unknown country for user #{user.id}" if user.country_code.blank?

    if user.sanctioned_country_resident?
      dividends.each { _1.mark_retained!("ofac_sanctioned_country") }
      return
    end

    if net_amount_in_cents < user.minimum_dividend_payment_in_cents
      dividends.each { _1.mark_retained!("below_minimum_payment_threshold") }
      return
    end

    dividends.update!(status: Dividend::ISSUED, retained_reason: nil)

    dividend_payment = DividendPayment.create!(dividends:,
                                               status: Payment::INITIAL,
                                               processor_uuid: SecureRandom.uuid,
                                               wise_credential: WiseCredential.flexile_credential,
                                               wise_recipient: bank_account,
                                               processor_name: DividendPayment::PROCESSOR_WISE)
    target_currency = bank_account.currency
    if target_currency == "USD"
      amount = net_amount_in_usd
    else
      exchange_rate = payout_service.get_exchange_rate(target_currency:).first["rate"]
      Bugsnag.leave_breadcrumb("PayInvestorDividends - fetched exchange rate",
                               { response: exchange_rate }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
      amount = net_amount_in_usd * exchange_rate
    end

    account = payout_service.get_recipient_account(recipient_id: bank_account.recipient_id)
    unless account["active"]
      bank_account.mark_deleted!
      CompanyInvestorMailer.dividend_payment_failed_reenter_bank_details(
        dividend_payment_id: dividend_payment.id,
        amount:,
        currency: target_currency,
        net_amount_in_usd_cents: net_amount_in_cents
      ).deliver_later
      raise WiseError, "Bank account is no longer active for dividend payment #{dividend_payment.id}"
    end
    quote = payout_service.create_quote(target_currency:, amount:, recipient_id: bank_account.recipient_id)
    Bugsnag.leave_breadcrumb("PayInvestorDividends - received quote",
                             { response: quote }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    quote_id = quote["id"]
    raise WiseError, "Creating quote failed for dividend payment #{dividend_payment.id}" unless quote_id.present?

    payment_option = quote["paymentOptions"].find { _1["payIn"] == "BALANCE" }
    wise_fee = payment_option.dig("fee", "total")
    source_amount = payment_option.dig("sourceAmount")
    dividend_payment.update!(wise_quote_id: quote_id, transfer_currency: quote["targetCurrency"],
                             total_transaction_cents: (source_amount.to_d * 100).to_i,
                             transfer_fee_in_cents: (wise_fee.to_d * 100).to_i)
    transfer = payout_service.create_transfer(quote_id:, recipient_id: bank_account.recipient_id,
                                              unique_transaction_id: dividend_payment.processor_uuid,
                                              reference: dividend_payment.wise_transfer_reference)
    Bugsnag.leave_breadcrumb("PayInvestorDividends - created transfer",
                             { response: transfer }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    transfer_id = transfer["id"]
    raise WiseError, "Creating transfer failed for dividend payment #{dividend_payment.id}" unless transfer_id.present?

    dividends.update!(status: Dividend::PROCESSING)
    dividend_payment.update!(transfer_id:, conversion_rate: transfer["rate"],
                             recipient_last4: bank_account.last_four_digits)
    response = payout_service.fund_transfer(transfer_id:)

    Bugsnag.leave_breadcrumb("PayInvestorDividends - funded transfer",
                             { response: }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    unless response["status"] == "COMPLETED"
      raise WiseError, "Funding transfer failed for dividend payment #{dividend_payment.id}"
    end
  rescue WiseError => e
    dividend_payment.update!(status: Payment::FAILED)
    raise e
  end

  private
    attr_reader :company_investor, :dividends

    def bank_account
      @_bank_account ||= user.bank_account_for_dividends
    end

    def net_amount_in_cents
      @_net_amount_in_cents ||= dividends.sum(:net_amount_in_cents)
    end

    def net_amount_in_usd
      @_net_amount_in_usd ||= net_amount_in_cents / 100.0
    end

    def payout_service
      @_payout_service ||= Wise::PayoutApi.new
    end
end
