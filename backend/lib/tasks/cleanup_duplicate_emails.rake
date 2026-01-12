# frozen_string_literal: true

namespace :data do
  desc "Find and remove duplicate user emails (case-insensitive), keeping only the oldest account"
  task cleanup_duplicate_emails: :environment do
    dry_run = ENV["DRY_RUN"] != "false"

    if dry_run
      puts "DRY RUN MODE - No changes will be made"
      puts ""
    else
      puts "LIVE MODE - Duplicates will be deleted!"
      puts ""
    end

    puts "Searching for duplicate emails (case-insensitive)..."

    email_groups = User.all.group_by { |u| u.email&.downcase }
    duplicates = email_groups.select { |_email, users| users.size > 1 }

    if duplicates.empty?
      puts "No duplicate emails found!"
      exit 0
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
        puts "  Removing duplicate user ID #{dup_user.id} (created #{dup_user.created_at})"
        puts "    - Email: #{dup_user.email}"

        if dry_run
          puts "    [DRY RUN] Would delete this user"
        else
          dup_user.destroy
          puts "    ✓ Deleted"
        end
        total_removed += 1
      end
    end

    puts "\n" + "================================================================================"
    puts "Summary:"
    puts "  Duplicate email groups found: #{duplicates.size}"
    if dry_run
      puts "  Duplicate users that would be removed: #{total_removed}"
      puts "\n✓ Dry run complete! No changes were made."
      puts "   To actually delete duplicates, run: DRY_RUN=false rails data:cleanup_duplicate_emails"
    else
      puts "  Duplicate users removed: #{total_removed}"
      puts "\n✓ Cleanup complete!"
    end
  end
end
