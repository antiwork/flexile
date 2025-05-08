# frozen_string_literal: true

class TaxDocuments::Form1099divSerializer < TaxDocuments::BaseSerializer
  TAX_FORM_COPIES = %w[A 1 B 2 C].freeze

  def attributes
    TAX_FORM_COPIES.each_with_object({}) do |tax_form_copy, result|
      result.merge!(form_fields_for(tax_form_copy))
    end
  end

  private
    def form_fields_for(tax_form_copy)
      page_number = tax_form_copy == "A" ? "1" : "2"

      result = {
        "topmostSubform[0].Copy#{tax_form_copy}[0].Copy#{tax_form_copy}Header[0].CalendarYear[0].f#{page_number}_1[0]" => formatted_tax_year,
        # Payer information
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_2[0]" => payer_details,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_3[0]" => payer_tin,
        # Recipient information
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_4[0]" => formatted_recipient_tin,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_5[0]" => normalized_tax_field(billing_entity_name),
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_6[0]" => normalized_street_address,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftCol[0].f#{page_number}_7[0]" => normalized_tax_field(full_city_address),
        # Total ordinary dividends
        "topmostSubform[0].Copy#{tax_form_copy}[0].RghtCol[0].f#{page_number}_9[0]" => dividends_amount_in_usd.to_s,
      }

      if qualified_amount_in_usd > 0
        # Qualified dividends amount
        result["topmostSubform[0].Copy#{tax_form_copy}[0].RghtCol[0].f#{page_number}_10[0]"] = qualified_amount_in_usd.to_s
      end

      if dividends_tax_amount_withheld_in_usd > 0
        # Federal income tax withheld
        result["topmostSubform[0].Copy#{tax_form_copy}[0].RghtCol[0].f#{page_number}_18[0]"] = dividends_tax_amount_withheld_in_usd.to_s
      end

      result
    end

    def dividend_amounts_for_tax_year
      @_dividend_amounts_for_tax_year ||= investor.dividends
                                                  .for_tax_year(tax_year)
                                                  .pluck("SUM(total_amount_in_cents), SUM(withheld_tax_cents), SUM(qualified_amount_cents)")
                                                  .flatten
    end

    def dividends_amount_in_usd
      @_dividend_amount_in_usd ||= (dividend_amounts_for_tax_year[0] / 100.to_d).round
    end

    def dividends_tax_amount_withheld_in_usd
      @_dividend_tax_withheld_amount ||= (dividend_amounts_for_tax_year[1] / 100.to_d).round
    end

    def qualified_amount_in_usd
      @_qualified_amount_in_usd ||= (dividend_amounts_for_tax_year[2] / 100.to_d).round
    end

    def investor
      @_investor ||= user.company_investor_for(company)
    end

    def payer_details
      [
        company.name,
        company.street_address,
        company.city,
        company.state,
        company.display_country,
        company.zip_code,
        company.phone_number,
      ].join(", ")
    end

    def payer_tin
      tin = company.tax_id

      raise "No TIN found for company #{company.id}" unless tin.present?

      tin[0..1] + "-" + tin[2..8]
    end
end
