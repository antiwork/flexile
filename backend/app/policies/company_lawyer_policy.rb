# frozen_string_literal: true

class CompanyLawyerPolicy < ApplicationPolicy
  def create?
    company_administrator?
  end
end
