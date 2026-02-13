# frozen_string_literal: true

class TaxDocuments::Form1099bSerializer < TaxDocuments::BaseSerializer
  TAX_FORM_COPIES = %w[A 1 B 2].freeze

  def attributes
    TAX_FORM_COPIES.each_with_object({}) do |tax_form_copy, result|
      result.merge!(form_fields_for(tax_form_copy))
    end
  end

  private
    def form_fields_for(tax_form_copy)
      page = tax_form_copy == "A" ? "1" : "2"
      copy = "Copy#{tax_form_copy}"

      result = {
        # Payer information
        left_col_field(copy, page, "1") => payer_details,
        payer_tin_field(copy, page) => payer_tin,
        # Recipient information
        left_col_field(copy, page, "3") => formatted_recipient_tin,
        left_col_field(copy, page, "4") => normalized_tax_field(billing_entity_name),
        left_col_field(copy, page, "5") => normalized_street_address,
        left_col_field(copy, page, "6") => normalized_tax_field(full_city_address),
        # Box 1a: Description of property
        right_col_field(copy, page, "15") => property_description,
        # Box 1b: Date acquired
        right_col_field(copy, page, "16") => date_acquired_display,
        # Box 1c: Date sold or disposed
        right_col_field(copy, page, "17") => date_sold_display,
        # Box 1d: Proceeds
        box_field(copy, page, "Box1d", "19") => proceeds_in_usd.to_s,
        # Box 1e: Cost or other basis
        right_col_field(copy, page, "20") => cost_basis_in_usd.to_s,
      }

      # Box 2: Short-term or Long-term gain or loss
      # Each checkbox widget has a unique appearance value matching its 1-based position
      if long_term?
        result[box2_field(copy, page, 1)] = "2"
      else
        result[box2_field(copy, page, 0)] = "1"
      end

      # Box 5: Noncovered security (private company shares are noncovered)
      result[noncovered_field(copy, page)] = "1"

      # Box 6: Gross proceeds reported to IRS (checkbox index 0)
      result[box6_field(copy, page, 0)] = "1"

      if dividends_tax_amount_withheld_in_usd > 0
        result[box_field(copy, page, "Box4", "23")] = dividends_tax_amount_withheld_in_usd.to_s
      end

      result
    end

    # Field path helpers to handle the different container naming across copies
    # Copy A and Copy 2 use `_ReadOrder` suffix, Copy 1 and Copy B do not

    def left_col_field(copy, page, field_num)
      container = read_order_copy?(copy) ? "LeftCol_ReadOrder" : "LeftCol"
      "topmostSubform[0].#{copy}[0].#{container}[0].f#{page}_#{field_num}[0]"
    end

    def payer_tin_field(copy, page)
      if copy == "CopyA"
        "topmostSubform[0].#{copy}[0].LeftCol_ReadOrder[0].Payers_ReadOrder[0].f#{page}_2[0]"
      else
        "topmostSubform[0].#{copy}[0].#{read_order_copy?(copy) ? "LeftCol_ReadOrder" : "LeftCol"}[0].f#{page}_2[0]"
      end
    end

    def right_col_field(copy, page, field_num)
      container = read_order_copy?(copy) ? "RightCol_ReadOrder" : "RightCol"
      "topmostSubform[0].#{copy}[0].#{container}[0].f#{page}_#{field_num}[0]"
    end

    def box_field(copy, page, box_name, field_num)
      container = read_order_copy?(copy) ? "RightCol_ReadOrder" : "RightCol"
      box = read_order_copy?(copy) ? "#{box_name}_ReadOrder" : box_name
      "topmostSubform[0].#{copy}[0].#{container}[0].#{box}[0].f#{page}_#{field_num}[0]"
    end

    def box2_field(copy, page, index)
      container = read_order_copy?(copy) ? "RightCol_ReadOrder" : "RightCol"
      box = read_order_copy?(copy) ? "Box2_ReadOrder" : "Box2"
      "topmostSubform[0].#{copy}[0].#{container}[0].#{box}[0].c#{page}_4[#{index}]"
    end

    def noncovered_field(copy, page)
      container = read_order_copy?(copy) ? "RightCol_ReadOrder" : "RightCol"
      "topmostSubform[0].#{copy}[0].#{container}[0].c#{page}_6[0]"
    end

    def box6_field(copy, page, index)
      container = read_order_copy?(copy) ? "RightCol_ReadOrder" : "RightCol"
      box = read_order_copy?(copy) ? "Box6_ReadOrder" : "Box6"
      "topmostSubform[0].#{copy}[0].#{container}[0].#{box}[0].c#{page}_7[#{index}]"
    end

    def read_order_copy?(copy)
      copy.in?(%w[CopyA Copy2])
    end

    # Data methods

    def roc_dividend_amounts_for_tax_year
      @_roc_dividend_amounts_for_tax_year ||= investor.dividends
                                                      .for_tax_year(tax_year)
                                                      .return_of_capital
                                                      .pluck(
                                                        "SUM(dividends.total_amount_in_cents)",
                                                        "SUM(dividends.withheld_tax_cents)",
                                                        "SUM(dividends.number_of_shares)",
                                                        "SUM(dividends.investment_amount_cents)"
                                                      )
                                                      .flatten
    end

    def roc_dividends_for_tax_year
      @_roc_dividends_for_tax_year ||= investor.dividends
                                               .for_tax_year(tax_year)
                                               .return_of_capital
                                               .includes(:dividend_round)
    end

    def investor
      @_investor ||= user.company_investor_for(company)
    end

    def property_description
      total_shares = roc_dividend_amounts_for_tax_year[2] || 0
      "#{total_shares} sh. #{company.name}"
    end

    def date_acquired_display
      dates = investor.share_holdings.pluck(:originally_acquired_at).uniq
      dates.size == 1 ? dates.first.strftime("%m/%d/%Y") : "Various"
    end

    def date_sold_display
      dates = roc_dividends_for_tax_year.filter_map(&:paid_at).map(&:to_date).uniq
      dates.size == 1 ? dates.first.strftime("%m/%d/%Y") : "Various"
    end

    def proceeds_in_usd
      @_proceeds_in_usd ||= ((roc_dividend_amounts_for_tax_year[0] || 0) / 100.to_d).round
    end

    def cost_basis_in_usd
      @_cost_basis_in_usd ||= ((roc_dividend_amounts_for_tax_year[3] || 0) / 100.to_d).round
    end

    def dividends_tax_amount_withheld_in_usd
      @_dividends_tax_amount_withheld_in_usd ||= ((roc_dividend_amounts_for_tax_year[1] || 0) / 100.to_d).round
    end

    def long_term?
      earliest_acquired = investor.share_holdings.minimum(:originally_acquired_at)
      latest_sold = roc_dividends_for_tax_year.filter_map(&:paid_at).max
      return true unless earliest_acquired && latest_sold
      (latest_sold.to_date - earliest_acquired.to_date).to_i > 365
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
