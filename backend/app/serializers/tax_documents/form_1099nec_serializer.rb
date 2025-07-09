# frozen_string_literal: true

class TaxDocuments::Form1099necSerializer < TaxDocuments::BaseSerializer
  TAX_FORM_COPIES = %w[A 1 B 2 C].freeze

  def attributes
    TAX_FORM_COPIES.each_with_object({}) do |tax_form_copy, result|
      result.merge!(form_fields_for(tax_form_copy))
    end
  end

  private
    def header_for(tax_form_copy)
      case tax_form_copy
      when "A"
        "Pg"
      when "2"
        "CopyC"
      else
        "Copy#{tax_form_copy}"
      end
    end

    def form_fields_for(tax_form_copy)
      page_number = tax_form_copy == "A" ? "1" : "2"

      {
        "topmostSubform[0].Copy#{tax_form_copy}[0].#{header_for(tax_form_copy)}Header[0].CalendarYear[0].f#{page_number}_1[0]" => tax_year.to_s.last(2),
        # Payer information
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_2[0]" => payer_details,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_3[0]" => payer_tin,
        # Recipient information
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_4[0]" => formatted_recipient_tin,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_5[0]" => normalized_tax_field(billing_entity_name),
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_6[0]" => normalized_street_address,
        "topmostSubform[0].Copy#{tax_form_copy}[0].LeftColumn[0].f#{page_number}_7[0]" => normalized_tax_field(full_city_address),
        # Nonemployee compensation
        "topmostSubform[0].Copy#{tax_form_copy}[0].RightColumn[0].f#{page_number}_9[0]" => compensation_amount_for_tax_year(tax_year),
      }
    end

    def contractor
      @_contractor ||= user.company_worker_for(company)
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

    def compensation_amount_for_tax_year(tax_year)
      @_amount ||= (contractor.invoices.alive.for_tax_year(tax_year).sum(:cash_amount_in_cents) / 100.to_d).round.to_s
    end
end
