class ChangeTenderOfferDatesToDateTimes < ActiveRecord::Migration[7.1]
  def up
    change_column :tender_offers, :start_date, :datetime
    change_column :tender_offers, :end_date, :datetime

    rename_column :tender_offers, :start_date, :starts_at
    rename_column :tender_offers, :end_date, :ends_at
  end

  def down
    rename_column :tender_offers, :starts_at, :start_date
    rename_column :tender_offers, :ends_at, :end_date

    change_column :tender_offers, :start_date, :date
    change_column :tender_offers, :end_date, :date
  end
end
