# frozen_string_literal: true

Money.locale_backend = :i18n
Money.rounding_mode = BigDecimal::ROUND_HALF_UP
Money.default_currency = "USD"
