# frozen_string_literal: true

class PayInvoice
  class WiseError < StandardError; end

  attr_reader :invoice
  delegate :company, to: :invoice, private: true

  def initialize(invoice_id)
    @invoice = Invoice.find(invoice_id)
  end

  def process
    raise "Payout method not set up for company #{company.id}" unless company.bank_account_ready?
    raise "Not enough account balance to pay out for company #{company.id}" unless company.has_sufficient_balance?(invoice.cash_amount_in_usd)
    raise "Invoice not immediately payable for company #{company.id}" unless invoice.immediately_payable?

    if invoice.cash_amount_in_cents.zero? && invoice.equity_amount_in_options != 0
      invoice.mark_as_paid!(timestamp: Time.current)
      return
    end

    payout_service = Wise::PayoutApi.new
    bank_account = invoice.user.bank_account

    # TODO: Disallow if old payment records exist in non-terminal unpaid states.
    # I've asked Wise which sates that includes because their own documentation contradicts the
    # diagram they've drawn.
    payment = invoice.payments.create!(status: Payment::INITIAL, net_amount_in_cents: invoice.cash_amount_in_cents,
                                       processor_uuid: SecureRandom.uuid, wise_credential: WiseCredential.flexile_credential,
                                       wise_recipient: bank_account)
    target_currency = bank_account.currency
    if target_currency == "USD"
      amount = invoice.cash_amount_in_usd
    else
      exchange_rate = payout_service.get_exchange_rate(target_currency:).first["rate"]
      Bugsnag.leave_breadcrumb("PayInvoice - fetched exchange rate", { response: exchange_rate }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
      amount = invoice.cash_amount_in_usd * exchange_rate
    end
    account = payout_service.get_recipient_account(recipient_id: bank_account.recipient_id)
    unless account["active"]
      bank_account.mark_deleted!
      CompanyWorkerMailer.payment_failed_reenter_bank_details(payment.id, amount, target_currency).deliver_later
      raise WiseError, "Bank account is no longer active for payment #{payment.id}"
    end
    quote = payout_service.create_quote(target_currency:, amount:, recipient_id: bank_account.recipient_id)
    Bugsnag.leave_breadcrumb("PayInvoice - received quote", { response: quote }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    quote_id = quote["id"]
    raise WiseError, "Creating quote failed for payment #{payment.id}" unless quote_id.present?

    wise_fee_cents = (quote["paymentOptions"].find { _1["payIn"] == "BALANCE" }.dig("fee", "total").to_d * 100).to_i
    payment.update!(wise_quote_id: quote_id, wise_transfer_currency: quote["targetCurrency"],
                    transfer_fee_in_cents: wise_fee_cents)
    transfer = payout_service.create_transfer(quote_id:, recipient_id: bank_account.recipient_id,
                                              unique_transaction_id: payment.processor_uuid,
                                              reference: payment.wise_transfer_reference)
    Bugsnag.leave_breadcrumb("PayInvoice - created transfer", { response: transfer }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    transfer_id = transfer["id"]
    raise WiseError, "Creating transfer failed for payment #{payment.id}" unless transfer_id.present?

    invoice.update!(status: Invoice::PROCESSING)
    payment.update!(wise_transfer_id: transfer_id, conversion_rate: transfer["rate"],
                    recipient_last4: bank_account.last_four_digits)
    response = payout_service.fund_transfer(transfer_id:)
    payment.balance_transactions.create!(company:, transaction_type: BalanceTransaction::PAYMENT_INITIATED, amount_cents: transfer["sourceValue"] * 100)
    Bugsnag.leave_breadcrumb("PayInvoice - funded transfer", { response: }, Bugsnag::Breadcrumbs::LOG_BREADCRUMB_TYPE)
    raise WiseError, "Funding transfer failed for payment #{payment.id}" unless response["status"] == "COMPLETED"
  rescue WiseError => e
    payment.update!(status: Payment::FAILED)
    invoice.update!(status: Invoice::FAILED)
    raise e
  end
end
