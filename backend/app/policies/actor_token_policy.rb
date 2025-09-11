# frozen_string_literal: true

class ActorTokenPolicy < ApplicationPolicy
  def create?
    company_administrator? &&
    (company.primary_admin.user_id == user.id || !record.company_administrator_for?(company))
  end
end
