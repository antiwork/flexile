# frozen_string_literal: true

class GithubIntegrationPolicy < ApplicationPolicy
  def create?
    return false unless company.team_updates_enabled?

    company_administrator.present?
  end

  def destroy?
    create?
  end
end
