# frozen_string_literal: true

class TaxDocuments::BaseSerializer < BaseSerializer
  INVALID_CHARACTERS_REGEX = /[^0-9A-Za-z\s,-]/
  private_constant :INVALID_CHARACTERS_REGEX

  delegate :user, :legal_name, :business_name, :country_code, :citizenship_country_code,
           :street_address, :city, :state, :zip_code, :tax_id, :birth_date, to: :object, private: true
  delegate :business_entity?, :billing_entity_name, :business_type, :tax_classification, to: :user, private: true

  def initialize(object, tax_year = nil, company)
    @object = object
    @tax_year = tax_year
    @company = company
  end

  private
    attr_reader :tax_year, :company

    def normalized_tax_field(field)
      I18n.transliterate(field).gsub(INVALID_CHARACTERS_REGEX, "")
    end

    def normalized_street_address
      normalized_tax_field(street_address.tr("/", "-"))
    end

    def city_state_zip_code
      "#{city}, #{state} #{zip_code}"
    end

    def full_city_address
      "#{city}, #{state}, #{country_code}, #{zip_code}"
    end

    def formatted_recipient_tin
      business_entity? ?
        tax_id.to_s[0..1] + "-" + tax_id.to_s[2..8] :
        tax_id.to_s[0..2] + "-" + tax_id.to_s[3..4] + "-" + tax_id.to_s[5..8]
    end

    def formatted_tax_year
      tax_year.to_s.last(2)
    end
end
