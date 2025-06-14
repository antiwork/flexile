# frozen_string_literal: true

class ImportShareHoldings
  attr_reader :errors

  def initialize(user_mapping_csv:, share_data_csv:)
    @user_mapping_csv = user_mapping_csv
    @share_data_csv = share_data_csv
    @errors = []
  end

  def process
    name_to_user_mapping = {}

    puts "Building name -> user mapping"
    CSV.parse(@user_mapping_csv, headers: true).each do |row|
      next if row["Email"].blank? || row["Name"].blank?

      email = row["Email"]
      email = test_email if !Rails.env.production?
      name = row["Name"]
      puts "Processing email #{email}"
      name_to_user_mapping[name] = User.find_by!(email:)
    end

    puts "Processing share data"
    CSV.parse(@share_data_csv, headers: true).each do |row|
      next if row["Security"].blank? || row["Security"] == "Security"

      attrs = {
        name: row["Security"],
        share_class_id: ShareClass.find_by(name: row["Share Class"], company: gumroad_company!).id,
        issued_at: row["Issue Date"],
        originally_acquired_at: row["Issue Date"],
        number_of_shares: row["Shares"].to_i,
        share_price_usd: row["Price"].delete_prefix("$").to_d,
        total_amount_in_cents: (row["Total"].to_f * 100).to_i,
      }

      puts "Processing security #{row["Security"]}"

      user = name_to_user_mapping[row["Holder"]]
      company_investor = user.company_investors.find_by(company: gumroad_company!)
      if company_investor.nil?
        @errors << { name: row["Security"], error_message: "Could not find an investor record" }
        next
      end

      share = company_investor.share_holdings.build(**attrs, share_holder_name: user.legal_name)
      share.save
      if share.errors.present?
        @errors << { name: row["Security"], error_message: share.errors.full_messages.to_sentence }
        next
      end
    end
  end

  private
    def test_email
      @_test_email_id ||= 0
      @_test_email_id += 1
      "sharang.d+#{@_test_email_id}@gmail.com"
    end

    def gumroad_company!
      @_gumroad_company ||= Company.is_gumroad.sole
    end
end

=begin
user_mapping_csv = <<~CSV
  Name,Email
  John Doe,john@example.com
  Jane Smith,jane@example.com
CSV

share_data_csv = <<~CSV
  Security,Holder,Shares,Price,Total,Issue Date,Share Class
  Common Stock,John Doe,1000,$1.00,1000.00,2024-01-01,Common
  Preferred Stock,Jane Smith,500,$2.00,1000.00,2024-01-15,Preferred
CSV

service = ImportShareHoldings.new(user_mapping_csv: user_mapping_csv, share_data_csv: share_data_csv)
service.process; nil
puts service.errors
=end
