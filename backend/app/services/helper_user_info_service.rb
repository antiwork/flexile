# frozen_string_literal: true

class HelperUserInfoService
  def initialize(email:)
    @email = email
  end

  def customer_info
    @user = User.find_by(email: @email)
    return {} unless user

    {
      name: user.email,
      metadata: {
        "Country of residence" => user.display_country,
        "Contractor for companies" => user.clients.map(&:display_name).to_sentence.presence,
        "Investor for companies" => user.portfolio_companies.map(&:display_name).to_sentence.presence,
        "Administrator for companies" => user.companies.map(&:display_name).to_sentence.presence,
        "Investments" => investment_notes,
        "Dividends received" => dividend_notes,
        "Minimum dividend payment" => user.minimum_dividend_payment_in_cents,
        "Invoices submitted" => invoice_notes,
      }.compact,
    }
  end

  private
    attr_reader :user

    def investment_notes
      return unless user.investor?

      user.company_investors.map do |company_investor|
        amount = Money.new(company_investor.investment_amount_in_cents, "usd")
                      .format(no_cents_if_whole: false, symbol: true)
        company_name = company_investor.company.display_name
        { "Amount" => amount, "Company" => company_name }
      end
    end

    def dividend_notes
      return unless user.dividends.exists?

      user.dividends.map do |dividend|
        company_investor = dividend.company_investor
        amount = Money.new(dividend.total_amount_in_cents, "usd")
                      .format(no_cents_if_whole: false, symbol: true)
        company_name = company_investor.company.display_name
        { "Amount" => amount, "Company" => company_name, "Status" => dividend.status }
      end
    end

    def invoice_notes
      return unless user.invoices.exists?

      user.invoices.map do |invoice|
        total_amount = Money.new(invoice.total_amount_in_usd_cents, "usd")
                            .format(no_cents_if_whole: false, symbol: true)
        cash_amount = Money.new(invoice.cash_amount_in_cents, "usd")
                           .format(no_cents_if_whole: false, symbol: true)
        equity_amount = Money.new(invoice.equity_amount_in_cents, "usd")
                             .format(no_cents_if_whole: false, symbol: true)
        company_name = invoice.company.display_name
        { "Company" => company_name, "Invoice number" => invoice.invoice_number, "Status" => invoice.status, "Total" => total_amount, "Cash" => cash_amount, "Equity" => equity_amount, "Date" => invoice.invoice_date.to_s }
      end
    end
end
