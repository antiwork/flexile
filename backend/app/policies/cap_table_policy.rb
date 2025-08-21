# frozen_string_literal: true

class CapTablePolicy < ApplicationPolicy
  def create?
    return false unless company_administrator?

    # Only allow cap table creation for companies with no existing cap table data
    company.share_classes.empty? &&
    company.share_holdings.empty? &&
    company.company_investors.empty? &&
    company.fully_diluted_shares.zero?
  end
end
