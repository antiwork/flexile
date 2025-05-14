class AddTenderOffersEnabledToCompany < ActiveRecord::Migration[7.2]
  def change
    add_column :companies, :tender_offers_enabled, :boolean, default: false, null: false

    Company.reset_column_information
    Company.find_each do |company|
      company.update!(tender_offers_enabled: Flipper.enabled?(:tender_offers, company))
    end
  end
end
