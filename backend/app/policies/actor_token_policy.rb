# frozen_string_literal: true

class ActorTokenPolicy < ApplicationPolicy
  def create?
    return false unless company_administrator?

    # Primary admin can impersonate anyone
    return true if company.primary_admin.user_id == user.id

    # Regular admins can only impersonate non-admins
    !record.company_administrator_for?(company)
  end
end
