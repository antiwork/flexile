# frozen_string_literal: true

class CompanyLawyerPolicy < ApplicationPolicy
  def create?
    return false unless company.lawyers_enabled?

    company_administrator.present?
  end
end
