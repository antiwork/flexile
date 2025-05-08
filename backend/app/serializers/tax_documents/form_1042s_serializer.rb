# frozen_string_literal: true

class TaxDocuments::Form1042sSerializer < TaxDocuments::BaseSerializer
  TAX_FORM_COPIES = %w[A B C D E].freeze

  def attributes
    TAX_FORM_COPIES.each_with_object({}) do |tax_form_copy, result|
      result.merge!(form_fields_for(tax_form_copy))
    end
  end

  private
    def form_fields_for(tax_form_copy)
      {
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_03[0]" => "06",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_04[0]" => dividends_amount_in_usd.to_s,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].Lines3_b[0].f1_05[0]" => "3",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].Lines3_b[0].f1_06[0]" => exemption_code,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].Lines3_b[0].f1_07[0]" => tax_withholding_percentage.to_s,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].Lines3_b[0].f1_08[0]" => "00",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_09[0]" => "15",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_10[0]" => "00",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_11[0]" => "00",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_13[0]" => dividends_net_amount_in_usd.to_s,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_14[0]" => dividends_tax_amount_withheld_in_usd.to_s,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_17[0]" => dividends_tax_amount_withheld_in_usd.to_s,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_19[0]" => payer_tin,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_20[0]" => "15",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_21[0]" => "02",
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_22[0]" => company.name,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_24[0]" => company.country_code,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_26[0]" => company.street_address,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_27[0]" => payer_details,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_28[0]" => normalized_tax_field(billing_entity_name),
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_29[0]" => country_code,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_30[0]" => normalized_street_address,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f1_31[0]" => normalized_tax_field(full_city_address),
        "topmostSubform[0].Copy#{tax_form_copy}[0].RightCol[0].f1_33[0]" => "16",
        "topmostSubform[0].Copy#{tax_form_copy}[0].RightCol[0].f1_34[0]" => "23",
        "topmostSubform[0].Copy#{tax_form_copy}[0].RightCol[0].f1_36[0]" => tax_id,
      }
    end

    def dividends_for_tax_year
      @_dividends_for_tax_year ||= investor.dividends.for_tax_year(tax_year)
    end

    def dividends_amount_in_usd
      @_dividends_amount_in_usd ||= (dividends_for_tax_year.sum(:total_amount_in_cents) / 100.to_d).round
    end

    def dividends_net_amount_in_usd
      @_dividends_net_amount_in_usd ||= (dividends_for_tax_year.sum(:net_amount_in_cents) / 100.to_d).round
    end

    def dividends_tax_amount_withheld_in_usd
      @_dividends_tax_amount_withheld_in_usd ||= (dividends_for_tax_year.sum(:withheld_tax_cents) / 100.to_d).round
    end

    def tax_withholding_percentage
      @_tax_withholding_percentage ||= dividends_for_tax_year.first.withholding_percentage
    end

    def exemption_code
      tax_withholding_percentage == TaxWithholdingCalculator::TAX_RATE_FOR_COUNTRIES_WITHOUT_TREATY ? "00" : "04"
    end

    def investor
      @_investor ||= user.company_investor_for(company)
    end

    def payer_details
      [
        company.city,
        company.state,
        company.country_code,
        company.zip_code,
      ].join(", ")
    end

    def payer_tin
      tin = company.tax_id

      raise "No TIN found for company #{company.id}" unless tin.present?

      tin[0..1] + "-" + tin[2..8]
    end
end
