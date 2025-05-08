# frozen_string_literal: true

class Settings::DividendPolicy < ApplicationPolicy
  def show?
    company_investor.present?
  end

  def update?
    show?
  end
end
