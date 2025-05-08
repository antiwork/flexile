# frozen_string_literal: true

class CreateInvestors
  attr_reader :errors

  def initialize(csv_path, dividend_date:)
    @csv_path = csv_path
    @dividend_date = dividend_date
    @errors = []
  end

  def process
    CSV.parse(File.read(@csv_path), headers: true).each do |row|
      email = row["email"]
      email = test_email if !Rails.env.production?
      puts "Processing email #{email}"

      if row["investment_amount"].blank?
        @errors << { email:, error_message: "Investment amount is missing" }
        next
      end

      investment_amount_in_cents = (row["investment_amount"].to_f * 100).to_i

      if User.where(email:).exists?
        if User.find_by(email:).company_investors.where(company: gumroad_company!).exists?
          puts "Investor with email #{email} already exists"
          next
        else
          user = User.find_by(email:)
          user.company_investors.create!(company: gumroad_company!, investment_amount_in_cents:)
        end
      else
        is_business = row["billing_entity_name"].present?
        result = InviteInvestor.new(current_user: company_admin!, company: gumroad_company!,
                                    dividend_date: @dividend_date,
                                    user_params: {
                                      email:,
                                      country_code: ISO3166::Country.find_country_by_common_name(row["country"])&.alpha2,
                                      preferred_name: row["preferred_name"],
                                      legal_name: row["legal_name"],
                                      business_entity: is_business,
                                      business_name: row["billing_entity_name"],
                                      street_address: row["street_address"],
                                      city: row["city"],
                                      state: row["region"],
                                      zip_code: row["postal_code"],
                                    },
                                    investor_params: { investment_amount_in_cents: })
                               .perform
        if !result[:success]
          puts "Error for email #{email}:"
          puts "Error: #{result[:error_message]}"
          @errors << { email:, error_message: result[:error_message] }
        end
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

    def company_admin!
      @_company_admin ||= gumroad_company!.company_administrators.order(id: :asc).first!.user
    end
end

=begin
service = CreateInvestors.new("/Users/sharang/Downloads/Investors.csv", dividend_date: Date.parse("August 12, 2024")
service.process
puts service.errors
=end
