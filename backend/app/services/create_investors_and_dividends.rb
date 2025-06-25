# frozen_string_literal: true

class CreateInvestorsAndDividends
  attr_reader :errors

  def initialize(company_id:, csv_data:, dividend_date:, is_first_round: false, is_return_of_capital: false)
    @company = Company.find(company_id)
    @csv_data = csv_data
    @dividend_date = dividend_date
    @errors = []
    @is_first_round = is_first_round
    @is_return_of_capital = is_return_of_capital
  end

  def process
    process_sheet
    create_investors if is_first_round
    create_investments_and_dividends
    nil
  end

  private
    attr_reader :company, :csv_data, :dividend_date, :is_first_round, :is_return_of_capital

    def process_sheet
      @data = {}
      puts "Processing CSV data"

      CSV.parse(csv_data, headers: true).each do |row|
        next if row["email"].blank?

        email = row["email"]
        email = test_email_for(email) if !Rails.env.production?
        puts "Processing email #{email}"

        street_address = [row["investment_address_1"], row["investment_address_2"]].compact.join(", ")
        @data[email] = {
          user_params: {
            email:,
            preferred_name: row["name"],
            legal_name: row["full_legal_name"],
            business_entity: row["entity_name"].present?,
            business_name: row["entity_name"],
            country_code: row["investment_address_country"],
            street_address:,
            city: row["investment_address_city"],
            state: row["investment_address_region"],
            zip_code: row["investment_address_postal_code"],
          },
          investment: {
            round: 1,
            date: row["investment_date"],
            amount: row["investment_amount"]&.to_d,
            dividend_amount: row["dividend_amount"]&.to_d,
          },
        }
      end
      puts "Done processing CSV data. Processed #{@data.size} rows"
      @data
    end

    def create_investors
      request_count = 0
      start_time = Time.current

      @data.each do |email, info|
        puts "Creating investor #{email}"
        investment_amount_in_cents = (info[:investment][:amount] * 100.to_d).to_i

        if User.where(email:).exists?
          if User.find_by(email:).company_investors.where(company:).exists?
            @errors << { email:, error_message: "Investor already exists." }
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
      return if @data.empty?

      total_amount = @data.sum { |_email, info| (info[:investment][:dividend_amount]&.to_d || 0) * 100 }.to_i
      return if total_amount <= 0

      puts "Creating Dividend round"
      dividend_round = company.dividend_rounds.create!(
        issued_at: Time.current,
        number_of_shares: 0,
        number_of_shareholders: @data.keys.count,
        status: Dividend::ISSUED,
        return_of_capital: is_return_of_capital,
        total_amount_in_cents: total_amount
      )
      puts "Created Dividend round #{dividend_round.id}: #{dividend_round.total_amount_in_cents} cents"

      @data.each do |email, info|
        user = User.find_by!(email:)
        company_investor = user.company_investors.find_by!(company:)
        info[:investment].tap do |investment|
          puts "Creating dividend for #{email}"
          dividend_cents = ((investment[:dividend_amount]&.to_d || 0) * 100).to_i
          company_investor.dividends.create!(
            dividend_round:,
            company:,
            status: user.current_sign_in_at.nil? ? Dividend::PENDING_SIGNUP : Dividend::ISSUED,
            total_amount_in_cents: dividend_cents,
            qualified_amount_cents: dividend_cents,
          )
        end
      rescue => e
        puts "Error creating dividend for #{email}: #{e.message}"
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
data = <<~CSV
  name,full_legal_name,investment_address_1,investment_address_2,investment_address_city,investment_address_region,investment_address_postal_code,investment_address_country,email,investment_date,investment_amount,tax_id,entity_name,dividend_amount
  John Doe,John Michael Doe,123 Main St,,San Francisco,CA,94102,US,john@example.com,2024-01-15,10000.00,123-45-6789,,500.00
  Jane Smith,Jane Elizabeth Smith,456 Oak Ave,Apt 2B,New York,NY,10001,US,jane@example.com,2024-02-20,25000.00,987-65-4321,,1250.00
CSV

company_id = 2
service = CreateInvestorsAndDividends.new(company_id:,
                                          csv_data: data,
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
