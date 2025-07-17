# frozen_string_literal: true

class InvoiceLineItem < ApplicationRecord
  include QuickbooksIntegratable, Serializable

  belongs_to :invoice
  has_many :integration_records, as: :integratable

  validates :description, presence: true
  validates :pay_rate_in_subunits, presence: true, numericality: { only_integer: true, greater_than: 0 }
  validates :quantity, presence: true, numericality: { greater_than: 0 }

  def normalized_quantity
    BigDecimal(quantity.to_s) / (hourly? ? BigDecimal('60') : BigDecimal('1'))
  end

  def total_amount_cents
    (BigDecimal(pay_rate_in_subunits.to_s) * normalized_quantity).round(0).to_i
  end

  def cash_amount_in_cents
    return total_amount_cents if invoice.equity_percentage.zero?

    equity_amount_in_cents = (BigDecimal(total_amount_cents.to_s) * BigDecimal(invoice.equity_percentage.to_s) / BigDecimal('100')).round(0).to_i
    total_amount_cents - equity_amount_in_cents
  end

  def cash_amount_in_usd
    cash_amount_in_cents / 100.0
  end
end
