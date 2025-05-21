# frozen_string_literal: true

class CreateInvestorsAndDividends
  attr_reader :errors

  def initialize(company_id:, workbook_url:, dividend_date:, is_first_round: false, is_return_of_capital: false)
    @company = Company.find(company_id)
    @workbook_url = workbook_url
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
    attr_reader :company, :workbook_url, :dividend_date, :is_first_round, :is_return_of_capital

    def process_sheet
      @data = {}
      tempfile = Tempfile.new(["workbook", ".xlsx"], binmode: true)
      tempfile.write(URI.open(workbook_url).read)
      tempfile.rewind
      workbook = RubyXL::Parser.parse(tempfile.path)
      workbook.worksheets.each do |sheet|
        puts "Processing sheet #{sheet.sheet_name}"
        header = sheet[0].cells.map { _1.present? ? _1.value : nil }
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

        sheet.drop(1).each do |row| # drop the header
          next if row.nil? || row[0].nil? || row[0].value.blank?

          email = row[attribute_to_column_mapping[:email]].value
          email = test_email_for(email) if !Rails.env.production?
          puts "Processing email #{email}"

          street_address = [row[attribute_to_column_mapping[:address_1]]&.value,
                            row[attribute_to_column_mapping[:address_2]]&.value].compact.join(", ")
          @data[email] = {
            user_params: {
              email:,
              preferred_name: attribute_to_column_mapping[:preferred_name] ? row[attribute_to_column_mapping[:preferred_name]].value : nil,
              legal_name: attribute_to_column_mapping[:legal_name] ? row[attribute_to_column_mapping[:legal_name]].value : nil,
              business_entity: attribute_to_column_mapping[:business_name] ? row[attribute_to_column_mapping[:business_name]]&.value.present? || false : false,
              business_name: attribute_to_column_mapping[:business_name] ? row[attribute_to_column_mapping[:business_name]]&.value : nil,
              country_code: attribute_to_column_mapping[:address_country] ? row[attribute_to_column_mapping[:address_country]]&.value : nil,
              street_address:,
              city: attribute_to_column_mapping[:address_city] ? row[attribute_to_column_mapping[:address_city]]&.value : nil,
              state: attribute_to_column_mapping[:address_region] ? row[attribute_to_column_mapping[:address_region]]&.value : nil,
              zip_code: attribute_to_column_mapping[:address_zip] ? row[attribute_to_column_mapping[:address_zip]]&.value : nil,
            },
            investment: {
              round: 1,
              date: attribute_to_column_mapping[:investment_date] ? row[attribute_to_column_mapping[:investment_date]].value : nil,
              amount: attribute_to_column_mapping[:investment_amount] ? row[attribute_to_column_mapping[:investment_amount]].value.to_d : nil,
              dividend_amount: attribute_to_column_mapping[:dividend_amount] ? row[attribute_to_column_mapping[:dividend_amount]].value.to_d : nil,
            },
          }
        end
        puts "Done processing sheet #{sheet.sheet_name}. Processed #{sheet.sheet_data.size} rows"
      end
      puts "Processed total of #{@data.size} rows"
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
      puts "Creating Dividend round"
      dividend_round = company.dividend_rounds.create!(
        issued_at: Time.current,
        number_of_shares: 0,
        number_of_shareholders: @data.keys.count,
        status: Dividend::ISSUED,
        return_of_capital: is_return_of_capital,
        total_amount_in_cents: @data.sum { |_email, info| (info[:investment][:dividend_amount] * 100.to_d).to_i }
      )
      puts "Created Dividend round #{dividend_round.id}: #{dividend_round.total_amount_in_cents} cents"

      @data.each do |email, info|
        user = User.find_by!(email:)
        company_investor = user.company_investors.find_by!(company:)
        info[:investment].tap do |investment|
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
company_id = 2
service = CreateInvestorsAndDividends.new(company_id:,
                                          workbook_url: "/Users/sharang/Downloads/fierce-crowdsafe-investors_updated.xlsx",
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
