# frozen_string_literal: true

class DividendPolicy < ApplicationPolicy
  def index?
    company_administrator.present? || company_investor.present?
  end

  def show?
    index? && (company_administrator.present? || user.legal_name.present?)
  end

  def sign?
    company_investor.present? && user.legal_name.present?
  end
end
