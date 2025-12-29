# frozen_string_literal: true

class GithubPolicy < ApplicationPolicy
  # User-level GitHub connection policies
  def connect?
    user.present?
  end

  def disconnect?
    user.present? && user.github_uid.present?
  end

  def fetch_pr?
    user.present?
  end

  # Company-level GitHub organization management
  def manage_org?
    company_administrator?
  end
end
