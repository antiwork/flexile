# frozen_string_literal: true

class EquityContractCountrySupport
  SUPPORTED_COUNTRY_CODES = [
    "AT", # Austria
    "AR", # Argentina
    "BR", # Brazil
    "BG", # Bulgaria
    "CA", # Canada
    "CZ", # Czech Republic
    "IN", # India
    "ID", # Indonesia
    "NZ", # New Zealand
    "RO", # Romania
    "ES", # Spain
    "TW", # Taiwan
    "UA", # Ukraine
    "AE", # United Arab Emirates
    "GB", # United Kingdom
    "US", # United States
    "PT", # Portugal
    "AU", # Australia
  ].freeze

  def initialize(user)
    @user = user
  end

  def supported?
    SUPPORTED_COUNTRY_CODES.include?(@user.country_code)
  end
end
