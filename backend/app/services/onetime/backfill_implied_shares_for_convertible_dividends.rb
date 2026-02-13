# frozen_string_literal: true

# Onetime script to backfill implied_shares for existing convertible dividends.
# Dividends from convertibles have NULL number_of_shares; this script matches
# each dividend to its specific convertible_security via company_investor_id
# and investment_amount_cents = principal_value_in_cents, then sets
# number_of_shares to the security's implied_shares.
#
# Usage:
#   Onetime::BackfillImpliedSharesForConvertibleDividends.perform(dry_run: true)  # Preview only
#   Onetime::BackfillImpliedSharesForConvertibleDividends.perform(dry_run: false) # Actually update
class Onetime::BackfillImpliedSharesForConvertibleDividends
  def self.perform(dry_run: true)
    if dry_run
      puts "DRY RUN MODE - No changes will be made"
    else
      puts "LIVE MODE - Dividends will be updated"
    end
    puts ""

    dividends_to_update = Dividend.where(number_of_shares: nil)
    puts "Found #{dividends_to_update.count} dividends with NULL number_of_shares"
    puts "================================================================================"

    updated = 0
    skipped = 0

    dividends_to_update.find_each do |dividend|
      security = ConvertibleSecurity.find_by(
        company_investor_id: dividend.company_investor_id,
        principal_value_in_cents: dividend.investment_amount_cents
      )

      if security.nil?
        puts "  Skipped dividend ##{dividend.id} - no matching convertible security found"
        skipped += 1
        next
      end

      implied_shares_value = security.implied_shares.round

      if dry_run
        puts "  [DRY RUN] Would update dividend ##{dividend.id}: number_of_shares=#{implied_shares_value}, implied_shares=true"
      else
        dividend.update!(number_of_shares: implied_shares_value, implied_shares: true)
        puts "  Updated dividend ##{dividend.id}: number_of_shares=#{implied_shares_value}, implied_shares=true"
      end

      updated += 1
    end

    puts ""
    puts "================================================================================"
    puts "SUMMARY:"
    puts "  Updated: #{updated}"
    puts "  Skipped: #{skipped}"

    if dry_run
      puts "\nDry run complete! No changes were made."
      puts "To actually update, run with dry_run: false"
    else
      puts "\nBackfill complete!"
    end
  end
end
