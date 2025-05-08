# frozen_string_literal: true

class AddressPresenter
  delegate :street_address, :city, :zip_code, :state, :country_code, to: :record

  def initialize(record)
    @record = record
  end

  def props
    {
      street_address:,
      city:,
      zip_code:,
      state:,
      country_code:,
      country:,
    }
  end

  private
    attr_reader :record

    def country
      country_code.present? ? ISO3166::Country[country_code].common_name : nil
    end
end
