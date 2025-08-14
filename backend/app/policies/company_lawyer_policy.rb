# frozen_string_literal: true

class CompanyLawyerPolicy < ApplicationPolicy
  def create?
    company_administrator.present?
  end
end
