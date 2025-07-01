# frozen_string_literal: true

class ChargeConsolidatedInvoice
  def initialize(id)
    @consolidated_invoice_id = id
  end

  def process
    consolidated_invoice = ConsolidatedInvoice.find(@consolidated_invoice_id)
    company = consolidated_invoice.company
    raise "Company does not have a bank account set up" unless company.bank_account_ready?

    begin
      stripe_setup_intent = company.bank_account.stripe_setup_intent
      intent = Stripe::PaymentIntent.create({
        payment_method_types: ["us_bank_account"],
        payment_method: stripe_setup_intent.payment_method,
        customer: stripe_setup_intent.customer,
        confirm: true,
        amount: consolidated_invoice.total_cents,
        currency: "USD",
        expand: ["latest_charge"],
        capture_method: "automatic",
      })
    rescue Stripe::StripeError => e
      consolidated_invoice.update!(status: Invoice::FAILED)
      raise e
    end

    consolidated_payment = consolidated_invoice.consolidated_payments.create!(
      stripe_payment_intent_id: intent.id,
      stripe_transaction_id: intent.latest_charge.id,
    )
    company.consolidated_payment_balance_transactions.create!(
      consolidated_payment:,
      transaction_type: BalanceTransaction::PAYMENT_INITIATED,
      amount_cents: intent.latest_charge.amount,
    )
    consolidated_invoice.trigger_payments if company.is_trusted?
  end
end
