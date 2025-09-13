# frozen_string_literal: true

class Admin::Impersonation::UserPolicy < ApplicationPolicy
  def create?
    !record.team_member?
  end
end
