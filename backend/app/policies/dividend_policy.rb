# frozen_string_literal: true

class DividendPolicy < ApplicationPolicy
  def index?
    company_investor.present?
  end
end
