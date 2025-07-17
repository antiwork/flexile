# frozen_string_literal: true

class LiquidationScenarioPolicy < ApplicationPolicy
  def calculate?
    company_administrator? || company_lawyer?
  end

  def export?
    company_administrator? || company_lawyer?
  end

  class Scope < ApplicationPolicy::Scope
    def resolve
      return scope.none unless company_administrator? || company_lawyer?
      
      scope.where(company: user.company)
    end
  end
end