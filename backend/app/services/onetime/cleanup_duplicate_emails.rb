# frozen_string_literal: true

class Onetime::CleanupDuplicateEmails
  def self.perform(dry_run: true)
    if dry_run
      puts "DRY RUN MODE - No changes will be made"
      puts ""
    else
      puts "LIVE MODE - Duplicates will be archived!"
      puts ""
    end

    puts "Searching for duplicate emails (case-insensitive)..."

    email_groups = User.all.group_by { |u| u.email&.downcase }
    duplicates = email_groups.select { |_email, users| users.size > 1 }

    if duplicates.empty?
      puts "No duplicate emails found!"
      return
    end

    puts "\nFound #{duplicates.size} email(s) with duplicates:"
    puts "================================================================================"

    total_removed = 0

    duplicates.each do |email, users|
      users_sorted = users.sort_by(&:created_at)
      primary_user = users_sorted.first
      duplicate_users = users_sorted[1..]

      puts "\nEmail: #{email}"
      puts "  Keeping user ID #{primary_user.id} (created #{primary_user.created_at})"
      puts "    - Email: #{primary_user.email}"

      duplicate_users.each do |dup_user|
        original_email = dup_user.email
        deduped_email = "#{dup_user.email}.#{dup_user.id}.deduped.example.com"

        puts "  Archiving duplicate user ID #{dup_user.id} (created #{dup_user.created_at})"
        puts "    - Original email: #{original_email}"
        puts "    - New email: #{deduped_email}"

        if dry_run
          puts "    [DRY RUN] Would update email to #{deduped_email}"
        else
          dup_user.update!(email: deduped_email)
          puts "    ✓ Email updated"
        end
        total_removed += 1
      end
    end

    puts "\n" + "================================================================================"
    puts "Summary:"
    puts "  Duplicate email groups found: #{duplicates.size}"
    if dry_run
      puts "  Duplicate users that would be archived: #{total_removed}"
      puts "\n✓ Dry run complete! No changes were made."
      puts "   To actually archive duplicates, run with dry_run: false"
    else
      puts "  Duplicate users archived: #{total_removed}"
      puts "\n✓ Cleanup complete!"
      puts "   Archived user emails have been renamed to *.<user_id>.deduped.example.com"
    end
  end
end
