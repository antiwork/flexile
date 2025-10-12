# frozen_string_literal: true

require "csv"

class InvestorsCsv
  def initialize(company:, user_role:, new_schema: false)
    @company = company
    @user_role = user_role
    @new_schema = new_schema
  end

  def generate
    data = CapTableService.new(company: company, new_schema: new_schema).generate
    headers = build_headers(data)
    rows = build_rows(data)
    totals_row = build_totals_row(data)

    CSV.generate do |csv|
      csv << headers
      rows.each { |row| csv << row }
      csv << totals_row
    end
  end

  private
    attr_reader :company, :user_role, :new_schema

    def show_investor_email?
      %w[administrator lawyer].include?(user_role)
    end

    def build_headers(data)
      headers = ["Name", "Outstanding shares", "Outstanding ownership (%)", "Fully diluted shares", "Fully diluted ownership (%)"]
      data[:share_classes].each { headers << _1[:name] }
      data[:exercise_prices].each { headers << "Common options $#{sprintf("%.2f", _1)} strike" }

      headers
    end

    def build_rows(data)
      data[:investors].map do |investor|
        row = []
        row << investor_name(investor)

        outstanding = investor[:outstanding_shares] || 0
        row << outstanding

        ownership_percent = data[:outstanding_shares] > 0 ? (outstanding.to_f / data[:outstanding_shares]) * 100 : 0
        row << ownership_percent.round(2)

        fully_diluted = investor[:fully_diluted_shares] || 0
        row << fully_diluted

        fully_diluted_ownership_percent = data[:fully_diluted_shares] > 0 ? (fully_diluted.to_f / data[:fully_diluted_shares]) * 100 : 0
        row << fully_diluted_ownership_percent.round(2)

        data[:share_classes].each do |share_class|
          row << investor[:shares_by_class]&.dig(share_class[:name]) || 0
        end

        data[:exercise_prices].each do |price|
          row << investor[:options_by_strike]&.dig(price) || 0
        end

        row
      end
    end

    def investor_name(investor)
      return investor[:name] if !show_investor_email? || investor[:email].blank?

      "#{investor[:name]} #{investor[:email]}"
    end

    def build_totals_row(data)
      row = ["Total"]
      row << data[:outstanding_shares]
      row << 100
      row << data[:fully_diluted_shares]
      row << 100
      data[:share_classes].each do |share_class|
        row << data[:investors].sum { _1[:shares_by_class]&.dig(share_class[:name]) || 0 }
      end

      data[:exercise_prices].each do |price|
        row << data[:investors].sum { _1[:options_by_strike]&.dig(price) || 0 }
      end

      row
    end
end
