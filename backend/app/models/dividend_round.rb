# frozen_string_literal: true

class DividendRound < ApplicationRecord
  include ExternalId

  belongs_to :company
  has_many :dividends
  has_many :investor_dividend_rounds

  validates :issued_at, presence: true
  validates :number_of_shares, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :number_of_shareholders, presence: true, numericality: { greater_than: 0 }
  validates :total_amount_in_cents, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true, inclusion: { in: %w(Issued Paid) }
  validates :ready_for_payment, inclusion: { in: [true, false] }
  validates :return_of_capital, inclusion: { in: [true, false] }

  scope :ready_for_payment, -> { where(ready_for_payment: true) }

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
