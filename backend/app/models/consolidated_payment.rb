# frozen_string_literal: true

class ConsolidatedPayment < ApplicationRecord
  has_paper_trail

  include Payments::Status, Serializable

  REFUNDED = "refunded"
  REFUNDABLE_STATUSES = [INITIAL, SUCCEEDED]
  ALL_STATUSES = DEFAULT_STATUSES + [REFUNDED]

  belongs_to :consolidated_invoice
  has_many :balance_transactions, class_name: "ConsolidatedPaymentBalanceTransaction"

  validates :stripe_fee_cents, numericality: { only_integer: true, greater_than: 1 }, allow_nil: true

  delegate :company, to: :consolidated_invoice



  def stripe_payment_intent
    return nil unless stripe_payment_intent_id?
    Stripe::PaymentIntent.retrieve(id: stripe_payment_intent_id, expand: ["latest_charge"])
  end

  def refundable?
    status.in?(REFUNDABLE_STATUSES) && consolidated_invoice.invoices.alive.paid_or_mid_payment.none?
  end

  def mark_as_refunded!
    update!(status: REFUNDED)
    consolidated_invoice.update!(status: ConsolidatedInvoice::REFUNDED)
  end

  def processed?
    status.in?([SUCCEEDED, FAILED, CANCELLED, REFUNDED])
  end
end
