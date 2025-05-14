# frozen_string_literal: true

class ImportShareHoldings
  attr_reader :errors

  def initialize(file_path)
    @file_path = file_path
    @errors = []
  end

  def process
    name_to_user_mapping = {}

    workbook = RubyXL::Parser.parse(@file_path)
    worksheet = workbook[1]
    header = worksheet[0].cells.map(&:value)

    attribute_to_column_mapping = {
      legal_name: header.index("Name"),
      email: header.index("Email"),
    }

    puts "Building name -> user mapping"
    worksheet.drop(1).each do |row| # drop the header row
      next if row.nil?

      email = row[attribute_to_column_mapping[:email]].value
      email = test_email if !Rails.env.production?
      name = row[attribute_to_column_mapping[:legal_name]].value
      puts "Processing email #{email}"
      name_to_user_mapping[name] = User.find_by!(email:)
    end

    worksheet = workbook[0]
    worksheet.each do |row|
      next if row.nil? || row[0].nil?
      next if row[0].value.blank? || row[0].value == "Security"

      attrs = {
        name: row[0].value,
        share_class_id: ShareClass.find_by(name: row[7].value, company: gumroad_company!).id,
        issued_at: row[6].value,
        originally_acquired_at: row[6].value, # TODO (sharang): Fix this to import the correct date
        number_of_shares: row[3].value,
        share_price_usd: row[4].value.delete_prefix("$").to_d,
        total_amount_in_cents: (row[5].value * 100).to_i,
      }

      puts "Processing security #{row[0].value}"

      user = name_to_user_mapping[row[1].value]
      company_investor = user.company_investors.find_by(company: gumroad_company!)
      if company_investor.nil?
        @errors << { name: row[0].value, error_message: "Could not find an investor record" }
        next
      end

      share = company_investor.share_holdings.build(**attrs, share_holder_name: user.legal_name)
      share.save
      if share.errors.present?
        @errors << { name: row[0].value, error_message: share.errors.full_messages.to_sentence }
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
service = ImportShareHoldings.new("/Users/sharang/Downloads/new data for flexile.xlsx")
service.process; nil
puts service.errors
=end
