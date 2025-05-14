# frozen_string_literal: true

class DividendRoundPolicy < ApplicationPolicy
  def index?
    return unless company.dividends_allowed?

    company_administrator.present? || company_lawyer.present?
  end
end
