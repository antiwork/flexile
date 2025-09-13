# frozen_string_literal: true

class ImpersonationPolicy < ApplicationPolicy
  def create?
    !record.team_member?
  end
end
