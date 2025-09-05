# frozen_string_literal: true

class CapTablePolicy < ApplicationPolicy
  def create?
    return false unless company_administrator?
    company.cap_table_empty?
  end
end
