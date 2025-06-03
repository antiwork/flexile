# frozen_string_literal: true

class DividendRoundPolicy < ApplicationPolicy
  def index?
    company_administrator.present? || company_lawyer.present?
  end
end
