# frozen_string_literal: true

class CompanyInvestor < ApplicationRecord
  include ExternalId, Searchable

  belongs_to :user
  belongs_to :company

  has_many :convertible_securities
  has_many :dividends
  has_many :equity_buybacks
  has_many :equity_grants
  has_many :equity_grant_exercises
  has_many :investor_dividend_rounds
  has_many :share_holdings
  has_many :tender_offer_bids

  MIN_DIVIDENDS_AMOUNT_FOR_TAX_FORMS = 10_00

  validates :user_id, uniqueness: { scope: :company_id }
  validates :total_shares, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :total_options, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :investment_amount_in_cents, presence: true,
                                         numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  scope :with_shares_or_options, -> { where("total_shares > 0 OR total_options > 0") }
  scope :with_required_tax_info_for, -> (tax_year:) do
    dividends_subquery = Dividend.select("company_investor_id")
                                 .for_tax_year(tax_year)
                                 .group("company_investor_id")
                                 .having("SUM(total_amount_in_cents) >= ?", MIN_DIVIDENDS_AMOUNT_FOR_TAX_FORMS)

    joins(:company).merge(Company.active.irs_tax_forms)
      .where(id: dividends_subquery)
  end

  def completed_onboarding?
    OnboardingState::Investor.new(user:, company:).complete?
  end
end
