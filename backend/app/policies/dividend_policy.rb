# frozen_string_literal: true

class DividendPolicy < ApplicationPolicy
  def index?
    company_investor.present?
  end

  def show?
    index? && user.legal_name.present?
  end

  def sign?
    show?
  end
end
