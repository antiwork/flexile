class AddConversionSharePriceUsdToCompany < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :conversion_share_price_usd, :decimal

    up_only do
      Company.reset_column_information
      Company.where.not(share_price_in_usd: nil).find_each do |company|
        company.update!(conversion_share_price_usd: company.share_price_in_usd)
      end
    end
  end
end
