class AddLetterOfTransmittalToTenderOffers < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_offers, :letter_of_transmittal, :text
  end
end
