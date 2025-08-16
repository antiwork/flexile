# frozen_string_literal: true

class AddAutoEnableDividendPaymentIndexes < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def change
    add_index :dividend_rounds,
              %i[ready_for_payment status issued_at],
              name: "idx_div_rounds_auto_enable",
              if_not_exists: true,
              algorithm: :concurrently
    # TODO (techdebt): Revisit index strategy after observing query plans; consider a partial index
    # on dividend_rounds WHERE ready_for_payment = false AND status = 'Issued' to reduce index size if needed.

    add_index :companies,
              :dividends_allowed,
              name: "idx_companies_dividends_allowed",
              if_not_exists: true,
              algorithm: :concurrently
  end
end
