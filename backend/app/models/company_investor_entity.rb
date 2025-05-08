# frozen_string_literal: true

class CompanyInvestorEntity < ApplicationRecord
  include ExternalId

  belongs_to :company
  has_many :share_holdings
  has_many :equity_grants

  validates :name, presence: true
  validates :email, presence: true, uniqueness: { scope: [:company_id, :name] }
  validates :investment_amount_cents, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_options, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :with_shares_or_options, -> { where("total_shares > 0 OR total_options > 0") }
end
