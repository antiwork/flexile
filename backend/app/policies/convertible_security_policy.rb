# frozen_string_literal: true

class ConvertibleSecurityPolicy < ApplicationPolicy
  def index?
    company_investor.present?
  end
end
