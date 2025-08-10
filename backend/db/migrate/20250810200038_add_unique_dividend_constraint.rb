class AddUniqueDividendConstraint < ActiveRecord::Migration[8.0]
  def change
    # First, we need to identify and remove any existing duplicate dividends
    # This query finds duplicate records based on dividend_round_id and company_investor_id
    duplicates = execute <<~SQL
      SELECT dividend_round_id, company_investor_id, array_agg(id ORDER BY created_at) as ids
      FROM dividends
      GROUP BY dividend_round_id, company_investor_id
      HAVING COUNT(*) > 1
    SQL

    # Keep the first (oldest) record for each group and delete the rest
    duplicates.each do |row|
      ids = row['ids'].gsub(/[{}]/, '').split(',').map(&:strip)
      ids_to_delete = ids[1..-1] # Keep first, delete the rest

      if ids_to_delete.any?
        execute "DELETE FROM dividends WHERE id IN (#{ids_to_delete.join(',')})"
      end
    end

    # Add the unique constraint to prevent future duplicates
    add_index :dividends, [:dividend_round_id, :company_investor_id],
              unique: true,
              name: "index_dividends_on_dividend_round_and_investor_unique"
  end
end
