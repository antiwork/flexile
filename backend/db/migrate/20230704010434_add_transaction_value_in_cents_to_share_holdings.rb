class AddTransactionValueInCentsToShareHoldings < ActiveRecord::Migration[7.0]
  def up
    execute <<~SQL
      ALTER TABLE share_holdings
      ALTER COLUMN total_amount_in_cents DROP EXPRESSION,
      ALTER COLUMN total_amount_in_cents SET NOT NULL;
    SQL
  end

  def down
    remove_column :share_holdings, :total_amount_in_cents

    add_column :share_holdings, :total_amount_in_cents, :virtual,
               type: :bigint,
               as: "(number_of_shares * share_price_in_cents)",
               stored: true
  end
end
