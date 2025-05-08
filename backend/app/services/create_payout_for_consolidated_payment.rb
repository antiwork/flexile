# frozen_string_literal: true

class CreatePayoutForConsolidatedPayment
  class Error < StandardError; end

  def initialize(consolidated_payment)
    @consolidated_payment = consolidated_payment
  end

  def perform!
    raise Error, "Not ready for payout yet" if consolidated_payment.trigger_payout_after > Time.current

    stripe_charge = consolidated_payment.stripe_payment_intent.latest_charge
    raise Error, "Stripe charge has been refunded" if stripe_charge.refunded
    raise Error, "Stripe charge has been disputed" if stripe_charge.disputed

    consolidated_invoice = consolidated_payment.consolidated_invoice
    cents_to_wise = consolidated_invoice.transfer_fee_cents +
      consolidated_invoice.invoice_amount_cents
    payout = Stripe::Payout.create({
      amount: cents_to_wise,
      currency: "usd",
      description: "Flexile Consolidated Invoice #{consolidated_invoice.id}",
      statement_descriptor: "Flexile",
      metadata: {
        consolidated_invoice: consolidated_invoice.id,
        consolidated_payment: consolidated_payment.id,
      },
    })
    consolidated_payment.update!(stripe_payout_id: payout.id)
  end

  private
    attr_reader :consolidated_payment
end
