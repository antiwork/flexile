class AddFullyDilutedSharesToCompanyInvestor < ActiveRecord::Migration[7.1]
  def change
    add_column :company_investors, :fully_diluted_shares, :virtual,
                type: :bigint,
                as: "(total_shares + total_options)",
                stored: true
  end
end
