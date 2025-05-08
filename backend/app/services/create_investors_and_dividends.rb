# frozen_string_literal: true

class CreateInvestorsAndDividends
  attr_reader :errors

  def initialize(company_id:, workbook_path:, dividend_date:)
    @company = Company.find(company_id)
    @workbook_path = workbook_path
    @dividend_date = dividend_date
    @errors = []
  end

  def process
    process_sheet
    create_investors
    create_investments_and_dividends
    nil
  end

  private
    attr_reader :company, :workbook_path, :dividend_date

    def process_sheet
      @data = {}
      workbook = RubyXL::Parser.parse(workbook_path)
      worksheet = workbook[0]
      header = worksheet[0].cells.map { _1.present? ? _1.value : nil }
      attribute_to_column_mapping = {
        preferred_name: header.index("name"),
        legal_name: header.index("full_legal_name"),
        address_1: header.index("investment_address_1"),
        address_2: header.index("investment_address_2"),
        address_city: header.index("investment_address_city"),
        address_region: header.index("investment_address_region"),
        address_zip: header.index("investment_address_postal_code"),
        address_country: header.index("investment_address_country"),
        email: header.index("email"),
        investment_date: header.index("investment_date"),
        investment_amount: header.index("investment_amount"),
        tax_id: header.index("tax_id"),
        business_name: header.index("entity_name"),
        dividend_amount: header.index("dividend_amount"),
      }

      puts "Processing first sheet"
      worksheet.drop(1).each do |row| # drop the header
        next if row.nil? || row[0].nil? || row[0].value.blank?

        email = row[attribute_to_column_mapping[:email]].value
        email = test_email_for(email) if !Rails.env.production?
        puts "Processing email #{email}"

        street_address = [row[attribute_to_column_mapping[:address_1]]&.value,
                          row[attribute_to_column_mapping[:address_2]]&.value].compact.join(", ")
        @data[email] = {
          user_params: {
            email:,
            preferred_name: row[attribute_to_column_mapping[:preferred_name]].value,
            legal_name: row[attribute_to_column_mapping[:legal_name]].value,
            tax_id: row[attribute_to_column_mapping[:tax_id]]&.value,
            business_entity: row[attribute_to_column_mapping[:business_name]]&.value.present? || false,
            business_name: row[attribute_to_column_mapping[:business_name]]&.value,
            country_code: row[attribute_to_column_mapping[:address_country]]&.value,
            street_address:,
            city: row[attribute_to_column_mapping[:address_city]]&.value,
            state: row[attribute_to_column_mapping[:address_region]]&.value,
            zip_code: row[attribute_to_column_mapping[:address_zip]]&.value,
          },
          investment:
            {
              round: 1,
              date: row[attribute_to_column_mapping[:investment_date]].value,
              amount: row[attribute_to_column_mapping[:investment_amount]].value.to_d,
              dividend_amount: row[attribute_to_column_mapping[:dividend_amount]].value.to_d,
            },
        }
      end
    end

    def create_investors
      request_count = 0
      start_time = Time.current

      @data.each do |email, info|
        puts "Creating investor #{email}"
        investment_amount_in_cents = (info[:investment][:amount] * 100.to_d).to_i

        if User.where(email:).exists?
          if User.find_by(email:).company_investors.where(company:).exists?
            @errors << { email:, error_message: "Investor exists. Should not have happened!" }
          else
            user = User.find_by(email:)
            user.company_investors.create!(company:, investment_amount_in_cents:)
          end
        else
          # Respect Clerk's rate limit
          if request_count >= 10
            elapsed = Time.current - start_time
            if elapsed < 11.seconds
              sleep_secs = 11.seconds - elapsed
              puts "Sleeping for #{sleep_secs} seconds"
              sleep(sleep_secs)
            end
            request_count = 0
            start_time = Time.current
          end

          result = InviteInvestor.new(current_user: primary_admin_user!, company:,
                                      dividend_date:,
                                      user_params: info[:user_params],
                                      investor_params: { investment_amount_in_cents: })
                                 .perform
          puts "Created investor #{email}"
          request_count += 1

          if !result[:success]
            puts "Error for email #{email}:"
            puts "Error: #{result[:error_message]}"
            @errors << { email:, error_message: result[:error_message] }
          end
        end
      end
    end

    def create_investments_and_dividends
      puts "Creating SAFE and investments"
      total_cents = @data.sum { |_email, info| (info[:investment][:amount] * 100.to_d).to_i }
      safe = company.convertible_investments.create!(
        identifier: "SAFE-1", entity_name: "Republic.co - 1", company_valuation_in_dollars: 40_000_000,
        amount_in_cents: total_cents, implied_shares: total_cents, valuation_type: "Pre-money",
        convertible_type: "Crowd SAFE", issued_at: Date.parse("July 16, 2021")
      )

      puts "Creating Dividend round"
      dividend_round = company.dividend_rounds.create!(
        issued_at: Time.current,
        number_of_shares: 0,
        number_of_shareholders: @data.keys.count,
        status: Dividend::ISSUED,
        return_of_capital: true,
        total_amount_in_cents: @data.sum { |_email, info| (info[:investment][:dividend_amount] * 100.to_d).to_i }
      )

      @data.each do |email, info|
        user = User.find_by!(email:)
        company_investor = user.company_investors.find_by!(company:)
        info[:investment].tap do |investment|
          convertible_investment = safe

          puts "Creating convertible_security for #{email}"
          principal_value_in_cents = (investment[:amount] * 100.to_d).to_i
          company_investor.convertible_securities.create!(
            convertible_investment:, principal_value_in_cents:,
            implied_shares: principal_value_in_cents, issued_at: investment[:date]
          )

          puts "Creating dividend for #{email}"
          dividend_cents = (investment[:dividend_amount] * 100.to_d).to_i
          company_investor.dividends.create!(
            dividend_round:,
            company:,
            status: user.current_sign_in_at.nil? ? Dividend::PENDING_SIGNUP : Dividend::ISSUED,
            total_amount_in_cents: dividend_cents,
            qualified_amount_cents: dividend_cents,
          )
        end
      end
    end

    def test_email_for(email)
      @_test_email_for ||= {}
      @requested_emails ||= []
      @requested_emails << email
      puts "test_email_for"
      puts email

      if @_test_email_for.key?(email)
        @_test_email_for[email]
      else
        index = @_test_email_for.size
        @_test_email_for[email] = "sharang.d+12345#{index}@gmail.com"
      end
    end

    def primary_admin_user!
      @_admin ||= company.primary_admin.user
    end
