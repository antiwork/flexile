# frozen_string_literal: true

# Backfills investment_amount_cents on dividends for CSV-imported rounds
# that have no share_holdings or convertible_securities records.
#
# The investment amount is read directly from the original CSV's
# "investment_amount" column and matched to dividends via email.
#
# Usage:
#   csv_data = <<~CSV
#     name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount
#     Alice Smith,Alice Marie Smith,100 Oak Ave,,Austin,TX,73301,US,alice@example.com,2024-03-01,"$25,000.00",111-22-3333,,1250.00
#     Bob Johnson,Robert Lee Johnson,200 Pine St,Apt 4B,Denver,CO,80201,US,bob@example.com,2024-03-01,"$50,000.00",444-55-6666,,2500.00
#     Carol Chen,Carol Wei Chen,300 Elm Blvd,,Seattle,WA,98101,US,carol@example.com,2024-03-01,"$10,000.00",777-88-9999,Chen Ventures LLC,500.00
#   CSV
#   Onetime::BackfillCsvDividendInvestmentAmounts.perform(dividend_round_id: 9, csv_data:, dry_run: true)
#   Onetime::BackfillCsvDividendInvestmentAmounts.perform(dividend_round_id: 9, csv_data:, dry_run: false)
class Onetime::BackfillCsvDividendInvestmentAmounts
  def self.perform(dividend_round_id:, csv_data:, dry_run: true)
    new(dividend_round_id:, csv_data:, dry_run:).perform
  end

  def initialize(dividend_round_id:, csv_data:, dry_run: true)
    @dividend_round = DividendRound.find(dividend_round_id)
    @csv_data = csv_data
    @dry_run = dry_run
    @updated_count = 0
    @skipped_count = 0
    @matched_by_name = []
    @not_found_entries = []
  end

  def perform
    puts dry_run ? "DRY RUN MODE - No changes will be made" : "LIVE MODE - Dividends will be updated"
    puts "Dividend Round ##{dividend_round.id} (#{dividend_round.company.name})"
    puts "================================================================================"

    csv_rows = CSV.parse(csv_data, headers: true)
    puts "CSV rows: #{csv_rows.size}"

    csv_rows.each do |row|
      process_row(row)
    end

    print_summary
  end

  private
    attr_reader :dividend_round, :csv_data, :dry_run

    def process_row(row)
      email = row["email"]&.strip&.downcase
      legal_name = row["full_legal_name"]&.strip
      return if email.blank?

      investment_amount_cents = clean_currency_to_cents(row["investment_amount"])

      dividend, matched_via = find_dividend(email, legal_name)
      unless dividend
        @not_found_entries << { email:, legal_name: }
        return
      end

      if matched_via == :legal_name
        @matched_by_name << { csv_email: email, current_email: dividend.company_investor.user.email, legal_name: }
        puts "  [NAME MATCH] #{email} → matched by legal name '#{legal_name}' (current email: #{dividend.company_investor.user.email})"
      end

      if dividend.investment_amount_cents.present? && dividend.investment_amount_cents > 0
        puts "  [SKIP] #{email}: already set to #{dividend.investment_amount_cents}"
        @skipped_count += 1
        return
      end

      if dry_run
        puts "  [DRY RUN] #{email}: would set investment_amount_cents = #{investment_amount_cents}"
      else
        dividend.update_column(:investment_amount_cents, investment_amount_cents)
        puts "  [UPDATED] #{email}: investment_amount_cents = #{investment_amount_cents}"
      end
      @updated_count += 1
    end

    def find_dividend(email, legal_name)
      user = User.find_by(email:)
      if user
        company_investor = user.company_investors.find_by(company: dividend_round.company)
        if company_investor
          dividend = company_investor.dividends.find_by(dividend_round:)
          return [dividend, :email] if dividend
        end
      end

      return [nil, nil] if legal_name.blank?

      company_investor = dividend_round.company.company_investors
        .joins(:user)
        .find_by(user: { legal_name: })

      return [nil, nil] unless company_investor

      dividend = company_investor.dividends.find_by(dividend_round:)
      [dividend, :legal_name]
    end

    def clean_currency_to_cents(value)
      return 0 if value.blank?

      (value.gsub(/[^0-9.]/, "").to_d * 100).to_i
    end

    def print_summary
      puts "\n================================================================================"
      puts "SUMMARY:"
      puts "================================================================================"
      puts "  Updated: #{@updated_count}"
      puts "  Skipped (already set): #{@skipped_count}"
      puts "  Matched by name (email changed): #{@matched_by_name.size}"
      puts "  Not found: #{@not_found_entries.size}"

      if @matched_by_name.any?
        puts "\n  Matched by legal name (user changed email):"
        @matched_by_name.each do |entry|
          puts "    - CSV: #{entry[:csv_email]} → Current: #{entry[:current_email]} (#{entry[:legal_name]})"
        end
      end

      if @not_found_entries.any?
        puts "\n  Not found in dividend round:"
        @not_found_entries.each do |entry|
          puts "    - #{entry[:email]} (#{entry[:legal_name]})"
        end
      end

      if dry_run
        puts "\n✓ Dry run complete! No changes were made."
        puts "  To actually update, run with dry_run: false"
      else
        puts "\n✓ Backfill complete!"
      end
    end
end
