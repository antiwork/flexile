# frozen_string_literal: true

class GithubPolicy < ApplicationPolicy
  def connect?
    user.present?
  end

  def disconnect?
    user.present? && user.github_uid.present?
  end

  def fetch_pr?
    user.present?
  end

  def manage_org?
    company_administrator?
  end
end
