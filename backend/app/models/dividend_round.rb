# frozen_string_literal: true

class DividendRound < ApplicationRecord
  include ExternalId

  belongs_to :company
  belongs_to :consolidated_invoice, optional: true

  has_many :dividends
  has_many :investor_dividend_rounds

  validates :issued_at, presence: true
  validates :number_of_shares, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :number_of_shareholders, presence: true, numericality: { greater_than: 0 }
  validates :total_amount_in_cents, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w(Issued Paid) }
  validates :ready_for_payment, inclusion: { in: [true, false] }

  scope :ready_for_payment, -> { where(ready_for_payment: true) }

  def flexile_fees_in_cents
    dividends.map do |dividend|
      calculated_fee = ((dividend.total_amount_in_cents.to_d * 2.9.to_d / 100.to_d) + 30.to_d).round.to_i
      [30_00, calculated_fee].min
    end.sum
  end

  def send_dividend_emails
    company.company_investors.joins(:dividends)
      .where(dividends: { dividend_round_id: id })
      .group(:id)
      .each do |investor|
        investor_dividend_round = investor.investor_dividend_rounds.find_or_create_by!(dividend_round_id: id)
        investor_dividend_round.send_dividend_issued_email
      end
  end
end
