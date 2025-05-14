class MakeImpliedSharesNotNullable < ActiveRecord::Migration[7.0]
  def change
    reversible do |dir|
      dir.up do
        unless Rails.env.production?
          execute("UPDATE convertible_securities SET implied_shares = 1 WHERE implied_shares IS NULL")
        end
      end
      dir.down {}
    end
    change_column_null :convertible_securities, :implied_shares, false
  end
end
