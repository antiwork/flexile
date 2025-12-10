# frozen_string_literal: true

class GithubIntegrationPolicy < ApplicationPolicy
  def index?
    company_administrator.present?
  end

  def show?
    company_administrator.present?
  end

  def create?
    company_administrator.present?
  end

  def update?
    company_administrator.present?
  end

  def destroy?
    company_administrator.present?
  end

  def connect?
    company_administrator.present?
  end

  def callback?
    company_administrator.present?
  end

  def disconnect?
    company_administrator.present?
  end
end
