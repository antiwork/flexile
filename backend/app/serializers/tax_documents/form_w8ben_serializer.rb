# frozen_string_literal: true

class TaxDocuments::FormW8benSerializer < TaxDocuments::BaseSerializer
  def attributes
    country_name = ISO3166::Country[country_code].common_name
    result = {
      "topmostSubform[0].Page1[0].f_1[0]" => normalized_tax_field(billing_entity_name),
      "topmostSubform[0].Page1[0].f_2[0]" => ISO3166::Country[citizenship_country_code].common_name,
      "topmostSubform[0].Page1[0].f_3[0]" => normalized_street_address,
      "topmostSubform[0].Page1[0].f_4[0]" => normalized_tax_field(city_state_zip_code),
      "topmostSubform[0].Page1[0].f_5[0]" => country_name,
      "topmostSubform[0].Page1[0].f_10[0]" => tax_id,
      # Certification
      "topmostSubform[0].Page1[0].c1_02[0]" => true,
      "topmostSubform[0].Page1[0].Date[0]" => Date.today.strftime("%m-%d-%Y"),
      "topmostSubform[0].Page1[0].f_21[0]" => normalized_tax_field(legal_name),
    }
    result["topmostSubform[0].Page1[0].f_12[0]"] = birth_date.strftime("%m-%d-%Y") if birth_date.present?

    if TAX_TREATY_COUNTRY_CODES.include?(country_code)
      # Claim of tax treaty benefits
      result["topmostSubform[0].Page1[0].f_13[0]"] = country_name
      result["topmostSubform[0].Page1[0].f_14[0]"] = "Article VII (Business Profits)"
      result["topmostSubform[0].Page1[0].f_15[0]"] = "0"
      result["topmostSubform[0].Page1[0].f_17[0]"] = "Services"
      result["topmostSubform[0].Page1[0].f_18[0]"] = "All work is performed in #{country_name}"
    end

    result
  end
end
