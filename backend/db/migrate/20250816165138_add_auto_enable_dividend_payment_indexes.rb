# frozen_string_literal: true

class AddAutoEnableDividendPaymentIndexes < ActiveRecord::Migration[7.1]
  def change
    add_index :dividend_rounds,
              [:ready_for_payment, :status, :issued_at],
              name: 'idx_div_rounds_auto_enable'

    add_index :companies,
              :dividends_allowed,
              name: 'idx_companies_dividends_allowed' unless index_exists?(:companies, :dividends_allowed)
  end
end