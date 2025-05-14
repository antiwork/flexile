# frozen_string_literal: true

module ApplicationHelper
  include Pagy::Frontend

  MONEY_FORMAT_OPTIONS = { no_cents_if_whole: true, symbol: true }.freeze

  def money_format(amount, opts = {})
    amount ||= 0
    opts = MONEY_FORMAT_OPTIONS.merge(opts)

    Money.from_amount(amount, :usd).format(opts)
  end

  def cents_format(amount, opts = {})
    amount ||= 0
    opts = MONEY_FORMAT_OPTIONS.merge(opts)

    Money.from_cents(amount, :usd).format(opts)
  end
end
