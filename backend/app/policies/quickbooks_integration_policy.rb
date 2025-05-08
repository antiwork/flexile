# frozen_string_literal: true

class QuickbooksIntegrationPolicy < ApplicationPolicy
  def update?
    company_administrator.present?
  end

  def connect?
    update?
  end

  def disconnect?
    update?
  end

  def list_accounts?
    update?
  end
end
