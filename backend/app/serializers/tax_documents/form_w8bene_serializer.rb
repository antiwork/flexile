# frozen_string_literal: true

class TaxDocuments::FormW8beneSerializer < TaxDocuments::BaseSerializer
  def attributes
    country_name = ISO3166::Country[country_code].common_name
    result = {
      "topmostSubform[0].Page1[0].f1_1[0]" => normalized_tax_field(billing_entity_name),
      "topmostSubform[0].Page1[0].f1_2[0]" => country_name,
      "topmostSubform[0].Page1[0].c1_1[0]" => true, # Corporation
      "topmostSubform[0].Page1[0].Col2[0].c1_3[13]" => true, # Active NFFE
      "topmostSubform[0].Page1[0].f1_4[0]" => normalized_street_address,
      "topmostSubform[0].Page1[0].f1_5[0]" => normalized_tax_field(city_state_zip_code),
      "topmostSubform[0].Page1[0].f1_6[0]" => country_name,
      "topmostSubform[0].Page2[0].Line9b_ReadOrder[0].f2_3[0]" => tax_id, # FTIN
      # Active NFFE certification
      "topmostSubform[0].Page7[0].c7_5[0]" => true,
      # Certification
      "topmostSubform[0].Page8[0].c8_3[0]" => true,
      "topmostSubform[0].Page8[0].f8_31[0]" => normalized_tax_field(legal_name),
      "topmostSubform[0].Page8[0].f8_32[0]" => Date.today.strftime("%m-%d-%Y"),
    }

    if TAX_TREATY_COUNTRY_CODES.include?(country_code)
      # Claim of tax treaty benefits
      result["topmostSubform[0].Page2[0].c2_3[0]"] = true # Certify that the beneficial owner is a resident of the treaty country
      result["topmostSubform[0].Page2[0].f2_9[0]"] = country_name
      result["topmostSubform[0].Page2[0].c2_4[0]"] = true # Beneficial owner derives the item of income
      result["topmostSubform[0].Page2[0].c2_5[2]"] = true # Company with an item of income that meets active trade or business test
      # Special rates and conditions
      result["topmostSubform[0].Page2[0].f2_11[0]"] = "Article VII (Business Profits)"
      result["topmostSubform[0].Page2[0].f2_12[0]"] = "0"
      result["topmostSubform[0].Page2[0].f2_14[0]"] = "Services"
      result["topmostSubform[0].Page2[0].f2_15[0]"] = "All work is performed in #{country_name}"
    end

    result
  end
end
