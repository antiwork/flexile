# frozen_string_literal: true

class Onetime::FixInvalidLegalNames
  def self.perform(dry_run: true)
    if dry_run
      puts "DRY RUN MODE - No changes will be made"
      puts ""
    else
      puts "LIVE MODE - Invalid legal names will be reset to NULL!"
      puts ""
    end

    puts "Searching for users with invalid single-word legal names..."

    invalid_users = User.where.not(legal_name: nil)
                        .where.not("legal_name ~ ?", User::LEGAL_NAME_FORMAT.source)
                        .order(:id)

    if invalid_users.empty?
      puts "No users with invalid legal names found!"
      return
    end

    puts "\nFound #{invalid_users.count} user(s) with invalid legal names:"
    puts "================================================================================"

    total_updated = 0

    invalid_users.each do |user|
      puts "\nUser ID: #{user.id}"
      puts "  Email: #{user.email}"
      puts "  Current legal_name: '#{user.legal_name}'"
      puts "  Preferred name: '#{user.preferred_name || 'N/A'}'"

      if dry_run
        puts "  [DRY RUN] Would set legal_name to NULL"
      else
        user.update_column(:legal_name, nil)
        puts "  ✓ Set legal_name to NULL"
      end
      total_updated += 1
    end

    puts "\n" + "================================================================================"
    puts "Summary:"
    puts "  Users with invalid legal names: #{invalid_users.count}"
    if dry_run
      puts "  Users that would be updated: #{total_updated}"
      puts "\n✓ Dry run complete! No changes were made."
      puts "   To actually reset invalid legal names, run: DRY_RUN=false rails data:cleanup_invalid_legal_names"
    else
      puts "  Users updated: #{total_updated}"
      puts "\n✓ Cleanup complete!"
    end
  end
end
