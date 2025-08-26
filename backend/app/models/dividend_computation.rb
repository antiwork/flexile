# frozen_string_literal: true

class DividendComputation < ApplicationRecord
  include ExternalId

  belongs_to :company
  has_many :dividend_computation_outputs, dependent: :destroy

  validates :total_amount_in_usd, presence: true, numericality: { greater_than: 0 }
  validates :dividends_issuance_date, presence: true
  scope :unfinalized, -> { where(finalized_at: nil) }

  def number_of_shareholders
    data_for_dividend_creation.map { _1[:company_investor_id] }.uniq.count
  end

  def finalized?
    finalized_at?
  end

  def mark_as_finalized!
    update!(finalized_at: Time.current)
  end

  def to_csv
    CSV.generate(headers: true) do |csv|
      csv << ["Investor", "Share class", "Number of shares", "Hurdle rate", "Original issue price (USD)",
              "Common dividend amount (USD)", "Preferred dividend amount (USD)", "Total amount (USD)"]
      dividend_computation_outputs.includes(company_investor: :user).find_each do |output|
        investor_name = output.investor_name || output.company_investor.user.legal_name
        csv << [investor_name, output.share_class,
                output.number_of_shares, output.hurdle_rate, output.original_issue_price_in_usd,
                output.dividend_amount_in_usd, output.preferred_dividend_amount_in_usd,
                output.total_amount_in_usd]
      end
    end
  end

  def broken_down_by_investor
    share_dividends, safe_dividends = dividends_info

    company_investor_ids = share_dividends.keys
    company_investors_by_id = CompanyInvestor.includes(:user).where(id: company_investor_ids).index_by(&:id)

    aggregated_data = []

    share_dividends.each do |company_investor_id, info|
      company_investor = company_investors_by_id[company_investor_id]
      aggregated_data << {
        investor_name: company_investor.user.legal_name,
        company_investor_id: company_investor_id,
        investor_external_id: company_investor.user.external_id,
        total_amount: info[:total_amount],
        number_of_shares: info[:number_of_shares],
      }
    end

    safe_dividends.each do |investor_name, info|
      aggregated_data << {
        investor_name: investor_name,
        # SAFEs are identified by their entity name
        company_investor_id: nil,
        investor_external_id: nil,
        total_amount: info[:total_amount],
        number_of_shares: info[:number_of_shares],
      }
    end

    aggregated_data
  end


  def to_per_investor_csv
    CSV.generate(headers: true) do |csv|
      csv << ["Investor", "Investor ID", "Number of shares", "Amount (USD)"]
      broken_down_by_investor.each do |investor_data|
        csv << [
          investor_data[:investor_name],
          investor_data[:company_investor_id],
          investor_data[:number_of_shares],
          investor_data[:total_amount]
        ]
      end
    end
  end

  def to_final_csv
    CSV.generate(headers: true) do |csv|
      csv << ["Investor", "Investor ID", "Number of shares", "Amount (USD)"]
      data_for_dividend_creation.each do |data|
        csv << [CompanyInvestor.find(data[:company_investor_id]).user.legal_name,
                data[:company_investor_id],
                data[:number_of_shares],
                data[:total_amount]]
      end
    end
  end

  def finalize_and_create_dividend_round
    data = data_for_dividend_creation

    dividend_round = company.dividend_rounds.create!(
      issued_at: dividends_issuance_date,
      number_of_shares: data.sum { _1[:number_of_shares] || 0 },
      number_of_shareholders: data.map { _1[:company_investor_id] }.uniq.count,
      status: Dividend::ISSUED,
      total_amount_in_cents: (total_amount_in_usd * 100.to_d).to_i,
      return_of_capital:
    )

    data.each do |dividend_attrs|
      company.company_investors.find(dividend_attrs[:company_investor_id]).dividends.create!(
        dividend_round:,
        company:,
        total_amount_in_cents: (dividend_attrs[:total_amount] * 100.to_d).to_i,
        qualified_amount_cents: (dividend_attrs[:qualified_dividends_amount] * 100.to_d).to_i,
        number_of_shares: dividend_attrs[:number_of_shares],
        investment_amount_cents: dividend_attrs[:investment_amount_cents],
        status: Dividend::ISSUED # TODO (sharang): set `PENDING_SIGNUP` if user.encrypted_password is ""
      )
    end

    mark_as_finalized!
    dividend_round
  end

  def dividends_info
    share_dividends = Hash.new { |h, k| h[k] = { number_of_shares: 0, total_amount: 0.to_d, qualified_dividends_amount: 0.to_d, investment_amount_cents: 0 } }
    safe_dividends = Hash.new { |h, k| h[k] = { number_of_shares: 0, total_amount: 0.to_d, qualified_dividends_amount: 0.to_d } }

    dividend_computation_outputs.find_each do |output|
      if output.investor_name.present?
        safe_dividends[output.investor_name][:number_of_shares] += output.number_of_shares
        safe_dividends[output.investor_name][:total_amount] += output.total_amount_in_usd
        safe_dividends[output.investor_name][:qualified_dividends_amount] += output.qualified_dividend_amount_usd
      else
        share_dividends[output.company_investor_id][:number_of_shares] += output.number_of_shares
        share_dividends[output.company_investor_id][:total_amount] += output.total_amount_in_usd
        share_dividends[output.company_investor_id][:qualified_dividends_amount] += output.qualified_dividend_amount_usd
        share_dividends[output.company_investor_id][:investment_amount_cents] += output.investment_amount_cents.to_i
      end
    end

    [share_dividends, safe_dividends]
  end

  private
    def data_for_dividend_creation
      data = []
      share_dividends, safe_dividends = dividends_info

      share_dividends.each do |company_investor_id, info|
        data << {
          company_investor_id:,
          total_amount: info[:total_amount],
          qualified_dividends_amount: info[:qualified_dividends_amount],
          number_of_shares: info[:number_of_shares],
          investment_amount_cents: info[:investment_amount_cents],
        }
      end

      safe_dividends.each do |investor_name, info|
        investment = company.convertible_investments.find_by(entity_name: investor_name)
        investment.convertible_securities.each do |security|
          security_in_usd = security.principal_value_in_cents.to_d / 100.to_d
          investment_in_usd = investment.amount_in_cents.to_d / 100.to_d
          data << {
            company_investor_id: security.company_investor_id,
            qualified_dividends_amount: (info[:qualified_dividends_amount] / investment_in_usd * security_in_usd).round(2),
            total_amount: (info[:total_amount] / investment_in_usd * security_in_usd).round(2),
            number_of_shares: nil,
            investment_amount_cents: security.principal_value_in_cents,
          }
        end
      end

      data
    end
end

# dividend_computation = DividendComputation.last
# attached = {
#   "per_investor_and_share_class.csv" => { mime_type: "text/csv", content: dividend_computation.to_csv },
#   "per_investor.csv" => { mime_type: "text/csv", content: dividend_computation.to_per_investor_csv },
#   "final.csv" => { mime_type: "text/csv", content: dividend_computation.to_final_csv }
# }
#
# AdminMailer.custom(to: ["sharang.d@gmail.com"], subject: "Test", body: "Attached", attached: ).deliver_now
