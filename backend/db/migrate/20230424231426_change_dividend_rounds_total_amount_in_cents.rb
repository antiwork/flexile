class ChangeDividendRoundsTotalAmountInCents < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      ALTER TABLE dividend_rounds
      ALTER COLUMN total_amount_in_cents DROP EXPRESSION,
      ALTER COLUMN total_amount_in_cents SET NOT NULL;
    SQL
  end

  def down
    remove_column :dividend_rounds, :total_amount_in_cents

    add_column :dividend_rounds, :total_amount_in_cents, :virtual,
               type: :bigint,
               as: "(number_of_shares * dividend_per_share_in_cents)",
               stored: true
  end
end
