# frozen_string_literal: true

class TaxWithholdingCalculator
  TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY = 30

  attr_reader :withholding_percentage

  def initialize(user)
    @user = user
    @withholding_percentage = calculate_withholding_percentage
  end

  private
    attr_reader :user

    TAX_RATE_FOR_US_WITH_NO_TAX_ID = 24

    def calculate_withholding_percentage
      if user.country_code == "US"
        user.has_verified_tax_id? ? 0 : TAX_RATE_FOR_US_WITH_NO_TAX_ID
      else
        country_withholding.fetch(user.country_code, TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY)
      end
    end

    def country_withholding
      {
        "GE" => 30, # Georgia
        "BY" => 30, # Belarus
        "AZ" => 30, # Azerbaijan
        "AM" => 30, # Armenia
        "UZ" => 30, # Uzbekistan
        "TM" => 30, # Turkmenistan
        "TJ" => 30, # Tajikistan
        "MD" => 30, # Moldova
        "KG" => 30, # Kyrgyzstan
        "TT" => 25, # Trinidad and Tobago
        "PH" => 25, # Philippines
        "IL" => 25, # Israel
        "IN" => 25, # India
        "TR" => 20, # Turkey
        "TN" => 20, # Tunisia
        "VN" => 15, # Vietnam
        "EG" => 15, # Egypt
        "VE" => 15, # Venezuela
        "GB" => 15, # United Kingdom
        "UA" => 15, # Ukraine
        "TH" => 15, # Thailand
        "CH" => 15, # Switzerland
        "SE" => 15, # Sweden
        "LK" => 15, # Sri Lanka
        "ES" => 15, # Spain
        "KR" => 15, # South Korea
        "ZA" => 15, # South Africa
        "SI" => 15, # Slovenia
        "SK" => 15, # Slovak Republic
        "PT" => 15, # Portugal
        "PL" => 15, # Poland
        "PK" => 15, # Pakistan
        "NO" => 15, # Norway
        "NZ" => 15, # New Zealand
        "NL" => 15, # Netherlands
        "MA" => 15, # Morocco
        "MT" => 15, # Malta
        "LU" => 15, # Luxembourg
        "LT" => 15, # Lithuania
        "LV" => 15, # Latvia
        "KZ" => 15, # Kazakhstan
        "JM" => 15, # Jamaica
        "IT" => 15, # Italy
        "IE" => 15, # Ireland
        "ID" => 15, # Indonesia
        "IS" => 15, # Iceland
        "HU" => 15, # Hungary
        "GR" => 15, # Greece
        "DE" => 15, # Germany
        "FR" => 15, # France
        "FI" => 15, # Finland
        "EE" => 15, # Estonia
        "DK" => 15, # Denmark
        "CZ" => 15, # Czech Republic
        "CY" => 15, # Cyprus
        "CA" => 15, # Canada
        "BE" => 15, # Belgium
        "BB" => 15, # Barbados
        "BD" => 15, # Bangladesh
        "AT" => 15, # Austria
        "AU" => 15, # Australia
        "RO" => 10, # Romania
        "MX" => 10, # Mexico
        "JP" => 10, # Japan
        "CN" => 10, # China
        "BG" => 10, # Bulgaria
        "HR" => 15, # Croatia
      }
    end
end
