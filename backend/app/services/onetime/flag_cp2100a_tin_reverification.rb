# frozen_string_literal: true

# Onetime script to flag users from IRS CP 2100A notice for TIN re-verification
# Usage:
#   tins = %w[111111111 222222222]
#   Onetime::FlagCp2100aTinReverification.perform(tins:, dry_run: true)  # Preview only
#   Onetime::FlagCp2100aTinReverification.perform(tins:, dry_run: false) # Actually flag users
class Onetime::FlagCp2100aTinReverification
  def self.perform(tins:, dry_run: true)
    if dry_run
      puts "DRY RUN MODE - No changes will be made"
      puts ""
    else
      puts "LIVE MODE - Users will be flagged for TIN re-verification"
      puts ""
    end

    puts "Processing #{tins.count} TINs from IRS CP 2100A notice..."
    puts "================================================================================"

    found_users = []
    not_found_tins = []

    all_compliance_infos = UserComplianceInfo.alive.where.not(tax_id: nil).includes(:user)

    tins.each do |tin|
      compliance_info = all_compliance_infos.find { |ci| ci.tax_id == tin }

      if compliance_info.nil?
        not_found_tins << tin
        next
      end

      user = compliance_info.user
      found_users << {
        user:,
        compliance_info:,
        tin:,
      }
    end

    puts "\n=== FOUND USERS (#{found_users.count}) ==="
    puts "================================================================================"

    if found_users.any?
      found_users.each_with_index do |data, index|
        user = data[:user]
        tin = data[:tin]

        puts "\n#{index + 1}. User ID: #{user.id}"
        puts "   Email: #{user.email}"
        puts "   Name: #{user.name}"
        puts "   Legal Name: #{user.legal_name}"
        puts "   TIN: ***#{tin[-4..]}"
        puts "   Current Status: #{data[:compliance_info].requires_tin_reverification ? 'Already flagged' : 'Not flagged'}"

        if dry_run
          puts "   [DRY RUN] Would flag this user for TIN re-verification and send email"
        else
          begin
            data[:compliance_info].update!(
              requires_tin_reverification: true,
              tax_id_status: nil
            )
            UserMailer.tin_reverification_required(user.id).deliver_later
            puts "   ✓ Flagged for TIN re-verification and email sent"
          rescue => e
            puts "   ✗ Error: #{e.message}"
          end
        end
      end
    else
      puts "No users found with the provided TINs"
    end

    if not_found_tins.any?
      puts "\n=== NOT FOUND TINS (#{not_found_tins.count}) ==="
      puts "================================================================================"
      not_found_tins.each do |tin|
        puts "   ***#{tin[-4..]}"
      end
    end

    puts "\n================================================================================"
    puts "SUMMARY:"
    puts "================================================================================"
    puts "  Total TINs processed: #{tins.count}"
    puts "  Users found: #{found_users.count}"
    puts "  TINs not found: #{not_found_tins.count}"

    if dry_run
      puts "\n✓ Dry run complete! No changes were made."
      puts "   To actually flag users and send emails, run with dry_run: false"
    else
      puts "\n✓ Flagging complete!"
      puts "   Users have been flagged for TIN re-verification and emails have been sent."
    end
  end
end