end

=begin
company_id = 2
service = CreateInvestorsAndDividends.new(company_id:,
                                          workbook_path: "/Users/sharang/Downloads/fierce-crowdsafe-investors_updated.xlsx",
                                          dividend_date: Date.parse("December 21, 2024"))
service.process
puts service.errors

puts User.where("email LIKE 'sharang.d+12345%@gmail.com'").count
puts CompanyInvestor.where(user_id: User.where("email LIKE 'sharang.d+12345%@gmail.com'").select(:id)).count
puts DividendRound.where(company_id:).count
puts Dividend.where(dividend_round_id: DividendRound.where(company_id:).select(:id)).count
puts Dividend.where(dividend_round_id: DividendRound.where(company_id:).select(:id)).sum(:total_amount_in_cents)
puts CompanyInvestor.where(user_id: User.where("email LIKE 'sharang.d+12345%@gmail.com'").select(:id)).sum(:investment_amount_in_cents)

Dividend.where(dividend_round_id: DividendRound.where(company_id:).select(:id)).destroy_all
DividendRound.where(company_id:).destroy_all
CompanyInvestor.where(user_id: User.where("email LIKE 'sharang.d+12345%@gmail.com'").select(:id)).destroy_all
User.where("email LIKE 'sharang.d+12345%@gmail.com'").destroy_all
=end
