# frozen_string_literal: true

class InvoiceLineItem < ApplicationRecord
  include QuickbooksIntegratable, Serializable

  belongs_to :invoice
  has_many :integration_records, as: :integratable

  validates :description, presence: true
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }, if: -> { invoice.invoice_type_services? }
  validates :quantity, presence: true, numericality: { only_integer: true, greater_than: 0 }

  def total_amount_cents
    pay_rate_in_subunits * quantity / (hourly ? 60 : 1)
  end

  def cash_amount_in_cents
    return total_amount_cents if invoice.equity_percentage.zero?

    equity_amount_in_cents = ((total_amount_cents * invoice.equity_percentage) / 100.to_d).round
    total_amount_cents - equity_amount_in_cents
  end

  def cash_amount_in_usd
    cash_amount_in_cents / 100.0
  end
end
