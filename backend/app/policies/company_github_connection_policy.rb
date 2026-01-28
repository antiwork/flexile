# frozen_string_literal: true

class CompanyGithubConnectionPolicy < ApplicationPolicy
  def start?
    company_administrator?
  end

  def callback?
    start?
  end

  def destroy?
    start?
  end
end
