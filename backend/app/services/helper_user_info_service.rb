# frozen_string_literal: true

class HelperUserInfoService
  def initialize(email:)
    @email = email
  end

  def user_info
    @user = User.find_by(email: @email)
    @info = []

    if user
      add_user_info_notes
      add_user_role_notes
      add_investment_notes
      add_dividend_notes
    end

    {
      prompt: @info.join("\n"),
      metadata: metadata,
    }
  end

  private
    attr_reader :user

    def add_user_info_notes
      return unless user.country_code?
      @info << "The user's residence country is #{user.display_country}"
    end

    def add_user_role_notes
      clients = user.clients.map(&:display_name)
      @info << "The user is a contractor for #{clients.to_sentence}" if clients.present?

      portfolio_companies = user.portfolio_companies.map(&:display_name)
      @info << "The user is an investor for #{portfolio_companies.to_sentence}" if portfolio_companies.present?

      companies = user.companies.map(&:display_name)
      @info << "The user is an administrator for #{companies.to_sentence}" if companies.present?

      # No need to check for lawyers, as they are not likely to contact support
    end

    def add_investment_notes
      return unless user.investor?

      user.company_investors.each do |company_investor|
        amount = Money.new(company_investor.investment_amount_in_cents, "usd")
                      .format(no_cents_if_whole: false, symbol: true)
        company_name = company_investor.company.display_name
        @info << "The user invested #{amount} in #{company_name}"
      end
    end

    def add_dividend_notes
      return unless user.dividends.exists?

      user.dividends.each do |dividend|
        company_investor = dividend.company_investor
        amount = Money.new(dividend.total_amount_in_cents, "usd")
                      .format(no_cents_if_whole: false, symbol: true)
        company_name = company_investor.company.display_name
        @info << "The user received a dividend of #{amount} from #{company_name}. " \
                             "The status of the dividend is #{dividend.status}."
      end
      @info << "The user's minimum dividend payment is #{Money.from_cents(user.minimum_dividend_payment_in_cents, 'usd').format(symbol: true)}"
    end

    def metadata
      return {} unless user

      { name: user.email }
    end
end
