# frozen_string_literal: true

class TaxDocuments::FormW9Serializer < TaxDocuments::BaseSerializer
  FORM_FIELDS = {
    taxpayer_name: "topmostSubform[0].Page1[0].f1_1[0]",
    address: "topmostSubform[0].Page1[0].Address[0].f1_7[0]",
    city_state_zip: "topmostSubform[0].Page1[0].Address[0].f1_8[0]",

    # Federal tax classification checkboxes and text fields
    individual_or_sole_proprietor_or_small_llc_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[0]",
    c_corporation_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[1]",
    s_corporation_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[2]",
    partnership_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[3]",
    trust_or_estate_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[4]",
    # LLC checkbox and tax classification (part of federal tax classification)
    llc_checkbox: "topmostSubform[0].Page1[0].FederalClassification[0].c1_1[5]",
    llc_tax_classification: "topmostSubform[0].Page1[0].FederalClassification[0].f1_3[0]",

    ssn_part_1: "topmostSubform[0].Page1[0].SSN[0].f1_11[0]",
    ssn_part_2: "topmostSubform[0].Page1[0].SSN[0].f1_12[0]",
    ssn_part_3: "topmostSubform[0].Page1[0].SSN[0].f1_13[0]",
    ein_part_1: "topmostSubform[0].Page1[0].EmployerID[0].f1_14[0]",
    ein_part_2: "topmostSubform[0].Page1[0].EmployerID[0].f1_15[0]",
  }.freeze

  def attributes
    result = {
      FORM_FIELDS[:taxpayer_name] => normalized_tax_field(billing_entity_name),
      FORM_FIELDS[:address] => normalized_street_address,
      FORM_FIELDS[:city_state_zip] => normalized_tax_field(city_state_zip_code),
    }

    if business_entity?
      if business_type == "llc"
        result[FORM_FIELDS[:llc_checkbox]] = true
        # Tax classification for LLC in the f: C=C corporation, S=S corporation, P=Partnership
        result[FORM_FIELDS[:llc_tax_classification]] = tax_classification[0].upcase
      elsif business_type == "c_corporation"
        result[FORM_FIELDS[:c_corporation_checkbox]] = true
      elsif business_type == "s_corporation"
        result[FORM_FIELDS[:s_corporation_checkbox]] = true
      elsif business_type == "partnership"
        result[FORM_FIELDS[:partnership_checkbox]] = true
      end

      result[FORM_FIELDS[:ein_part_1]] = tax_id.to_s[0..1]
      result[FORM_FIELDS[:ein_part_2]] = tax_id.to_s[2..8]
    else
      result[FORM_FIELDS[:individual_or_sole_proprietor_or_small_llc_checkbox]] = true

      result[FORM_FIELDS[:ssn_part_1]] = tax_id.to_s[0..2]
      result[FORM_FIELDS[:ssn_part_2]] = tax_id.to_s[3..4]
      result[FORM_FIELDS[:ssn_part_3]] = tax_id.to_s[5..8]
    end

    result
  end
end
