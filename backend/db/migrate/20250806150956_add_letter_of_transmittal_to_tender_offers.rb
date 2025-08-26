# frozen_string_literal: true

class AddLetterOfTransmittalToTenderOffers < ActiveRecord::Migration[8.0]
  def change
    add_column :tender_offers, :letter_of_transmittal, :text, null: true
    up_only do
      TenderOffer.update_all(letter_of_transmittal: "Letter of transmittal not available")
    end
    change_column_null :tender_offers, :letter_of_transmittal, false
  end
end
