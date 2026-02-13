# frozen_string_literal: true

# Onetime script to backfill investment_amount_cents on dividends
#
# Dividend rounds 9 and 12 are skipped
# because their investors were created via CSV import without corresponding share_holdings
# or convertible_securities records, the original CSV is needed for those.
#
# Usage:
#   Onetime::BackfillDividendInvestmentAmounts.perform(dry_run: true)   # Preview only
#   Onetime::BackfillDividendInvestmentAmounts.perform(dry_run: false)  # Actually update
class Onetime::BackfillDividendInvestmentAmounts
  SKIPPED_DIVIDEND_ROUND_IDS = [9, 12].freeze

  def self.perform(dry_run: true)
    new(dry_run:).perform
  end

  def initialize(dry_run: true)
    @dry_run = dry_run
    @updated_count = 0
    @skipped_count = 0
    @already_set_count = 0
    @zero_investment_entries = []
  end

  def perform
    puts dry_run ? "DRY RUN MODE - No changes will be made" : "LIVE MODE - Dividends will be updated"
    puts ""

    dividend_rounds = DividendRound.where.not(id: SKIPPED_DIVIDEND_ROUND_IDS).order(:id)
    puts "Processing #{dividend_rounds.count} dividend rounds (skipping IDs: #{SKIPPED_DIVIDEND_ROUND_IDS.join(', ')})..."
    puts "================================================================================"

    dividend_rounds.find_each do |dividend_round|
      process_dividend_round(dividend_round)
    end

    print_summary
  end

  private
    attr_reader :dry_run

    def process_dividend_round(dividend_round)
      puts "\n--- Dividend Round ##{dividend_round.id} (#{dividend_round.company.name}) ---"
      puts "    Issued at: #{dividend_round.issued_at}"

      dividend_round.dividends.includes(company_investor: [:share_holdings, :convertible_securities]).find_each do |dividend|
        process_dividend(dividend, dividend_round)
      end
    end

    def process_dividend(dividend, dividend_round)
      if dividend.investment_amount_cents.present? && dividend.investment_amount_cents > 0
        @already_set_count += 1
        return
      end

      company_investor = dividend.company_investor
      investment_amount = calculate_investment_amount(dividend, company_investor, dividend_round.issued_at)

      if investment_amount == 0
        @zero_investment_entries << { dividend_id: dividend.id, email: company_investor.user.email, dividend_round_id: dividend_round.id }
      end

      if dry_run
        puts "    [DRY RUN] Dividend ##{dividend.id} (#{company_investor.user.email}): would set investment_amount_cents = #{investment_amount}"
      else
        dividend.update_column(:investment_amount_cents, investment_amount)
        puts "    [UPDATED] Dividend ##{dividend.id} (#{company_investor.user.email}): investment_amount_cents = #{investment_amount}"
      end
      @updated_count += 1
    end

    def calculate_investment_amount(dividend, company_investor, issued_at)
      if dividend.number_of_shares.present?
        company_investor.share_holdings
          .where("issued_at <= ?", issued_at)
          .sum(:total_amount_in_cents)
      else
        company_investor.convertible_securities
          .where("issued_at <= ?", issued_at)
          .sum(:principal_value_in_cents)
      end
    end

    def print_summary
      puts "\n================================================================================"
      puts "SUMMARY:"
      puts "================================================================================"
      puts "  Updated: #{@updated_count}"
      puts "  Already set: #{@already_set_count}"
      puts "  Zero investment: #{@zero_investment_entries.size}"
      puts "  Skipped dividend rounds: #{SKIPPED_DIVIDEND_ROUND_IDS.join(', ')}"

      if @zero_investment_entries.any?
        puts "\n  Zero investment dividends:"
        @zero_investment_entries.each do |entry|
          puts "    - Dividend ##{entry[:dividend_id]} (DR ##{entry[:dividend_round_id]}, #{entry[:email]})"
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
